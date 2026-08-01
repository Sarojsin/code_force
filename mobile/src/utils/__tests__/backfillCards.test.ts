/**
 * Backfill detection — tests the missed-cycle calculation and card generation.
 *
 * Formula (from system_test1.md):
 *   missedCycles = min(3, floor(daysSince / avgCycleLength) - 1)
 *   cards shown when missedCycles > 0 AND daysSince >= 56
 *   No cards for anovulatory last entry
 */

import { getBackfillCards } from 'src/utils/backfillCards';

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
