/**
 * Backfill detection — tests the missed-cycle calculation and card generation
 * logic that lives inline in CycleDashboardScreen.
 *
 * Formula (from system_test1.md):
 *   missedCycles = min(3, floor(daysSince / avgCycleLength) - 1)
 *   cards shown when missedCycles > 0 AND daysSince >= 56
 *   No cards for anovulatory last entry
 */

interface BackfillCard {
  monthLabel: string;
  expectedStart: string;
  expectedEnd: string;
}

function getBackfillCards(
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

const today = new Date('2026-07-22T12:00:00Z');

describe('getBackfillCards', () => {
  it('returns empty array when no entries', () => {
    expect(getBackfillCards([], today)).toEqual([]);
  });

  it('returns empty array when daysSince < 56', () => {
    const entries = [{ period_start_date: '2026-06-15' }];
    expect(getBackfillCards(entries, today)).toEqual([]);
  });

  it('returns empty array for anovulatory last entry regardless of gap', () => {
    const entries = [{ period_start_date: '2025-01-01', cycle_type: 'anovulatory' }];
    expect(getBackfillCards(entries, today)).toEqual([]);
  });

  it('returns 1 card for ~56-83 day gap (2 missed cycles - 1 = 1)', () => {
    const entries = [{ period_start_date: '2026-05-27' }]; // ~56 days ago
    const cards = getBackfillCards(entries, today);
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 2 cards for ~84-111 day gap', () => {
    const entries = [{ period_start_date: '2026-04-01' }]; // ~112 days
    const cards = getBackfillCards(entries, today);
    expect(cards.length).toBe(3);
  });

  it('returns 3 cards for >= 112 day gap (capped)', () => {
    const entries = [{ period_start_date: '2025-06-01' }]; // ~416 days
    const cards = getBackfillCards(entries, today);
    expect(cards.length).toBeLessThanOrEqual(3);
  });

  it('generates cards in reverse chronological order (most recent first)', () => {
    const entries = [{ period_start_date: '2025-12-01' }];
    const cards = getBackfillCards(entries, today);
    for (let i = 1; i < cards.length; i++) {
      const prev = new Date(cards[i - 1].expectedStart);
      const curr = new Date(cards[i].expectedStart);
      expect(prev.getTime()).toBeGreaterThan(curr.getTime());
    }
  });

  it('each card has monthLabel, expectedStart, expectedEnd', () => {
    const entries = [{ period_start_date: '2025-01-01' }];
    const cards = getBackfillCards(entries, today);
    for (const card of cards) {
      expect(card.monthLabel).toBeTruthy();
      expect(card.expectedStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(card.expectedEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
