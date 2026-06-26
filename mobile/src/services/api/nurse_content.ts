import { api, ApiSuccess } from './client';

export interface NurseContent {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags?: string[] | null;
  published_at: string;
}

export interface NurseContentDetail extends NurseContent {
  body: string;
  references?: string[] | null;
  updated_at: string;
}

interface PaginationParams {
  page?: number;
  per_page?: number;
}

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

export const nurseContentService = {
  async getContents(params?: PaginationParams): Promise<NurseContent[]> {
    const resp = await api.get<ApiSuccess<NurseContent[]> | NurseContent[]>('/nurse/contents', { params });
    return unwrap(resp.data);
  },

  async getContentDetail(id: string): Promise<NurseContentDetail> {
    const resp = await api.get<ApiSuccess<NurseContentDetail> | NurseContentDetail>(`/nurse/contents/${id}`);
    return unwrap(resp.data);
  },
};
