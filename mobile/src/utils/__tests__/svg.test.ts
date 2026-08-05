import {
  safeStep,
  sanitizePoint,
  buildLinePath,
  buildAreaPath,
  buildSmoothPath,
} from 'src/utils/svg';

describe('safeStep', () => {
  it('returns 0 when no points', () => {
    expect(safeStep(100, 0)).toBe(0);
  });

  it('returns 0 when a single point', () => {
    expect(safeStep(100, 1)).toBe(0);
  });

  it('divides plot width across segments for 2+ points', () => {
    expect(safeStep(100, 2)).toBe(100);
    expect(safeStep(100, 5)).toBe(25);
  });

  it('never divides by zero', () => {
    expect(Number.isFinite(safeStep(100, 1))).toBe(true);
    expect(Number.isFinite(safeStep(100, 0))).toBe(true);
  });
});

describe('sanitizePoint', () => {
  it('returns the point when both coords are finite', () => {
    expect(sanitizePoint({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
  });

  it('rejects NaN x', () => {
    expect(sanitizePoint({ x: NaN, y: 2 })).toBeNull();
  });

  it('rejects Infinity y', () => {
    expect(sanitizePoint({ x: 1, y: Infinity })).toBeNull();
  });
});

describe('buildLinePath', () => {
  it('returns empty string for no points', () => {
    expect(buildLinePath([])).toBe('');
  });

  it('returns M for a single valid point', () => {
    expect(buildLinePath([{ x: 5, y: 10 }])).toBe('M5,10');
  });

  it('joins segments with L', () => {
    expect(
      buildLinePath([
        { x: 5, y: 10 },
        { x: 15, y: 20 },
      ]),
    ).toBe('M5,10 L15,20');
  });

  it('filters out NaN / Infinity points', () => {
    const path = buildLinePath([
      { x: NaN, y: 10 },
      { x: 5, y: Infinity },
      { x: 15, y: 20 },
    ]);
    expect(path).toBe('M15,20');
  });
});

describe('buildAreaPath', () => {
  it('returns empty string when linePath is empty', () => {
    expect(buildAreaPath('', 10, 5, 100)).toBe('');
  });

  it('closes the path to the baseline', () => {
    expect(buildAreaPath('M5,10 L15,20', 15, 5, 100)).toBe(
      'M5,10 L15,20 L15,100 L5,100 Z',
    );
  });
});

describe('buildSmoothPath', () => {
  it('returns empty string for fewer than 2 points', () => {
    expect(buildSmoothPath([])).toBe('');
    expect(buildSmoothPath([{ x: 1, y: 2 }])).toBe('');
  });

  it('builds a quadratic smoothing path', () => {
    const path = buildSmoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ]);
    expect(path.startsWith('M 0 0')).toBe(true);
    expect(path).toContain('Q 10 10 15 5');
    expect(path).toContain('T 20 0');
  });

  it('filters NaN points before building', () => {
    const path = buildSmoothPath([
      { x: 0, y: 0 },
      { x: NaN, y: 10 },
      { x: 20, y: 0 },
      { x: 30, y: 10 },
    ]);
    expect(path).toBe('M 0 0 Q 20 0 25 5 T 30 10');
  });
});
