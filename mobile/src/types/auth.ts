export type UserRole = 'user' | 'family' | 'nurse' | 'admin';

export interface User {
  id: string;
  email: string | null;
  phone_number: string | null;
  display_name: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  provider: 'local' | 'google';
  created_at: string;
  last_login_at: string | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface OTPRequestResponse {
  message: string;
  expires_in: number;
  dev_code?: string | null;
}

export interface LoginResponse {
  user: User;
  tokens: TokenPair;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}
