import { api, ApiSuccess } from './client';

export type ContentType = 'article' | 'video' | 'image';

export interface ContentImage {
  url: string;
  public_id?: string | null;
  caption?: string | null;
  order?: number;
}

export interface NurseContent {
  id: string;
  nurse_id: string;
  title: string;
  description?: string | null;
  summary?: string | null;
  body?: string | null;
  reading_time_minutes?: number | null;
  author_name?: string | null;
  content_type: ContentType;
  video_public_id?: string | null;
  video_url?: string | null;
  video_duration_seconds?: number | null;
  thumbnail_public_id?: string | null;
  thumbnail_url?: string | null;
  images?: ContentImage[] | null;
  category: string;
  tags: string[];
  status: string;
  approved_by?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentCreate {
  title: string;
  description?: string | null;
  summary?: string | null;
  body?: string | null;
  reading_time_minutes?: number | null;
  author_name?: string | null;
  content_type?: ContentType;
  video_public_id?: string | null;
  video_url?: string | null;
  video_duration_seconds?: number | null;
  thumbnail_public_id?: string | null;
  thumbnail_url?: string | null;
  images?: ContentImage[];
  category: string;
  tags?: string[];
}

export interface ContentUpdate {
  title?: string | null;
  description?: string | null;
  summary?: string | null;
  body?: string | null;
  reading_time_minutes?: number | null;
  author_name?: string | null;
  content_type?: ContentType | null;
  video_public_id?: string | null;
  video_url?: string | null;
  video_duration_seconds?: number | null;
  thumbnail_public_id?: string | null;
  thumbnail_url?: string | null;
  images?: ContentImage[] | null;
  category?: string | null;
  tags?: string[] | null;
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

interface PaginationParams {
  limit?: number;
  offset?: number;
  category?: string;
  content_type?: ContentType;
}

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

export const nurseContentService = {
  // Public endpoints
  async getContents(params?: PaginationParams): Promise<NurseContent[]> {
    const resp = await api.get<ApiSuccess<NurseContent[]> | NurseContent[]>('/contents', { params });
    return unwrap(resp.data);
  },

  async getContentDetail(id: string): Promise<NurseContent> {
    const resp = await api.get<ApiSuccess<NurseContent> | NurseContent>('/contents/' + id);
    return unwrap(resp.data);
  },

  // Admin endpoints
  async getUploadUrl(resourceType: 'image' | 'video' = 'image'): Promise<UploadUrlResponse> {
    const resp = await api.post<ApiSuccess<UploadUrlResponse> | UploadUrlResponse>(
      '/admin/contents/upload-url',
      {},
      { params: { resource_type: resourceType } },
    );
    return unwrap(resp.data);
  },

  async createContent(data: ContentCreate): Promise<NurseContent> {
    const resp = await api.post<ApiSuccess<NurseContent> | NurseContent>('/admin/contents', data);
    return unwrap(resp.data);
  },

  async getAllContents(params?: PaginationParams): Promise<NurseContent[]> {
    const resp = await api.get<ApiSuccess<NurseContent[]> | NurseContent[]>('/admin/contents', { params });
    return unwrap(resp.data);
  },

  async updateContent(id: string, data: ContentUpdate): Promise<NurseContent> {
    const resp = await api.put<ApiSuccess<NurseContent> | NurseContent>('/admin/contents/' + id, data);
    return unwrap(resp.data);
  },

  async deleteContent(id: string): Promise<void> {
    await api.delete('/admin/contents/' + id);
  },
};
