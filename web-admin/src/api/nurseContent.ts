import { api, unwrap } from './client';

import type { ContentItem, ContentPayload, UploadUrlResponse } from 'src/types/api';

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

  async getUploadUrl(resourceType: 'image' | 'video' = 'image'): Promise<UploadUrlResponse> {
    return unwrap<UploadUrlResponse>(
      api.post('/admin/contents/upload-url', null, { params: { resource_type: resourceType } }),
    );
  },

  async uploadToCloudinary(file: File, uploadData: UploadUrlResponse): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', uploadData.api_key);
    formData.append('timestamp', String(uploadData.timestamp));
    formData.append('folder', uploadData.folder);
    formData.append('tags', uploadData.tags);
    formData.append('signature', uploadData.signature);

    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const url = `https://api.cloudinary.com/v1_1/${uploadData.cloud_name}/${resourceType}/upload`;

    const resp = await fetch(url, { method: 'POST', body: formData });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Upload failed');
    }
    const data = await resp.json();
    return data.secure_url as string;
  },
};
