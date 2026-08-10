import { useQuery } from '@tanstack/react-query';

import { nurseContentService } from 'src/services/api';
import type { ContentType } from 'src/services/api/nurse_content';

export const nurseContentKeys = {
  all: ['nurseContent'] as const,
  list: ['nurseContent', 'list'] as const,
  detail: (id: string) => ['nurseContent', 'detail', id] as const,
};

export interface ContentListParams {
  limit?: number;
  offset?: number;
  category?: string;
  content_type?: ContentType;
}

export function useContents(params?: ContentListParams) {
  return useQuery({
    queryKey: [...nurseContentKeys.list, params],
    queryFn: () => nurseContentService.getContents(params),
  });
}

export function useContentDetail(id: string) {
  return useQuery({
    queryKey: nurseContentKeys.detail(id),
    queryFn: () => nurseContentService.getContentDetail(id),
    enabled: !!id,
  });
}
