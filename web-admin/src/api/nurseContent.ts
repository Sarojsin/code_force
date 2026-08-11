import { api, unwrap } from './client';

import type { ContentItem, ContentPayload } from 'src/types/api';

export const nurseContentApi = {
  async listOwn(): Promise<ContentItem[]> {
    return unwrap<ContentItem[]>(api.get('/nurse/contents'));
  },

  async create(payload: ContentPayload): Promise<ContentItem> {
    return unwrap<ContentItem>(api.post('/nurse/contents', payload));
  },

  async update(id: string, payload: Partial<ContentPayload>): Promise<ContentItem> {
    return unwrap<ContentItem>(api.put(`/nurse/contents/${id}`, payload));
  },

  async submit(id: string): Promise<ContentItem> {
    return unwrap<ContentItem>(api.post(`/nurse/contents/${id}/submit`));
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/nurse/contents/${id}`);
  },

  async listPublic(category?: string): Promise<ContentItem[]> {
    return unwrap<ContentItem[]>(api.get('/contents', { params: { category } }));
  },
};
