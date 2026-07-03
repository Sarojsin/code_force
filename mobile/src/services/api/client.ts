/**
 * API config + axios instance.
 * Rule §30: bearer token in Authorization header; refresh token in body; 429 → Retry-After.
 * Rule §14.1: tokens live in encrypted storage, not AsyncStorage.
 *
 * 401 Interceptor: catches "Session expired" and "Session compromised"
 * detail messages from the server's usk kill-switch and refresh replay
 * protection, then auto-logs out the user.
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { EncryptedStorage } from 'src/services/storage';

import { API_BASE_URL } from 'src/constants/config';
import { generateId } from 'src/utils/uuid';

const ACCESS_TOKEN_KEY = 'shecare.accessToken';
const REFRESH_TOKEN_KEY = 'shecare.refreshToken';

export const tokenStore = {
  async getAccess(): Promise<string | null> {
    try {
      return await EncryptedStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async setAccess(token: string): Promise<void> {
    await EncryptedStorage.setItem(ACCESS_TOKEN_KEY, token);
  },
  async getRefresh(): Promise<string | null> {
    try {
      return await EncryptedStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async setBoth(access: string, refresh: string): Promise<void> {
    await EncryptedStorage.setItem(ACCESS_TOKEN_KEY, access);
    await EncryptedStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  async clear(): Promise<void> {
    await EncryptedStorage.removeItem(ACCESS_TOKEN_KEY);
    await EncryptedStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async config => {
  const token = await tokenStore.getAccess();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  // X-Request-ID for log correlation (project invariant §10)
  config.headers['X-Request-ID'] = config.headers['X-Request-ID'] ?? generateId();
  return config;
});

// Single-flight refresh to avoid stampede on parallel 401s.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = await tokenStore.getRefresh();
    if (!refresh) return null;
    try {
      const resp = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refresh },
        { timeout: 10000 },
      );
      const { access_token, refresh_token: newRefresh } = resp.data?.data ?? resp.data;
      await tokenStore.setAccess(access_token);
      if (newRefresh) {
        await EncryptedStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);
      }
      return access_token as string;
    } catch {
      await tokenStore.clear();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// Helper to trigger auto-logout, imported lazily to avoid circular deps
function triggerSessionExpired(detail: string): void {
  // Dynamically import stores to avoid circular dependency
  const { useAuthStore } = require('src/stores/authStore');
  useAuthStore.getState().reset();

  // Navigate to Auth screen
  try {
    const { navigationRef } = require('src/navigation/rootNavigation');
    navigationRef.navigate('Auth');
  } catch {
    // Navigation not ready yet — suppress
  }

  // Show toast
  try {
    const Toast = require('react-native-toast-message').default;
    Toast.show({
      type: 'error',
      text1: 'Session Expired',
      text2: detail,
    });
  } catch {
    // Toast not available — suppress
  }
}

const SESSION_EXPIRED_DETAILS = [
  'Session expired. Please log in again.',
  'Session compromised. All sessions revoked. Please log in again.',
];

api.interceptors.response.use(
  resp => resp,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const detail = (error.response?.data as any)?.detail || '';

    // Handle session-expired / compromised (usk kill-switch / replay detection)
    if (status === 401 && SESSION_EXPIRED_DETAILS.includes(detail)) {
      triggerSessionExpired(detail);
      return Promise.reject(error);
    }

    // Normal 401 → try refresh
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (status === 401 && original && !original._retry) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
    }
    return Promise.reject(error);
  },
);

// API response envelope (project invariant §2)
export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface ApiSuccess<T> {
  data: T;
  message?: string;
}
export interface ApiError {
  error: {
    code: string;
    details: string;
    request_id: string;
  };
}
