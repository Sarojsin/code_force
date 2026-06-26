import { api, tokenStore, ApiSuccess } from './client';
import { LoginResponse, OTPRequestResponse, RegisterRequest, TokenPair, User } from 'src/types/auth';

export interface DeviceRegisterRequest {
  fcm_token: string;
  platform: 'ios' | 'android';
  device_info?: Record<string, unknown>;
}

export interface DeviceRegisterResponse {
  message: string;
  fcm_token_prefix: string;
}

export const authService = {
  async register(data: RegisterRequest): Promise<LoginResponse> {
    const resp = await api.post<ApiSuccess<LoginResponse> | LoginResponse>('/auth/register', data);
    const payload = unwrap<LoginResponse>(resp.data);
    await tokenStore.setBoth(payload.tokens.access_token, payload.tokens.refresh_token);
    return payload;
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const resp = await api.post<ApiSuccess<LoginResponse> | LoginResponse>('/auth/login', { email, password });
    const payload = unwrap<LoginResponse>(resp.data);
    await tokenStore.setBoth(payload.tokens.access_token, payload.tokens.refresh_token);
    return payload;
  },

  async requestOtp(phone: string): Promise<OTPRequestResponse> {
    const resp = await api.post<ApiSuccess<OTPRequestResponse> | OTPRequestResponse>(
      '/auth/otp/request',
      { phone },
    );
    return unwrap<OTPRequestResponse>(resp.data);
  },

  async verifyOtp(phone: string, otp: string): Promise<LoginResponse> {
    const resp = await api.post<ApiSuccess<LoginResponse> | LoginResponse>('/auth/otp/verify', {
      phone,
      otp,
    });
    const payload = unwrap<LoginResponse>(resp.data);
    await tokenStore.setBoth(payload.tokens.access_token, payload.tokens.refresh_token);
    return payload;
  },

  async getMe(): Promise<User> {
    const resp = await api.get<ApiSuccess<User> | User>('/auth/me');
    return unwrap<User>(resp.data);
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      await tokenStore.clear();
    }
  },

  async refresh(): Promise<TokenPair | null> {
    const refresh = await tokenStore.getRefresh();
    if (!refresh) return null;
    const resp = await api.post<ApiSuccess<TokenPair> | TokenPair>('/auth/refresh', {
      refresh_token: refresh,
    });
    return unwrap<TokenPair>(resp.data);
  },

  async registerDevice(data: DeviceRegisterRequest): Promise<DeviceRegisterResponse> {
    const resp = await api.post<ApiSuccess<DeviceRegisterResponse> | DeviceRegisterResponse>('/auth/device/register', data);
    return unwrap<DeviceRegisterResponse>(resp.data);
  },
};

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}
