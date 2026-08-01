import { parseISODateLocal, toLocalDateStr } from 'src/utils/date';

describe('toLocalDateStr', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    const d = new Date(2026, 6, 22, 15, 30, 0);
    expect(toLocalDateStr(d)).toBe('2026-07-22');
  });

  it('zero-pads month and day', () => {
    const d = new Date(2026, 0, 5, 0, 0, 0);
    expect(toLocalDateStr(d)).toBe('2026-01-05');
  });

  it('reads local date fields, never UTC ones', () => {
    // A date built from local components must round-trip through the local
    // getFullYear/getMonth/getDate accessors — not via toISOString (UTC),
    // which is exactly the off-by-one the helper exists to prevent.
    const d = new Date(2026, 6, 22, 23, 0, 0);
    const expected = [
      d.getFullYear(),
      d.getMonth() + 1,
      d.getDate(),
    ].map((n) => String(n).padStart(2, '0')).join('-');
    expect(toLocalDateStr(d)).toBe('2026-07-22');
    expect(toLocalDateStr(d)).toBe(expected);
  });
});

describe('parseISODateLocal', () => {
  it('parses a key as local midday without timezone drift', () => {
    const d = parseISODateLocal('2026-07-22');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(22);
  });

  it('round-trips through toLocalDateStr', () => {
    const key = '2026-01-05';
    expect(toLocalDateStr(parseISODateLocal(key))).toBe(key);
  });
});
