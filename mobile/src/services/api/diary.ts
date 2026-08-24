import { api } from './client';

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

const BASE = '/diary';

export const diaryService = {
  async getDiaries(): Promise<any[]> {
    const resp = await api.get(`${BASE}/diaries`);
    return unwrap(resp.data);
  },

  async getDiary(id: string): Promise<any> {
    const resp = await api.get(`${BASE}/diaries/${id}`);
    return unwrap(resp.data);
  },

  async createDiary(data: { title: string; cover_color?: string }): Promise<any> {
    const resp = await api.post(`${BASE}/diaries`, data);
    return unwrap(resp.data);
  },

  async deleteDiary(id: string): Promise<void> {
    await api.delete(`${BASE}/diaries/${id}`);
  },

  async getPages(diaryId: string, opts?: { limit?: number; offset?: number }): Promise<any[]> {
    const resp = await api.get(`${BASE}/diaries/${diaryId}/pages`, {
      params: { limit: opts?.limit ?? 50, offset: opts?.offset ?? 0 },
    });
    return unwrap(resp.data);
  },

  async getPage(diaryId: string, pageId: string): Promise<any> {
    const resp = await api.get(`${BASE}/diaries/${diaryId}/pages/${pageId}`);
    return unwrap(resp.data);
  },

  async createPage(diaryId: string, data: { page_date: string }): Promise<any> {
    const resp = await api.post(`${BASE}/diaries/${diaryId}/pages`, data);
    return unwrap(resp.data);
  },

  async search(params: Record<string, string | undefined>): Promise<any[]> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) searchParams.set(k, v); });
    const resp = await api.get(`${BASE}/search?${searchParams}`);
    return unwrap(resp.data);
  },

  async getTimeline(year: number, month: number): Promise<any[]> {
    const resp = await api.get(`${BASE}/timeline`, { params: { year, month } });
    return unwrap(resp.data);
  },

  async createMedia(data: { media_type: string; file_size_bytes: number; mime_type: string }): Promise<any> {
    const resp = await api.post(`${BASE}/media`, data);
    return unwrap(resp.data);
  },

  async updateMedia(mediaId: string, data: Record<string, unknown>): Promise<any> {
    const resp = await api.patch(`${BASE}/media/${mediaId}`, data);
    return unwrap(resp.data);
  },

  async getUploadUrl(mediaId: string): Promise<{ url: string; key: string }> {
    const resp = await api.get(`${BASE}/media/${mediaId}/upload-url`);
    return unwrap(resp.data);
  },
};
