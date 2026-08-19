import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import {
  cycleService,
  CycleEntry,
  DailyDay,
  DayUpsertPayload,
  MedicationMaster,
  SymptomMaster,
} from 'src/services/api';
import { useAuthStore } from 'src/stores/authStore';
import { useOfflineStore } from 'src/stores/offlineStore';
import { useEndDateStore } from 'src/stores/endDateStore';
import { isNetworkError } from 'src/services/sync';
import { eventBus } from 'src/services/eventBus';
import { scheduleEndDateNotification } from 'src/services/endDateNotifications';
import { calculateCyclePhases, applyPhaseToDays, toLocalDateStr, parseISODateLocal, extendPeriodBlock } from 'src/utils';
import { generateId } from 'src/utils';
import { localDb } from 'src/services/localDb';
import type { CycleDay } from 'src/db/schema';

import { upsertCycleEntry, upsertSnoozeEvent, upsertCycleDay } from 'src/services/localDb/writeThroughHelpers';
import { getWellnessKeys } from './wellness';

/**
 * Scoped React Query keys. CYCLE CACHE IS STRICTLY PER-USER (§3 rule 1 +
 * signin_signout "sister" isolation). Never key cycle queries with a static
 * prefix — always scope by user.id, otherwise User A's cached calendar is
 * served to User B. Invalidations must use the SAME factory so they match.
 */
export interface CycleKeys {
  all: readonly string[];
  entries: readonly string[];
  predictions: readonly string[];
  predictionHistory: readonly string[];
  calendar: readonly string[];
  analytics: readonly string[];
  days: readonly string[];
  symptoms: readonly string[];
  medications: readonly string[];
  reports: readonly string[];
}

export function getCycleKeys(userId?: string | null): CycleKeys {
  const id = userId ?? 'guest';
  return {
    all: ['cycle', id],
    entries: ['cycle', id, 'entries'],
    predictions: ['cycle', id, 'predictions'],
    predictionHistory: ['cycle', id, 'predictions', 'history'],
    calendar: ['cycle', id, 'calendar'],
    analytics: ['cycle', id, 'analytics'],
    days: ['cycle', id, 'days'],
    symptoms: ['cycle', id, 'symptoms'],
    medications: ['cycle', id, 'medications'],
    reports: ['cycle', id, 'reports'],
  };
}

/**
 * Shared base params for `useCycleEntries` (Phase D.2.3). Callers intentionally
 * pass different limits, so each distinct params object is its own cache entry
 * under `[...entries, params]` — keep the parameter sets bounded and reused
 * where the screen needs the same window (Calendar + Analytics overlap on the
 * 6-month window; CycleHistory needs more history; useCatchUp only the latest).
 */
export const CYCLE_ENTRIES_WINDOW = { months_back: 6, limit: 60 } as const;

/** Per-entry report key: `['cycle', id, 'reports', entryId]`. */
export function getCycleReportKey(
  userId: string | null | undefined,
  entryId: string | null,
): readonly string[] {
  return [...getCycleKeys(userId).reports, entryId ?? 'none'];
}

/** Scoped keys for the currently-authenticated user (mutation/invalidation use). */
function useCycleKeys(): CycleKeys {
  const userId = useAuthStore((s) => s.user?.id);
  return getCycleKeys(userId);
}

export function useCycleEntries(params?: { limit?: number; offset?: number; months_back?: number }) {
  const keys = useCycleKeys();
  return useQuery({
    queryKey: [...keys.entries, params],
    queryFn: () => cycleService.getEntries(params),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useCreateCycleEntry() {
  const qc = useQueryClient();
  const keys = useCycleKeys();
  return useMutation({
    mutationFn: (data: Partial<CycleEntry>) => cycleService.createEntry(data),
    onSuccess: (result) => {
      upsertCycleEntry(result as unknown as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: keys.entries });
      qc.invalidateQueries({ queryKey: keys.calendar });
      qc.invalidateQueries({ queryKey: keys.predictions });
      qc.invalidateQueries({ queryKey: keys.analytics });
    },
    onError: (error, data) => {
      if (isNetworkError(error)) {
        const tempId = generateId();
        useOfflineStore.getState().enqueue({
          type: 'cycle/create',
          endpoint: '/api/v1/cycle/entries',
          data,
          tempId,
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(keys.entries, (old: any) => {
          if (!old) return [{ ...data, id: tempId, _optimistic: true }];
          if (Array.isArray(old)) return [{ ...data, id: tempId, _optimistic: true }, ...old];
          return old;
        });
      } else {
        const errPayload = (error as any)?.response?.data;
        const details = errPayload?.error?.details;
        const code = errPayload?.error?.code;
        if (code === 'PERIOD_END_DATE_REQUIRED' || (details && details.length > 0)) {
          Toast.show({ type: 'error', text1: details || code || 'Failed to save' });
        } else {
          Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to save' });
        }
      }
    },
  });
}

export function useUpdateCycleEntry() {
  const qc = useQueryClient();
  const keys = useCycleKeys();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CycleEntry> }) =>
      cycleService.updateEntry(id, data),
    onMutate: async ({ id, data }) => {
      // Optimistically update the calendar when an end date is set on an open entry.
      if (data.period_end_date) {
        await qc.cancelQueries({ queryKey: keys.calendar });
        const previousCalendar = qc.getQueryData([...keys.calendar, 3, 3]);
        qc.setQueryData([...keys.calendar, 3, 3], (old: any) => {
          if (!old?.days) return old;
          const entry = Array.isArray(qc.getQueryData(keys.entries))
            ? (qc.getQueryData(keys.entries) as any[]).find((e: any) => e.id === id)
            : undefined;
          const start = entry?.period_start_date
            ? parseISODateLocal(entry.period_start_date)
            : null;
          const end = data.period_end_date ? parseISODateLocal(data.period_end_date) : null;
          if (!start || !end || end <= start) return old;
          const cycleLength = 28;
          const days = extendPeriodBlock(old.days, start, end, cycleLength);
          return { ...old, days, needs_checkin: false, _optimistic: true };
        });
        return { previousCalendar };
      }
      return undefined;
    },
    onSuccess: (result) => {
      upsertCycleEntry(result as unknown as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: keys.entries });
      qc.invalidateQueries({ queryKey: keys.calendar });
      qc.invalidateQueries({ queryKey: keys.predictions });
      qc.invalidateQueries({ queryKey: keys.analytics });
      qc.invalidateQueries({ queryKey: keys.predictionHistory });
    },
    onError: (error, variables, context: any) => {
      if (isNetworkError(error)) {
        useOfflineStore.getState().enqueue({
          type: 'cycle/update',
          endpoint: `/api/v1/cycle/entries/${variables.id}`,
          data: { id: variables.id, ...variables.data },
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(keys.entries, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((item: any) => item.id === variables.id ? { ...item, ...variables.data, _optimistic: true } : item);
        });
        return;
      }

      // 409 conflict — apply server's data to cache
      if ((error as any)?.response?.status === 409) {
        const serverData = (error as any)?.response?.data;
        if (serverData?.data?.days) {
          qc.setQueryData([...keys.calendar, 3, 3], serverData.data);
          Toast.show({ type: 'info', text1: 'Updated from another device' });
        } else {
          qc.invalidateQueries({ queryKey: keys.calendar });
          Toast.show({ type: 'info', text1: 'Updated from another device' });
        }
        return;
      }

      // Rollback on other errors
      if (context?.previousCalendar) {
        qc.setQueryData([...keys.calendar, 3, 3], context.previousCalendar);
      }
      Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to update' });
    },
  });
}

export function useCyclePredictions() {
  const keys = useCycleKeys();
  return useQuery({
    queryKey: keys.predictions,
    queryFn: () => cycleService.getPredictions(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function usePredictionHistory(limit = 12) {
  const keys = useCycleKeys();
  return useQuery({
    queryKey: [...keys.predictionHistory, limit],
    queryFn: () => cycleService.getPredictionHistory(limit),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCycleCalendar(monthsBack = 3, monthsForward = 3) {
  const keys = useCycleKeys();
  return useQuery({
    queryKey: [...keys.calendar, monthsBack, monthsForward],
    queryFn: () =>
      cycleService.getCalendar(monthsBack, monthsForward, toLocalDateStr(new Date())),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useCycleAnalytics() {
  const keys = useCycleKeys();
  return useQuery({
    queryKey: keys.analytics,
    queryFn: () => cycleService.getAnalytics(),
    staleTime: 10 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Cycle reports (Cycle_Report-as-a-Service)
// ---------------------------------------------------------------------------

/** Latest stored report; `null` until one is ready (ReportEmptyResponse). */
export function useLatestCycleReport() {
  const keys = useCycleKeys();
  return useQuery({
    queryKey: keys.reports,
    queryFn: () => cycleService.getLatestReport(),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

/** Enqueue report generation for a closed cycle; invalidate the report cache. */
export function useRequestCycleReport() {
  const qc = useQueryClient();
  const keys = useCycleKeys();
  return useMutation({
    mutationFn: (cycleEntryId: string) => cycleService.requestReport(cycleEntryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.reports });
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to generate report' });
    },
  });
}

/**
 * Stored report for ONE cycle (DB-only read — no LLM). Returns `null` until a
 * report exists for that entry. Keyed per entry so each history row caches
 * independently. When ``cycleEntryId`` is null the query is disabled — no
 * HTTP request is fired for an unselected cycle.
 */
export function useCycleReport(cycleEntryId: string | null) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: getCycleReportKey(userId, cycleEntryId),
    queryFn: () => cycleService.getReportForEntry(cycleEntryId as string),
    enabled: !!userId && !!cycleEntryId,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

/**
 * On-demand DB-first generation for one cycle. If a ready report already
 * exists the backend returns it without calling Groq; only a miss triggers
 * inline LLM generation. Invalidates both the per-entry and latest caches.
 */
export function useRequestCycleReportSync() {
  const qc = useQueryClient();
  const keys = useCycleKeys();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: (cycleEntryId: string) => cycleService.requestReportSync(cycleEntryId),
    onSuccess: (report, cycleEntryId) => {
      qc.setQueryData(getCycleReportKey(userId, cycleEntryId), report);
      qc.invalidateQueries({ queryKey: keys.reports });
    },
    onError: (error) => {
      Toast.show({
        type: 'error',
        text1: error instanceof Error ? error.message : 'Failed to generate report',
      });
    },
  });
}

export function useLogCorrection() {
  const qc = useQueryClient();
  const keys = useCycleKeys();

  return useMutation({
    mutationFn: (data: {
      period_start_date: string;
      period_end_date?: string;
      symptoms?: string[];
      corrected_prediction_id?: string | null;
      cycle_type?: string;
    }) => cycleService.logCorrection(
      data,
      generateId(),
      new Date().toISOString(),
    ),

    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: keys.calendar });
      const previous = qc.getQueryData([...keys.calendar, 3, 3]);

      qc.setQueryData([...keys.calendar, 3, 3], (old: any) => {
        if (!old?.days) return old;
        const days: Record<string, string> = { ...old.days };

        // Estimate period length from cached prediction, or fall back to 5
        const cachedAvgLen = (() => {
          if (old.predictions?.predicted_period_end && old.predictions?.predicted_next_period_start) {
            const s = parseISODateLocal(old.predictions.predicted_next_period_start);
            const e = parseISODateLocal(old.predictions.predicted_period_end);
            const est = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
            if (est >= 1 && est <= 14) return est;
          }
          return 5;
        })();

        const periodStart = parseISODateLocal(variables.period_start_date);
        const periodEnd = variables.period_end_date
          ? parseISODateLocal(variables.period_end_date)
          : new Date(periodStart.getTime() + cachedAvgLen * 86400000);
        const periodLength = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;

        let cycleLength = 28;
        if (old.predictions?.predicted_next_period_start) {
          const predStart = parseISODateLocal(old.predictions.predicted_next_period_start);
          const diff = Math.round((predStart.getTime() - periodStart.getTime()) / 86400000);
          if (diff > 0 && diff < 60) {
            cycleLength = diff;
          }
        }

        // 1. Cancel old predicted period days near the correction date → c
        for (const [key, code] of Object.entries(days)) {
          if (code === 'p') {
            const dayDate = parseISODateLocal(key);
            const diffFromStart = Math.round((periodStart.getTime() - dayDate.getTime()) / 86400000);
            if (diffFromStart >= -14 && diffFromStart <= 10) {
              days[key] = 'c';
            }
          }
        }

        // 2. Add confirmed phases for the corrected cycle → P, F, O, L
        const confirmedPhases = calculateCyclePhases(periodStart, cycleLength, periodLength);
        applyPhaseToDays(days, confirmedPhases, 'P');

        // 3. Project next predicted cycle → p, f, o, l
        const nextPeriodStart = new Date(periodStart.getTime() + cycleLength * 86400000);
        const nextPhases = calculateCyclePhases(nextPeriodStart, cycleLength, cachedAvgLen);
        applyPhaseToDays(days, nextPhases, 'p');

        // 4. Update predictions and next_period_in_days for immediate UI refresh
        const today = new Date();
        const nextPeriodInDays = Math.max(0, Math.round((nextPeriodStart.getTime() - today.getTime()) / 86400000));
        const updatedPredictions = old.predictions ? {
          ...old.predictions,
          predicted_next_period_start: toLocalDateStr(nextPeriodStart),
          predicted_period_end: toLocalDateStr(new Date(nextPeriodStart.getTime() + cachedAvgLen * 86400000)),
        } : old.predictions;

        return { ...old, days, predictions: updatedPredictions, next_period_in_days: nextPeriodInDays, needs_checkin: false, _optimistic: true };
      });

      return { previousCalendar: previous };
    },

    onSuccess: (result, variables) => {
      if (result && result.id) {
        upsertCycleEntry(result);
      }
      qc.invalidateQueries({ queryKey: keys.calendar });
      qc.invalidateQueries({ queryKey: keys.predictions });
      qc.invalidateQueries({ queryKey: keys.entries });
      qc.invalidateQueries({ queryKey: keys.analytics });
      qc.invalidateQueries({ queryKey: keys.predictionHistory });

      // If correction was sent without end_date, set pending end-date notification
      if (!variables.period_end_date && result?.id && result?.avg_period_length) {
        const endDateStore = useEndDateStore.getState();
        const predictionId = variables.corrected_prediction_id ?? null;
        endDateStore.setPending(result.id, variables.period_start_date, predictionId, result.avg_period_length);
        scheduleEndDateNotification(variables.period_start_date, result.avg_period_length).then((nid) => {
          if (nid) useEndDateStore.getState().setNotificationId(nid);
        });
      }

      Toast.show({ type: 'success', text1: 'Period corrected — predictions updated' });
    },

    onError: (error, variables, context) => {
      // 409 conflict — apply server's data to cache
      if ((error as any)?.response?.status === 409) {
        const serverData = (error as any)?.response?.data;
        if (serverData?.data?.days) {
          qc.setQueryData([...keys.calendar, 3, 3], serverData.data);
          Toast.show({ type: 'info', text1: 'Updated from another device' });
        } else {
          qc.invalidateQueries({ queryKey: keys.calendar });
          Toast.show({ type: 'info', text1: 'Updated from another device' });
        }
        return;
      }

      if (isNetworkError(error)) {
        useOfflineStore.getState().enqueue({
          type: 'cycle/correction',
          endpoint: '/api/v1/cycle/corrections',
          data: variables,
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(keys.calendar, (old: any) => {
          if (!old) return old;
          return { ...old, _correction: variables, _optimistic: true };
        });
      } else {
        // Rollback on other errors
        if (context?.previousCalendar) {
          qc.setQueryData([...keys.calendar, 3, 3], context.previousCalendar);
        }
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to save correction' });
      }
    },
  });
}

export function useLogSnooze() {
  const qc = useQueryClient();
  const keys = useCycleKeys();
  return useMutation({
    mutationFn: ({ predictedCycleId, dayOffset }: { predictedCycleId: string; dayOffset: number }) =>
      cycleService.logSnooze(predictedCycleId, dayOffset),
    onSuccess: (result) => {
      if (result && result.id) {
        upsertCycleEntry(result);
        upsertSnoozeEvent(result);
      }
      qc.invalidateQueries({ queryKey: keys.calendar });
    },
    onError: (error, variables) => {
      if (isNetworkError(error)) {
        useOfflineStore.getState().enqueue({
          type: 'cycle/snooze',
          endpoint: '/api/v1/cycle/snooze',
          data: variables,
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(keys.calendar, (old: any) => {
          if (!old) return old;
          return { ...old, _snooze: variables, _optimistic: true };
        });
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to snooze' });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Day observations (cycle_days) — DayDetailSheet (PR2)
// ---------------------------------------------------------------------------

function mergeCycleDaysByDate(local: CycleDay[] | DailyDay[], server: DailyDay[]): DailyDay[] {
  const byDate = new Map<string, DailyDay>();
  for (const d of local) {
    if (d.log_date) byDate.set(d.log_date, d as unknown as DailyDay);
  }
  for (const s of server) {
    if (s.log_date) byDate.set(s.log_date, s);
  }
  return [...byDate.values()].sort((a, b) => a.log_date.localeCompare(b.log_date));
}

/**
 * Per-user day observations for a date range. Server is the source of truth
 * when online; local SQLite rows cover offline reopen. Query key is
 * user-scoped via the `days` factory (never a static prefix).
 */
export function useCycleDays(
  range?: { start?: string; end?: string },
  options: { enabled?: boolean } = {},
) {
  const keys = useCycleKeys();
  const userId = useAuthStore((s) => s.user?.id);
  const enabled = options.enabled ?? !!range?.start;
  // Bound the query so a caller that omits a range never reads the user's full
  // local day history (Phase D.2.4). Callers pass a 1-day window when a date is
  // selected (CalendarScreen) or a month range (DailyLogScreen); an empty range
  // falls back to a 90-day default instead of an unbounded read.
  const DEFAULT_DAYS_WINDOW_DAYS = 90;
  const boundedRange = useMemo(() => {
    if (range?.start && range?.end) return range;
    if (range?.start) {
      const start = parseISODateLocal(range.start);
      return { start: range.start, end: toLocalDateStr(start) };
    }
    if (range?.end) {
      const end = parseISODateLocal(range.end);
      return { start: toLocalDateStr(new Date(end.getTime() - DEFAULT_DAYS_WINDOW_DAYS * 86400000)), end: range.end };
    }
    const today = new Date();
    return {
      start: toLocalDateStr(new Date(today.getTime() - DEFAULT_DAYS_WINDOW_DAYS * 86400000)),
      end: toLocalDateStr(today),
    };
  }, [range]);
  return useQuery({
    queryKey: [...keys.days, range],
    enabled,
    queryFn: async (): Promise<DailyDay[]> => {
      let server: DailyDay[] = [];
      if (boundedRange?.start && boundedRange?.end) {
        try {
          server = await cycleService.getDays(boundedRange.start, boundedRange.end);
        } catch {
          server = [];
        }
      }
      if (server.length > 0) {
        localDb.cycleDay.upsertMany(server as unknown as CycleDay[]);
      }
      const local = userId
        ? (await localDb.cycleDay.getByRange(userId, boundedRange?.start, boundedRange?.end)) as unknown as CycleDay[]
        : [];
      return mergeCycleDaysByDate(local, server);
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useUpsertDay() {
  const qc = useQueryClient();
  const keys = useCycleKeys();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: ({ logDate, data }: { logDate: string; data: DayUpsertPayload }) =>
      cycleService.upsertDay(logDate, data),
    onSuccess: (result, variables) => {
      upsertCycleDay(result as unknown as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: keys.days });

      const uid = useAuthStore.getState().user?.id;
      if (uid) {
        eventBus.emit('day_logged', {
          userId: uid,
          logDate: variables.logDate,
          mood: variables.data.mood ?? null,
          moodIntensity: variables.data.mood_intensity ?? null,
        });
      }

      // BRIDGE: The backend wrote to mood_logs via day_logged event.
      // Invalidate ALL wellness caches so the entire tab refreshes holistically.
      qc.invalidateQueries({ queryKey: getWellnessKeys(userId).all });
    },
    onError: (error, variables) => {
      if (isNetworkError(error)) {
        const optimistic = {
          id: `optimistic_${variables.logDate}`,
          user_id: '',
          log_date: variables.logDate,
          mood: variables.data.mood ?? null,
          mood_intensity: variables.data.mood_intensity ?? null,
          pain_level: variables.data.pain_level ?? null,
          energy_level: variables.data.energy_level ?? null,
          sleep_minutes: variables.data.sleep_minutes ?? null,
          water_glasses: variables.data.water_glasses ?? null,
          flow_level: variables.data.flow_level ?? null,
          notes: variables.data.notes ?? null,
          symptoms: (variables.data.symptoms ?? []).map((s) => ({
            id: '',
            name: s.symptom,
            category: '',
            severity: s.severity,
          })),
          medications: (variables.data.medications ?? []).map((m) => ({
            id: '',
            name: m.name,
            category: '',
            dose: m.dose ?? null,
            taken_at: m.taken_at ?? null,
          })),
          recommendations_completed: variables.data.recommendations_completed ?? [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _optimistic: true,
        } as DailyDay;
        useOfflineStore.getState().enqueue({
          type: 'cycle/day',
          endpoint: `/api/v1/cycle/days/${variables.logDate}`,
          data: { log_date: variables.logDate, ...variables.data },
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(keys.days, (old: any) => {
          if (!Array.isArray(old)) return old;
          const rest = old.filter((d: DailyDay) => d.log_date !== variables.logDate);
          return [optimistic, ...rest];
        });
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to save' });
      }
    },
  });
}

/** Symptoms master — read from local SQLite (offline-first), re-synced in background. */
export function useSymptoms() {
  const keys = useCycleKeys();
  return useQuery({
    queryKey: keys.symptoms,
    queryFn: async (): Promise<SymptomMaster[]> => {
      const local = await localDb.dayMaster.listSymptoms();
      if (local.length === 0) {
        await localDb.dayMaster.ensureSeeded();
        return localDb.dayMaster.listSymptoms();
      }
      return local;
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}

/** Medications master — read from local SQLite (offline-first), re-synced in background. */
export function useMedications() {
  const keys = useCycleKeys();
  return useQuery({
    queryKey: keys.medications,
    queryFn: async (): Promise<MedicationMaster[]> => {
      const local = await localDb.dayMaster.listMedications();
      if (local.length === 0) {
        await localDb.dayMaster.ensureSeeded();
        return localDb.dayMaster.listMedications();
      }
      return local;
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}

export async function refreshDayMastersFromServer(): Promise<void> {
  try {
    const [serverSymptoms, serverMedications] = await Promise.all([
      cycleService.getSymptoms(),
      cycleService.getMedications(),
    ]);
    await localDb.dayMaster.replaceAll(
      serverSymptoms.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        icon: s.icon ?? null,
        display_order: s.display_order,
      })),
      serverMedications.map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        display_order: m.display_order,
      })),
    );
  } catch {
    // Offline — bundled seed stays authoritative.
  }
}
