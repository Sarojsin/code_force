import { toLocalDateStr } from 'src/utils/date';

export interface BackfillCard {
  monthLabel: string;
  expectedStart: string;
  expectedEnd: string;
}

export function getBackfillCards(
  entries: Array<{ period_start_date: string; cycle_type?: string }>,
  today: Date,
  avgCycle?: number,
): BackfillCard[] {
  const lastEntry = entries?.[0];
  if (!lastEntry) return [];
  if (lastEntry.cycle_type === 'anovulatory') return [];
  const lastStart = new Date(lastEntry.period_start_date + 'T00:00:00');
  const todayNorm = new Date(today);
  todayNorm.setHours(0, 0, 0, 0);
  const daysSince = Math.round((todayNorm.getTime() - lastStart.getTime()) / 86400000);
  if (daysSince < 56) return [];

  // Derive the user's real average cycle from consecutive gaps in [20, 45]
  // (same rule as the backend) — fall back to 28 only when unknown.
  const effective = avgCycle ?? (() => {
    const gaps: number[] = [];
    for (let i = 1; i < (entries?.length ?? 1); i++) {
      const gap = Math.round(
        (new Date(entries[i - 1].period_start_date + 'T00:00:00').getTime()
          - new Date(entries[i].period_start_date + 'T00:00:00').getTime()) / 86400000,
      );
      if (gap >= 20 && gap <= 45) gaps.push(gap);
    }
    return gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 28;
  })();

  const missedCycles = Math.min(3, Math.floor(daysSince / effective) - 1);
  if (missedCycles <= 0) return [];
  const cards: BackfillCard[] = [];
  for (let i = 0; i < missedCycles; i++) {
    const cycleStart = new Date(lastStart.getTime() + (missedCycles - i) * effective * 86400000);
    const cycleEnd = new Date(cycleStart.getTime() + 4 * 86400000);
    const monthLabel = cycleStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    cards.push({
      monthLabel,
      expectedStart: toLocalDateStr(cycleStart),
      expectedEnd: toLocalDateStr(cycleEnd),
    });
  }
  return cards;
}
