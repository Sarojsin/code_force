/**
 * Axios instance with the project envelope contract + auth refresh.
 * Mirrors mobile/src/services/api/client.ts for the web admin.
 *
 * Tokens live in sessionStorage (not localStorage) to reduce XSS blast radius;
 * the refresh token is single-flight refreshed on 401.
 */
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

import type { ApiErrorBody, ApiSuccess } from 'src/types/api';

const ACCESS_KEY = 'shecare.admin.access';
const REFRESH_KEY = 'shecare.admin.refresh';

export const tokenStore = {
  getAccess(): string | null {
    return sessionStorage.getItem(ACCESS_KEY);
  },
  setAccess(token: string): void {
    sessionStorage.setItem(ACCESS_KEY, token);
  },
  getRefresh(): string | null {
    return sessionStorage.getItem(REFRESH_KEY);
  },
  setBoth(access: string, refresh: string): void {
    sessionStorage.setItem(ACCESS_KEY, access);
    sessionStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  },
};

let requestSeq = 0;

export const api: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  // X-Request-ID for log correlation (project invariant §10)
  config.headers = config.headers ?? {};
  if (!config.headers['X-Request-ID']) {
    config.headers['X-Request-ID'] = `webadmin-${Date.now()}-${requestSeq++}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = tokenStore.getRefresh();
    if (!refresh) return null;
    try {
      const resp = await axios.post('/api/v1/auth/refresh', { refresh_token: refresh }, { timeout: 10000 });
      const { access_token, refresh_token: newRefresh } = resp.data?.data ?? resp.data;
      tokenStore.setAccess(access_token);
      if (newRefresh) {
        sessionStorage.setItem(REFRESH_KEY, newRefresh);
      }
      return access_token as string;
    } catch {
      tokenStore.clear();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Returns a human-readable error message from the envelope. */
export function extractError(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.error?.details) return body.error.details;
    if (body?.error?.code) return body.error.code;
    if (error.code === 'ECONNABORTED') return 'Request timed out';
    if (!error.response) return 'Cannot reach the server';
    if (error.response.status === 429) return 'Rate limit exceeded — please retry shortly';
    if (error.response.status === 403) return 'You do not have permission to do this';
  }
  return fallback;
}

api.interceptors.response.use(
  resp => resp,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (status === 401 && original && !original._retry) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
      // Session is dead — force the login screen.
      tokenStore.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

/** Unwrap the { data } envelope. */
export async function unwrap<T>(promise: Promise<{ data: ApiSuccess<T> | T }>): Promise<T> {
  const resp = await promise;
  const payload = resp.data;
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}
