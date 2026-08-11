/**
 * Shared API types — mirrors plans/30-mobile-api-contract.md response envelope
 * (success { data, message }, error { error: { code, details, request_id } }).
 */

export interface ApiSuccess<T> {
  data: T;
  message?: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    details: string;
    request_id: string;
  };
}

export type UserRole = 'user' | 'family' | 'nurse' | 'admin';

export interface User {
  id: string;
  email?: string | null;
  phone_number?: string | null;
  display_name?: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  provider: string;
  created_at: string;
  last_login_at?: string | null;
  onboarding_completed: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse {
  user: User;
  tokens: TokenPair;
  requires_mfa: boolean;
}

export interface AdminUser {
  id: string;
  phone_number: string;
  display_name?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Analytics {
  total_users: number;
  active_users: number;
  sos_count: number;
  pregnancy_count: number;
  nurse_count: number;
}

export interface BroadcastResult {
  message: string;
  recipient_count: number;
}

export type ContentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'unpublished';

export interface ContentItem {
  id: string;
  nurse_id: string;
  title: string;
  description?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  category: string;
  tags: string[];
  status: ContentStatus;
  published_at?: string | null;
  created_at: string;
}

export interface ContentPayload {
  title: string;
  description?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  category: string;
  tags: string[];
}

export interface UploadUrlResponse {
  upload_url: string;
  cloud_name: string;
  api_key: string;
  timestamp: number;
  folder: string;
  tags: string;
  signature: string;
  expires_at?: number | null;
}
