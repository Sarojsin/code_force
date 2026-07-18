export function computePeriodLength(startDate: Date, endDate: Date | null, fallback = 5): number {
  if (endDate) return Math.round((endDate.getTime() - startDate.getTime()) / _MS_PER_DAY) + 1;
  return fallback;
}

export function computeNotificationDay(avgPeriodLength: number | null, fallback = 3): number {
  if (avgPeriodLength && avgPeriodLength >= 3) {
    return Math.max(fallback, avgPeriodLength - 2);
  }
  return fallback;
}

export interface CyclePhases {
  periodStart: Date;
  periodEnd: Date;
  fertileStart: Date;
  fertileEnd: Date;
  ovulationDate: Date;
  lutealStart: Date;
  lutealEnd: Date;
}

const _MS_PER_DAY = 86400000;

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function calculateCyclePhases(
  periodStart: Date,
  cycleLength: number,
  periodLength: number = 5,
): CyclePhases {
  const periodEnd = new Date(periodStart.getTime() + (periodLength - 1) * _MS_PER_DAY);

  const ovulationOffset = Math.max(10, Math.min(cycleLength - 14, 40));
  const ovulationDate = new Date(periodStart.getTime() + ovulationOffset * _MS_PER_DAY);

  const fertileStart = new Date(ovulationDate.getTime() - 4 * _MS_PER_DAY);
  const fertileEnd = new Date(ovulationDate);

  const lutealStart = new Date(ovulationDate.getTime() + _MS_PER_DAY);
  const lutealEnd = new Date(periodStart.getTime() + (cycleLength - 1) * _MS_PER_DAY);

  return { periodStart, periodEnd, fertileStart, fertileEnd, ovulationDate, lutealStart, lutealEnd };
}

export function applyPhaseToDays(
  days: Record<string, string>,
  phases: CyclePhases,
  prefix: 'P' | 'p',
): void {
  const codes: [Date, Date, string][] = [
    [phases.periodStart, phases.periodEnd, prefix],
    [phases.fertileStart, phases.fertileEnd, prefix === 'P' ? 'F' : 'f'],
    [phases.ovulationDate, phases.ovulationDate, prefix === 'P' ? 'O' : 'o'],
    [phases.lutealStart, phases.lutealEnd, prefix === 'P' ? 'L' : 'l'],
  ];

  for (const [s, e, code] of codes) {
    const startTs = s.getTime();
    const endTs = e.getTime();
    for (let ts = startTs; ts <= endTs; ts += _MS_PER_DAY) {
      const key = toDateStr(new Date(ts));
      if (!days[key]) {
        days[key] = code;
      }
    }
  }
}
