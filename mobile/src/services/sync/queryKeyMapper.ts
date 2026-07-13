const TYPE_TO_QUERY_KEY: Record<string, string[]> = {
  'journal/create': ['wellness', 'journal'],
  'journal/update': ['wellness', 'journal'],
  'mood/create': ['wellness', 'moodLogs'],
  'breathing/complete': ['wellness', 'breathing'],
  'cycle/create': ['cycle', 'entries'],
  'cycle/update': ['cycle', 'entries'],
  'cycle/correction': ['cycle', 'calendar', 'cycle', 'predictions'],
  'cycle/snooze': ['cycle', 'calendar'],
  'safety/contact/create': ['safety', 'contacts'],
  'safety/contact/update': ['safety', 'contacts'],
  'safety/contact/delete': ['safety', 'contacts'],
  'safety/sos/trigger': ['safety', 'activeSos', 'safety', 'sosHistory'],
};

export function inferBaseQueryKey(type: string): string[] {
  return TYPE_TO_QUERY_KEY[type] ?? [];
}

export function inferQueryKey(type: string, entityId: string): string[] {
  const base = TYPE_TO_QUERY_KEY[type];
  if (!base) return [];
  return [...base, entityId];
}
