export interface CyclePhases {
  periodStart: Date;
  periodEnd: Date;
  follicularStart: Date;
  follicularEnd: Date;
  ovulationDate: Date;
  fertileStart: Date;
  fertileEnd: Date;
  lutealStart: Date;
  lutealEnd: Date;
}

export interface PhaseMeta {
  bg: string;
  fg: string;
  accent: string;
  label: string;
  emoji: string;
  desc: string;
}

const DAY_MS = 86400000;

function shiftDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

function fmtDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function calculateCyclePhases(
  periodStart: Date,
  cycleLength: number,
  periodLength = 5
): CyclePhases {
  const ovulationOffset = Math.max(10, Math.min(cycleLength - 14, 40));
  const ovulationDate = shiftDays(periodStart, ovulationOffset);
  const fertileStart = shiftDays(ovulationDate, -4);
  return {
    periodStart,
    periodEnd: shiftDays(periodStart, periodLength - 1),
    follicularStart: shiftDays(periodStart, periodLength),
    follicularEnd: shiftDays(fertileStart, -1),
    ovulationDate,
    fertileStart,
    fertileEnd: ovulationDate,
    lutealStart: shiftDays(ovulationDate, 1),
    lutealEnd: shiftDays(periodStart, cycleLength - 1),
  };
}

export function applyPhaseToDays(
  days: Record<string, string>,
  phases: CyclePhases,
  marker: 'P' | 'p'
): void {
  const confirmed = marker === 'P';
  const period = marker;
  const follicular = confirmed ? 'Fl' : 'fl';
  const fertile = confirmed ? 'F' : 'f';
  const ovulation = confirmed ? 'O' : 'o';
  const luteal = confirmed ? 'L' : 'l';

  // Mirror the backend ladder (F1): a CONFIRMED period is written
  // unconditionally (overrides any predicted code on the same day); all other
  // phase codes are fill-only so predicted never clobbers confirmed data.
  const set = (key: string, value: string, force = false): void => {
    if (force || days[key] === undefined) {
      days[key] = value;
    }
  };

  const range = (start: Date, end: Date, value: string, force = false): void => {
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      set(fmtDay(new Date(t)), value, force);
    }
  };

  range(phases.periodStart, phases.periodEnd, period, confirmed);
  if (phases.follicularEnd >= phases.follicularStart) {
    range(phases.follicularStart, phases.follicularEnd, follicular);
  }
  range(phases.fertileStart, phases.fertileEnd, fertile);
  // Ovulation day overrides the fertile window (fertile_end == ovulation)
  // so O/o is actually emitted, matching the server calendar.
  const ovKey = fmtDay(phases.ovulationDate);
  const cur = days[ovKey];
  if (cur === undefined || cur === 'F' || cur === 'f') {
    days[ovKey] = ovulation;
  }
  range(phases.lutealStart, phases.lutealEnd, luteal);
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function diffInCalendarDays(a: Date, b: Date): number {
  const at = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 12).getTime();
  const bt = new Date(b.getFullYear(), b.getMonth(), b.getDate(), 12).getTime();
  return Math.round((at - bt) / DAY_MS);
}

function periodRunStarts(days: Record<string, string>): Date[] {
  const all = Object.entries(days)
    .filter(([, code]) => code === 'P' || code === 'p')
    .map(([key]) => parseDateKey(key))
    .sort((x, y) => x.getTime() - y.getTime());
  const starts: Date[] = [];
  let prev: Date | null = null;
  for (const d of all) {
    if (prev === null || diffInCalendarDays(d, prev) !== 1) starts.push(d);
    prev = d;
  }
  return starts;
}

/** Start of the most recent period run (confirmed 'P' or predicted 'p') at or before `today`. */
export function getCurrentCycleAnchor(
  days: Record<string, string> | undefined,
  today: Date,
): Date | null {
  if (!days) return null;
  const runs = periodRunStarts(days).filter((d) => diffInCalendarDays(d, today) <= 0);
  return runs.length > 0 ? runs[runs.length - 1] : null;
}

/** Cycle day = days since the current period start + 1 (fallback 1 when unknown). */
export function computeCycleDay(
  days: Record<string, string> | undefined,
  today: Date,
): number {
  const anchor = getCurrentCycleAnchor(days, today);
  if (anchor === null) return 1;
  return diffInCalendarDays(today, anchor) + 1;
}

export interface PhaseRange {
  key: 'menstrual' | 'follicular' | 'fertile' | 'ovulation' | 'luteal';
  startDay: number | null;
  endDay: number | null;
}

export interface DayPhase {
  emoji: string;
  label: string;
  color: string;
  description: string;
}

const PHASE_LETTERS: Record<PhaseRange['key'], [string, string]> = {
  menstrual: ['P', 'p'],
  follicular: ['Fl', 'fl'],
  fertile: ['F', 'f'],
  ovulation: ['O', 'o'],
  luteal: ['L', 'l'],
};

const PHASE_KEYS: PhaseRange['key'][] = ['menstrual', 'follicular', 'fertile', 'ovulation', 'luteal'];

/**
 * Day-number ranges (relative to the current cycle's period start) for the
 * five phases. Uses both confirmed and predicted day codes. Returns null
 * ranges when the phase has no data in the current cycle window.
 */
export function computePhaseRanges(
  days: Record<string, string> | undefined,
  today: Date,
): PhaseRange[] {
  const empty = (key: PhaseRange['key']): PhaseRange => ({ key, startDay: null, endDay: null });
  if (!days) return PHASE_KEYS.map(empty);

  const anchor = getCurrentCycleAnchor(days, today);
  if (anchor === null) return PHASE_KEYS.map(empty);

  // Window boundary = the NEXT period run start, or a forward-looking horizon if unknown.
  const nextAnchor =
    periodRunStarts(days).find((d) => diffInCalendarDays(d, anchor) > 0) ?? null;
  const windowEnd = nextAnchor ?? shiftDays(today, 60);

  return (PHASE_KEYS).map((key) => {
    const [a, b] = PHASE_LETTERS[key];
    let first: Date | null = null;
    let last: Date | null = null;
    for (const [dateKey, code] of Object.entries(days)) {
      if (code !== a && code !== b) continue;
      const d = parseDateKey(dateKey);
      if (diffInCalendarDays(d, anchor) < 0) continue;
      if (diffInCalendarDays(d, windowEnd) >= 0) continue;
      if (first === null || d < first) first = d;
      if (last === null || d > last) last = d;
    }
    if (first === null || last === null) return empty(key);
    return {
      key,
      startDay: diffInCalendarDays(first, anchor) + 1,
      endDay: diffInCalendarDays(last, anchor) + 1,
    };
  });
}

/**
 * Extends the confirmed period block (`P`) on a calendar day map from the
 * entry's start date to the given end date. Recomputes the full confirmed
 * phase ladder for that cycle so the dark-pink block instantly reflects the
 * new end date (mirrors the backend `_apply_confirmed_phases` ladder).
 */
export function extendPeriodBlock(
  days: Record<string, string>,
  periodStart: Date,
  periodEnd: Date,
  cycleLength = 28,
): Record<string, string> {
  const result = { ...days };
  const periodLength = computePeriodLength(periodStart, periodEnd, 5);
  const confirmedPhases = calculateCyclePhases(periodStart, cycleLength, periodLength);
  applyPhaseToDays(result, confirmedPhases, 'P');
  return result;
}

export function computeNotificationDay(
  avgPeriodLength: number | null,
  fallback = 3
): number {
  if (avgPeriodLength === null) return fallback;
  return Math.max(avgPeriodLength - 2, fallback);
}

export function computePeriodLength(
  periodStart: Date,
  periodEnd: Date | null,
  fallback = 5
): number {
  if (periodEnd === null) return fallback;
  return Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS) + 1;
}

export const PHASE_META: Record<string, PhaseMeta> = {
  menstrual: {
    bg: '#FFE4EC', fg: '#B83058', accent: '#FF6B8A',
    label: 'Menstrual', emoji: '🩸',
    desc: 'Rest & restore. Honour your body.',
  },
  follicular: {
    bg: '#FFF4E3', fg: '#A0621A', accent: '#F5A623',
    label: 'Follicular', emoji: '🌱',
    desc: 'Rising energy. Fresh beginnings.',
  },
  fertile: {
    bg: '#F3E5F5', fg: '#7B1FA2', accent: '#CE93D8',
    label: 'Fertile', emoji: '🌱',
    desc: 'Fertile window. Conception window.',
  },
  ovulation: {
    bg: '#E5F9F0', fg: '#1A6B45', accent: '#3CC87A',
    label: 'Ovulation', emoji: '🌟',
    desc: 'Peak vitality. Magnetic energy.',
  },
  luteal: {
    bg: '#EFE8FA', fg: '#5A35A0', accent: '#9B6BD4',
    label: 'Luteal', emoji: '🌙',
    desc: 'Wind down. Nurture yourself.',
  },
};

export function getPhaseMeta(phase: string): PhaseMeta {
  return PHASE_META[phase] ?? PHASE_META.luteal;
}

/**
 * Derive the canonical phase key for a given calendar date from the encoded
 * day map. Uses the day code when it matches a known letter; otherwise
 * falls back to computing the cycle day from the period anchor so every
 * screen shows the same phase regardless of code variants (P/p/pw/c/u/etc.).
 */
export function derivePhaseForDate(
  days: Record<string, string>,
  dateStr: string,
): PhaseRange['key'] {
  const code = days[dateStr];
  if (code === 'P' || code === 'p' || code === 'pw' || code === 'u') return 'menstrual';
  if (code === 'Fl' || code === 'fl') return 'follicular';
  if (code === 'F' || code === 'f') return 'fertile';
  if (code === 'O' || code === 'o') return 'ovulation';
  if (code === 'L' || code === 'l') return 'luteal';
  // Fallback: compute from anchor for unrecognized codes (e.g. 'c', missing)
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  const cd = computeCycleDay(days, date);
  if (cd >= 1 && cd <= 5) return 'menstrual';
  if (cd >= 6 && cd <= 13) return 'follicular';
  if (cd === 14 || cd === 15) return 'ovulation';
  if (cd >= 16 && cd <= 28) return 'luteal';
  return 'menstrual';
}
