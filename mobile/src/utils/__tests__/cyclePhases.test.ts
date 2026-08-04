import {
  computeCycleDay,
  computePhaseRanges,
  derivePhaseForDate,
  extendPeriodBlock,
  getCurrentCycleAnchor,
} from 'src/utils/cyclePhases';

const today = new Date(2026, 6, 22, 12, 0, 0); // 2026-07-22

describe('computeCycleDay', () => {
  it('returns 1 when no days data', () => {
    expect(computeCycleDay(undefined, today)).toBe(1);
  });

  it('returns 1 when no period anchor on/before today', () => {
    // Only future predicted period
    const days = { '2026-08-01': 'p', '2026-08-05': 'p' };
    expect(computeCycleDay(days, today)).toBe(1);
  });

  it('mid confirmed period: latest P run start anchors the count', () => {
    const days = {
      '2026-07-01': 'P', '2026-07-02': 'P', '2026-07-03': 'P', '2026-07-04': 'P',
      '2026-07-10': 'F', '2026-07-12': 'O', '2026-07-13': 'L',
    };
    // today 22 Jul, period started 1 Jul -> cycle day 22
    expect(computeCycleDay(days, today)).toBe(22);
  });

  it('inside a predicted period run: run start anchors the count', () => {
    const days = {
      '2026-07-20': 'p', '2026-07-21': 'p', '2026-07-22': 'p', '2026-07-23': 'p',
    };
    expect(computeCycleDay(days, today)).toBe(3); // started 20 Jul
  });

  it('two contiguous period runs: uses the latest run start', () => {
    const days = {
      '2026-06-15': 'P', '2026-06-16': 'P',
      '2026-07-13': 'P', '2026-07-14': 'P', '2026-07-15': 'P',
    };
    expect(computeCycleDay(days, today)).toBe(10); // started 13 Jul
  });
});

describe('getCurrentCycleAnchor', () => {
  it('returns the start of the latest contiguous period run', () => {
    const days = {
      '2026-06-15': 'P', '2026-06-16': 'P',
      '2026-07-13': 'P', '2026-07-14': 'P',
    };
    const anchor = getCurrentCycleAnchor(days, today);
    expect(anchor?.toDateString()).toBe(new Date(2026, 6, 13).toDateString());
  });
});

describe('computePhaseRanges', () => {
  it('returns null ranges without data', () => {
    const ranges = computePhaseRanges(undefined, today);
    expect(ranges).toHaveLength(5);
    expect(ranges.every((r) => r.startDay === null)).toBe(true);
  });

  it('computes phase day numbers relative to the period start', () => {
    const days = {
      '2026-07-01': 'P', '2026-07-02': 'P', '2026-07-03': 'P', '2026-07-04': 'P', '2026-07-05': 'P',
      '2026-07-06': 'Fl', '2026-07-07': 'Fl', '2026-07-08': 'Fl', '2026-07-09': 'Fl',
      '2026-07-10': 'F', '2026-07-11': 'F', '2026-07-12': 'F', '2026-07-13': 'F', '2026-07-14': 'F',
      '2026-07-15': 'O',
      '2026-07-16': 'L', '2026-07-17': 'L', '2026-07-18': 'L',
      '2026-07-29': 'p', '2026-07-30': 'p', '2026-07-31': 'p',
    };
    const ranges = computePhaseRanges(days, today);
    const byKey = Object.fromEntries(ranges.map((r) => [r.key, r]));
    expect(byKey.menstrual).toEqual({ key: 'menstrual', startDay: 1, endDay: 5 });
    expect(byKey.follicular).toEqual({ key: 'follicular', startDay: 6, endDay: 9 });
    expect(byKey.fertile).toEqual({ key: 'fertile', startDay: 10, endDay: 14 });
    expect(byKey.ovulation).toEqual({ key: 'ovulation', startDay: 15, endDay: 15 });
    expect(byKey.luteal).toEqual({ key: 'luteal', startDay: 16, endDay: 18 });
  });

  it('does not cross into the next predicted period', () => {
    const days = {
      '2026-07-01': 'P', '2026-07-02': 'P', '2026-07-03': 'P',
      '2026-07-29': 'p', '2026-07-30': 'p', '2026-07-31': 'p',
    };
    const ranges = computePhaseRanges(days, today);
    const menstrual = ranges.find((r) => r.key === 'menstrual')!;
    expect(menstrual.endDay).toBe(3);
  });
});

describe('extendPeriodBlock', () => {
  const start = new Date(2026, 6, 1); // 2026-07-01

  it('end-only: keeps existing block and extends P days through the end date', () => {
    const days = { '2026-07-01': 'P', '2026-07-02': 'P' };
    const result = extendPeriodBlock(days, start, new Date(2026, 6, 4), 28);
    expect(result['2026-07-01']).toBe('P');
    expect(result['2026-07-02']).toBe('P');
    expect(result['2026-07-03']).toBe('P');
    expect(result['2026-07-04']).toBe('P');
    expect(result['2026-07-05']).toBe('Fl');
  });

  it('start-only: a single confirmed day yields a 1-day block', () => {
    const result = extendPeriodBlock({}, start, start, 28);
    expect(result['2026-07-01']).toBe('P');
    expect(result['2026-07-02']).toBe('Fl');
  });

  it('extend: shifts the downstream confirmed ladder after the new end', () => {
    const days = { '2026-07-01': 'P', '2026-07-02': 'P', '2026-07-03': 'P' };
    const result = extendPeriodBlock(days, start, new Date(2026, 6, 6), 28);
    // P now spans 07-01..07-06
    expect(result['2026-07-06']).toBe('P');
    // Follicular begins immediately after the extended block
    expect(result['2026-07-07']).toBe('Fl');
  });

  it('does not overwrite an existing confirmed P with a shorter recomputed run', () => {
    const days = { '2026-07-01': 'P', '2026-07-02': 'P', '2026-07-03': 'P' };
    const result = extendPeriodBlock(days, start, new Date(2026, 6, 2), 28);
    // End earlier than existing run: P days still present (fill-only semantics)
    expect(result['2026-07-03']).toBe('P');
  });
});

describe('derivePhaseForDate', () => {
  const days = {
    '2026-07-01': 'P', '2026-07-02': 'P', '2026-07-03': 'P', '2026-07-04': 'P', '2026-07-05': 'P',
    '2026-07-06': 'Fl', '2026-07-07': 'Fl', '2026-07-08': 'Fl', '2026-07-09': 'Fl',
    '2026-07-10': 'F', '2026-07-11': 'F', '2026-07-12': 'F', '2026-07-13': 'F', '2026-07-14': 'F',
    '2026-07-15': 'O',
    '2026-07-16': 'L', '2026-07-17': 'L', '2026-07-18': 'L',
  };

  it('returns correct phase for known codes', () => {
    expect(derivePhaseForDate(days, '2026-07-01')).toBe('menstrual');
    expect(derivePhaseForDate(days, '2026-07-06')).toBe('follicular');
    expect(derivePhaseForDate(days, '2026-07-10')).toBe('fertile');
    expect(derivePhaseForDate(days, '2026-07-15')).toBe('ovulation');
    expect(derivePhaseForDate(days, '2026-07-16')).toBe('luteal');
  });

  it('derives phase from anchor for unrecognized codes', () => {
    const daysWithUnrecognized = { ...days, '2026-07-02': 'pw', '2026-07-03': 'c' };
    expect(derivePhaseForDate(daysWithUnrecognized, '2026-07-02')).toBe('menstrual');
    expect(derivePhaseForDate(daysWithUnrecognized, '2026-07-03')).toBe('menstrual');
  });

  it('handles missing date gracefully via fallback', () => {
    expect(derivePhaseForDate({}, '2026-07-01')).toBe('menstrual');
  });
});

describe('cycleDay-phaseRange invariant', () => {
  const days = {
    '2026-07-01': 'P', '2026-07-02': 'P', '2026-07-03': 'P', '2026-07-04': 'P', '2026-07-05': 'P',
    '2026-07-06': 'Fl', '2026-07-07': 'Fl', '2026-07-08': 'Fl', '2026-07-09': 'Fl',
    '2026-07-10': 'F', '2026-07-11': 'F', '2026-07-12': 'F', '2026-07-13': 'F', '2026-07-14': 'F',
    '2026-07-15': 'O',
    '2026-07-16': 'L', '2026-07-17': 'L', '2026-07-18': 'L',
  };

  it('derivePhaseForDate never returns an unknown/transition phase', () => {
    const allDates = [
      ...Object.keys(days),
      '2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22', // days without codes
    ];
    const validPhases = new Set(['menstrual', 'follicular', 'fertile', 'ovulation', 'luteal']);

    for (const dateStr of allDates) {
      const phase = derivePhaseForDate(days, dateStr);
      expect(validPhases.has(phase)).toBe(true);
    }
  });

  it('computeCycleDay falls within the active phase range when codes are complete', () => {
    // Use a complete days map with all phases populated through the full cycle
    const completeDays = {
      '2026-07-01': 'P', '2026-07-02': 'P', '2026-07-03': 'P', '2026-07-04': 'P', '2026-07-05': 'P',
      '2026-07-06': 'Fl', '2026-07-07': 'Fl', '2026-07-08': 'Fl', '2026-07-09': 'Fl',
      '2026-07-10': 'F', '2026-07-11': 'F', '2026-07-12': 'F', '2026-07-13': 'F', '2026-07-14': 'F',
      '2026-07-15': 'O',
      '2026-07-16': 'L', '2026-07-17': 'L', '2026-07-18': 'L', '2026-07-19': 'L',
      '2026-07-20': 'L', '2026-07-21': 'L', '2026-07-22': 'L',
    };
    const testToday = new Date(2026, 6, 22, 12, 0, 0);

    const cd = computeCycleDay(completeDays, testToday);
    const phaseRanges = computePhaseRanges(completeDays, testToday);

    const matchingRanges = phaseRanges.filter(
      (r) => r.startDay !== null && r.endDay !== null && cd >= r.startDay! && cd <= r.endDay!,
    );

    // With complete data, cycle day must belong to exactly one phase
    expect(matchingRanges.length).toBe(1);
    expect(matchingRanges[0].key).toBe('luteal');
  });
});
