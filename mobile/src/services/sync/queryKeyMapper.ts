import { useAuthStore } from 'src/stores/authStore';

const TYPE_TO_QUERY_KEY: Record<string, string[]> = {
  'journal/create': ['wellness', 'journal'],
  'journal/update': ['wellness', 'journal'],
  'mood/create': ['wellness', 'moodLogs'],
  'breathing/complete': ['wellness', 'breathing'],
  'cycle/create': ['cycle', 'entries'],
  'cycle/update': ['cycle', 'entries'],
  'cycle/correction': ['cycle', 'calendar'],
  'cycle/snooze': ['cycle', 'calendar'],
  'cycle/day': ['cycle', 'days'],
  'safety/contact/create': ['safety', 'contacts'],
  'safety/contact/update': ['safety', 'contacts'],
  'safety/contact/delete': ['safety', 'contacts'],
  'safety/sos/trigger': ['safety', 'activeSos', 'safety', 'sosHistory'],
};

/**
 * Cycle query keys are user-scoped (§ sister isolation) — they live at
 * ['cycle', <userId>, <resource>]. This mirrors the getCycleKeys() factory in
 * src/services/queries/cycle.ts WITHOUT importing it, so this module stays
 * dependency-light (safe to require() from the sync engine).
 */
function scopeCycleKeys(base: string[]): string[] {
  if (base[0] !== 'cycle') return base;
  const userId = useAuthStore.getState().user?.id ?? 'guest';
  const resource = base[1] ?? '';
  if (resource) return ['cycle', userId, resource];
  return ['cycle', userId];
}

export function inferBaseQueryKey(type: string): string[] {
  return scopeCycleKeys(TYPE_TO_QUERY_KEY[type] ?? []);
}

export function inferQueryKey(type: string, entityId: string): string[] {
  const base = TYPE_TO_QUERY_KEY[type];
  if (!base) return [];
  return [...scopeCycleKeys(base), entityId];
}
