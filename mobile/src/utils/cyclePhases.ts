export interface CyclePhases {
  periodStart: Date;
  periodEnd: Date;
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
  return {
    periodStart,
    periodEnd: shiftDays(periodStart, periodLength - 1),
    ovulationDate,
    fertileStart: shiftDays(ovulationDate, -4),
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
  const period = marker;
  const fertile = marker === 'P' ? 'F' : 'f';
  const ovulation = marker === 'P' ? 'O' : 'o';
  const luteal = marker === 'P' ? 'L' : 'l';

  const set = (key: string, value: string): void => {
    if (days[key] === undefined) {
      days[key] = value;
    }
  };

  const range = (start: Date, end: Date, value: string): void => {
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      set(fmtDay(new Date(t)), value);
    }
  };

  range(phases.periodStart, phases.periodEnd, period);
  range(phases.fertileStart, phases.fertileEnd, fertile);
  set(fmtDay(phases.ovulationDate), ovulation);
  range(phases.lutealStart, phases.lutealEnd, luteal);
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
