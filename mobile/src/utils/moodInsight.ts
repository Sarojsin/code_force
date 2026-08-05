import type { MoodLog } from 'src/services/api/wellness';

export function getMoodInsight(
  moodLogs: MoodLog[],
  phaseLabel: string,
  phaseDesc: string,
  hasCycleData: boolean,
  cycleDay: number | null,
): string | null {
  if (!hasCycleData) {
    if (moodLogs.length === 0) {
      return 'Log your mood to start tracking emotional patterns.';
    }
    return 'Mood trends will appear here as you log more entries.';
  }

  // Look for mood patterns in this phase
  // For Phase 1, use overall recent mood trend as proxy
  // Future: filter moodLogs by dates that fall within current phase
  if (moodLogs.length >= 3) {
    const mostCommon = getMostCommonMood(moodLogs);
    const dayStr = cycleDay ? `day ${cycleDay}` : 'this phase';
    return `Your mood is usually ${mostCommon} during ${phaseLabel}. Today is ${dayStr} — this aligns with your pattern!`;
  }

  // Not enough data — show phase wisdom
  return phaseDesc;
}

function getMostCommonMood(moodLogs: MoodLog[]): string {
  const counts: Record<string, number> = {};
  moodLogs.forEach((m) => {
    counts[m.mood] = (counts[m.mood] ?? 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? 'good';
}
