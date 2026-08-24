/**
 * Phase H.2 — SQLite → React Query cache hydration.
 *
 * Reads the user's offline rows out of SQLite at app start and seeds the
 * React Query cache with them. The hydrated data must match the server
 * response shape EXACTLY (drop SQLite-only columns via mappers), otherwise
 * the cache entry is invalid for `placeholderData` consumers.
 *
 * Privacy note: only rows the user already owns are read; nothing is written
 * out of React Query into plaintext AsyncStorage (see ADR 0007).
 */

import { queryClient } from 'src/app/providers';
import { localDb, diaryLocal } from 'src/services/localDb';
import { getWellnessKeys } from './wellness';
import type { JournalEntry, MoodLog } from 'src/services/api/wellness';
import type {
  JournalEntry as LocalJournalEntry,
  MoodLog as LocalMoodLog,
  Diary as LocalDiary,
} from 'src/db/schema';

interface ServerDiary {
  id: string;
  title: string;
  cover_color: string;
  texture_id: string | null;
  font_id: string | null;
  page_count: number;
  is_locked: boolean;
  lock_type: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

function toJournalEntry(row: LocalJournalEntry): JournalEntry {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title ?? null,
    content: row.content ?? '',
    mood: row.mood ?? null,
    sentiment_score: row.sentiment_score ?? null,
    sentiment_label: row.sentiment_label ?? null,
    entry_date: row.entry_date ?? '',
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}

function toMoodLog(row: LocalMoodLog): MoodLog {
  return {
    id: row.id,
    user_id: row.user_id,
    mood: row.mood,
    intensity: row.intensity,
    notes: row.notes ?? null,
    logged_at: row.logged_at ?? '',
  };
}

function toDiary(row: LocalDiary): ServerDiary {
  return {
    id: row.id,
    title: row.title,
    cover_color: row.cover_color,
    texture_id: row.texture_id ?? null,
    font_id: row.font_id ?? null,
    page_count: row.page_count,
    is_locked: row.is_locked,
    lock_type: row.lock_type ?? null,
    is_active: row.is_active,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function hydrateFromSqlite(userId: string): Promise<void> {
  const keys = getWellnessKeys(userId);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const now = new Date().toISOString();

  const [journalRows, moodRows, diaries] = await Promise.all([
    localDb.journal.getRecent(userId, 50),
    localDb.mood.getByDateRange(userId, monthAgo, now),
    diaryLocal.diary.getByUser(userId),
  ]);

  if (journalRows.length > 0) {
    queryClient.setQueryData<JournalEntry[]>(
      [...keys.journal, { page: 0, per_page: 50 }],
      journalRows.map(toJournalEntry),
    );
    queryClient.invalidateQueries({ queryKey: keys.journal });
  }

  if (moodRows.length > 0) {
    queryClient.setQueryData<MoodLog[]>(
      [...keys.moodLogs, { per_page: 60 }],
      moodRows.map(toMoodLog),
    );
    queryClient.invalidateQueries({ queryKey: keys.moodLogs });
  }

  if (diaries.length > 0) {
    queryClient.setQueryData<ServerDiary[]>(['diaries'], diaries.map(toDiary));
    queryClient.invalidateQueries({ queryKey: ['diaries'] });
  }
}