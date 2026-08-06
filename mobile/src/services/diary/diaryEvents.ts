import { eventBus } from '../eventBus';
import { useAuthStore } from 'src/stores/authStore';

/**
 * Guarded diary event emitters (luna2 phase5 §1). Each emit is wrapped so a
 * diary feature being disabled, an unauthenticated session, or a throwing
 * listener can never break the diary flow — mirroring how Journal/Mood
 * `*_logged` events are emitted, but kept in the diary module's service layer
 * so the event strings live in diary source (emitter-existence tests).
 */
function resolveUserId(explicit?: string): string | null {
  return explicit ?? useAuthStore.getState().user?.id ?? null;
}

function guarded(emit: () => void): void {
  try {
    emit();
  } catch {
    // diary events must never throw out of a mutation path
  }
}

export function emitDiaryPageCreated(payload: {
  userId?: string;
  diaryId: string;
  pageId: string;
  page_date: string;
}): void {
  guarded(() => {
    const userId = resolveUserId(payload.userId);
    if (!userId) return;
    eventBus.emit('diary_page_created', {
      userId,
      diaryId: payload.diaryId,
      pageId: payload.pageId,
      page_date: payload.page_date,
    });
  });
}

export function emitDiaryPhotoAdded(payload: {
  userId?: string;
  mediaId: string;
  mimeType?: string;
}): void {
  guarded(() => {
    const userId = resolveUserId(payload.userId);
    if (!userId) return;
    eventBus.emit('diary_photo_added', {
      userId,
      mediaId: payload.mediaId,
      mimeType: payload.mimeType,
    });
  });
}

export function emitDiaryPageSaved(payload: {
  userId?: string;
  diaryId: string;
  pageId: string;
}): void {
  guarded(() => {
    const userId = resolveUserId(payload.userId);
    if (!userId) return;
    eventBus.emit('diary_page_saved', {
      userId,
      diaryId: payload.diaryId,
      pageId: payload.pageId,
    });
  });
}

export function emitDiaryOpened(payload: {
  userId?: string;
  diaryId: string;
  pageId: string;
}): void {
  guarded(() => {
    const userId = resolveUserId(payload.userId);
    if (!userId) return;
    eventBus.emit('diary_opened', {
      userId,
      diaryId: payload.diaryId,
      pageId: payload.pageId,
    });
  });
}

export function emitDiaryMediaSynced(payload: {
  userId?: string;
  mediaId: string;
  s3Key?: string;
}): void {
  guarded(() => {
    const userId = resolveUserId(payload.userId);
    if (!userId) return;
    eventBus.emit('diary_media_synced', {
      userId,
      mediaId: payload.mediaId,
      s3Key: payload.s3Key,
    });
  });
}

export const DIARY_EVENT_NAMES = [
  'diary_page_created',
  'diary_photo_added',
  'diary_page_saved',
  'diary_opened',
  'diary_media_synced',
] as const;
