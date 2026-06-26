import { useQuery } from '@tanstack/react-query';

import { nurseContentService } from 'src/services/api';

export const nurseContentKeys = {
  all: ['nurseContent'] as const,
  list: ['nurseContent', 'list'] as const,
  detail: (id: string) => ['nurseContent', 'detail', id] as const,
};

export function useContents(params?: { page?: number; per_page?: number }) {
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
