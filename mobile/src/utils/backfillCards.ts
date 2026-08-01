export interface BackfillCard {
  monthLabel: string;
  expectedStart: string;
  expectedEnd: string;
}

export function getBackfillCards(
  entries: Array<{ period_start_date: string; cycle_type?: string }>,
  today: Date,
): BackfillCard[] {
  const lastEntry = entries?.[0];
  if (!lastEntry) return [];
  if (lastEntry.cycle_type === 'anovulatory') return [];
  const lastStart = new Date(lastEntry.period_start_date + 'T00:00:00');
  const todayNorm = new Date(today);
  todayNorm.setHours(0, 0, 0, 0);
  const daysSince = Math.round((todayNorm.getTime() - lastStart.getTime()) / 86400000);
  if (daysSince < 56) return [];
  const avgCycle = 28;
  const missedCycles = Math.min(3, Math.floor(daysSince / avgCycle) - 1);
  if (missedCycles <= 0) return [];
  const cards: BackfillCard[] = [];
  for (let i = 0; i < missedCycles; i++) {
    const cycleStart = new Date(lastStart.getTime() + (missedCycles - i) * avgCycle * 86400000);
    const cycleEnd = new Date(cycleStart.getTime() + 4 * 86400000);
    const monthLabel = cycleStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    cards.push({
      monthLabel,
      expectedStart: cycleStart.toISOString().split('T')[0],
      expectedEnd: cycleEnd.toISOString().split('T')[0],
    });
  }
  return cards;
}
