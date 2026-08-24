import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { diaryService } from '../api/diary';
import { diaryLocal } from '../localDb';
import { emitDiaryPageCreated } from '../diary/diaryEvents';
import { logger } from 'src/utils';

export function useDiaries() {
  return useQuery({
    queryKey: ['diaries'],
    queryFn: () => diaryService.getDiaries(),
    staleTime: 5 * 60_000,
  });
}

export function useDiary(id: string) {
  return useQuery({
    queryKey: ['diary', id],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        return await diaryService.getDiary(id);
      } catch (error) {
        // Stale local diary that no longer exists on the server (e.g. created
        // before the backend had diary tables, or deleted on another device).
        // Drop the orphaned local row so the app can't keep navigating to it.
        const status = (error as AxiosError)?.response?.status;
        if (status === 404) {
          logger.warn('Diary 404 on server — removing stale local diary', { diaryId: id });
          try {
            await diaryLocal.diary.hardDelete(id);
          } catch {
            // Local cleanup is best-effort.
          }
        }
        throw error;
      }
    },
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

export function useDiaryPages(diaryId: string, opts?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['diary_pages', diaryId, opts?.limit ?? 50, opts?.offset ?? 0],
    queryFn: () => diaryService.getPages(diaryId, opts),
    staleTime: 5 * 60_000,
  });
}

export function useDiaryPage(diaryId: string, pageId: string) {
  return useQuery({
    queryKey: ['diary_page', pageId],
    queryFn: () => diaryService.getPage(diaryId, pageId),
    staleTime: 5 * 60_000,
  });
}

export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { diary_id: string; page_date: string }) =>
      diaryService.createPage(payload.diary_id, { page_date: payload.page_date }),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['diary_pages', variables.diary_id] });
      emitDiaryPageCreated({
        diaryId: variables.diary_id,
        pageId: data?.id,
        page_date: variables.page_date,
      });
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
    staleTime: 60_000,
  });
}

export function useDiaryTimeline(year: number, month: number) {
  return useQuery({
    queryKey: ['diary_timeline', year, month],
    queryFn: () => diaryService.getTimeline(year, month),
    staleTime: 5 * 60_000,
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
