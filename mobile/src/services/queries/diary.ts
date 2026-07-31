import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { diaryService } from '../api/diary';

export function useDiaries() {
  return useQuery({
    queryKey: ['diaries'],
    queryFn: () => diaryService.getDiaries(),
  });
}

export function useDiary(id: string) {
  return useQuery({
    queryKey: ['diary', id],
    queryFn: () => diaryService.getDiary(id),
  });
}

export function useCreateDiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; cover_color?: string }) => diaryService.createDiary(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diaries'] }),
  });
}

export function useDeleteDiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => diaryService.deleteDiary(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diaries'] }),
  });
}

export function useDiaryPages(diaryId: string) {
  return useQuery({
    queryKey: ['diary_pages', diaryId],
    queryFn: () => diaryService.getPages(diaryId),
  });
}

export function useDiaryPage(diaryId: string, pageId: string) {
  return useQuery({
    queryKey: ['diary_page', pageId],
    queryFn: () => diaryService.getPage(diaryId, pageId),
  });
}

export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { diary_id: string; page_date: string }) =>
      diaryService.createPage(payload.diary_id, { page_date: payload.page_date }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['diary_pages', variables.diary_id] });
    },
  });
}

export function useDiarySearch(params: {
  q?: string; date?: string; tag?: string; person?: string; location?: string; weather?: string; mood?: string;
}) {
  return useQuery({
    queryKey: ['diary_search', params],
    queryFn: () => diaryService.search(params as Record<string, string | undefined>),
    enabled: Object.values(params).some(v => v !== undefined && v !== ''),
  });
}

export function useDiaryTimeline(year: number, month: number) {
  return useQuery({
    queryKey: ['diary_timeline', year, month],
    queryFn: () => diaryService.getTimeline(year, month),
  });
}

export function useCreateMedia() {
  return useMutation({
    mutationFn: (payload: { media_type: string; file_size_bytes: number; mime_type: string }) =>
      diaryService.createMedia(payload),
  });
}

export function useSyncMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { media_id: string; s3_key: string }) =>
      diaryService.updateMedia(payload.media_id, { upload_status: 'synced', s3_key: payload.s3_key }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diary_media'] }),
  });
}
