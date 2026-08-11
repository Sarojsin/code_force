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
  async getContents(params?: PaginationParams): Promise<NurseContent[]> {
    const resp = await api.get<ApiSuccess<NurseContent[]> | NurseContent[]>('/contents', { params });
    return unwrap(resp.data);
  },

  async getContentDetail(id: string): Promise<NurseContent> {
    const resp = await api.get<ApiSuccess<NurseContent> | NurseContent>('/contents/' + id);
    return unwrap(resp.data);
  },
};
