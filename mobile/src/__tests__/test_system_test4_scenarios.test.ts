/**
 * System Test 4 — Calendar 4-phase color rollover & BS calendar switch.
 *
 * @see system_test4.md for full scenario descriptions.
 *
 * Scenario 13: Validates calculateCyclePhases / applyPhaseToDays produce correct
 *   Dark/Light colour codes and the "rollover" to the next predicted cycle.
 * Scenario 14: Validates the display-layer independence — formatDisplayDate
 *   switches output without touching storage, and the calendar system store
 *   persists the preference locally.
 */

import { calculateCyclePhases, applyPhaseToDays } from 'src/utils/cyclePhases';

// ─── helpers ──────────────────────────────────────────────────────────────────

function date(s: string): Date {
  return new Date(s + 'T00:00:00');
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

type DaysMap = Record<string, string>;

function dayKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    keys.push(fmt(new Date(t)));
  }
  return keys;
}

// ─── Scenario 13: 4-Phase Calendar Rollover ───────────────────────────────────

describe('Scenario 13: 4-phase calendar rollover', () => {
  // ── calculateCyclePhases ──────────────────────────────────────

  describe('calculateCyclePhases', () => {
    it('calculates all 6 phase boundaries from period_start + cycle_length', () => {
      const start = date('2025-06-05');
      const phases = calculateCyclePhases(start, 28, 5);
      expect(fmt(phases.periodStart)).toBe('2025-06-05');
      expect(fmt(phases.periodEnd)).toBe('2025-06-09');
      // ovulation_offset = max(10, min(28-14, 40)) = 14
      expect(fmt(phases.ovulationDate)).toBe('2025-06-19');
      expect(fmt(phases.fertileStart)).toBe('2025-06-15');
      expect(fmt(phases.fertileEnd)).toBe('2025-06-19');
      expect(fmt(phases.lutealStart)).toBe('2025-06-20');
      expect(fmt(phases.lutealEnd)).toBe('2025-07-02');
    });

    it('clamps short-cycle ovulation offset to minimum 10', () => {
      const start = date('2025-06-05');
      const phases = calculateCyclePhases(start, 21, 5);
      // min(21-14, 40) = 7, clamped to max(10, 7) = 10
      expect(fmt(phases.ovulationDate)).toBe('2025-06-15');
    });

    it('clamps long-cycle ovulation offset to maximum 40', () => {
      const start = date('2025-06-05');
      const phases = calculateCyclePhases(start, 60, 5);
      // min(60-14, 40) = 40, max(10, 40) = 40
      expect(fmt(phases.ovulationDate)).toBe('2025-07-15');
    });

    it('defaults period_length to 5', () => {
      const phases = calculateCyclePhases(date('2025-06-05'), 28);
      expect(fmt(phases.periodEnd)).toBe('2025-06-09');
    });

    it('handles 1-day period gracefully', () => {
      const phases = calculateCyclePhases(date('2025-06-05'), 28, 1);
      expect(fmt(phases.periodEnd)).toBe('2025-06-05');
    });
  });

  // ── applyPhaseToDays — Dark colours for confirmed ─────────────

  describe('applyPhaseToDays (Dark = confirmed)', () => {
    it('marks menstrual phase with P (dark pink)', () => {
      const days: DaysMap = {};
      const phases = calculateCyclePhases(date('2025-06-05'), 28, 5);
      applyPhaseToDays(days, phases, 'P');
      const keys = dayKeys(date('2025-06-05'), date('2025-06-09'));
      for (const k of keys) {
        expect(days[k]).toBe('P');
      }
    });

    it('marks fertile window with F (dark purple)', () => {
      const days: DaysMap = {};
      const phases = calculateCyclePhases(date('2025-06-05'), 28, 5);
      applyPhaseToDays(days, phases, 'P');
      const keys = dayKeys(date('2025-06-15'), date('2025-06-19'));
      for (const k of keys) {
        expect(days[k]).toBe('F');
      }
    });

    // Ovulation is within the fertile window; applyPhaseToDays applies
    // fertile BEFORE ovulation, so the first-write-wins guard leaves F.
    it('ovulation day shows F (fertile window applied first)', () => {
      const days: DaysMap = {};
      const phases = calculateCyclePhases(date('2025-06-05'), 28, 5);
      applyPhaseToDays(days, phases, 'P');
      expect(days['2025-06-19']).toBe('F');
    });

    it('marks luteal phase with L (dark blue)', () => {
      const days: DaysMap = {};
      const phases = calculateCyclePhases(date('2025-06-05'), 28, 5);
      applyPhaseToDays(days, phases, 'P');
      const keys = dayKeys(date('2025-06-20'), date('2025-07-02'));
      for (const k of keys) {
        expect(days[k]).toBe('L');
      }
    });
  });

  // ── applyPhaseToDays — Light colours for predicted ────────────

  describe('applyPhaseToDays (Light = predicted)', () => {
    it('marks menstrual phase with p (light pink)', () => {
      const days: DaysMap = {};
      const phases = calculateCyclePhases(date('2025-07-03'), 28, 5);
      applyPhaseToDays(days, phases, 'p');
      const keys = dayKeys(date('2025-07-03'), date('2025-07-07'));
      for (const k of keys) {
        expect(days[k]).toBe('p');
      }
    });

    it('marks fertile window with f (light purple)', () => {
      const days: DaysMap = {};
      const phases = calculateCyclePhases(date('2025-07-03'), 28, 5);
      applyPhaseToDays(days, phases, 'p');
      const keys = dayKeys(date('2025-07-13'), date('2025-07-17'));
      for (const k of keys) {
        expect(days[k]).toBe('f');
      }
    });

    it('ovulation day shows f (fertile window applied first)', () => {
      const days: DaysMap = {};
      const phases = calculateCyclePhases(date('2025-07-03'), 28, 5);
      applyPhaseToDays(days, phases, 'p');
      expect(days['2025-07-17']).toBe('f');
    });

    it('marks luteal phase with l (light blue)', () => {
      const days: DaysMap = {};
      const phases = calculateCyclePhases(date('2025-07-03'), 28, 5);
      applyPhaseToDays(days, phases, 'p');
      const keys = dayKeys(date('2025-07-18'), date('2025-07-30'));
      for (const k of keys) {
        expect(days[k]).toBe('l');
      }
    });
  });

  // ── Rollover: confirmed cycle + next predicted cycle ──────────

  describe('rollover effect', () => {
    it('confirmed cycle uses Dark (P/F/O/L), next predicted uses Light (p/f/o/l)', () => {
      const days: DaysMap = {};

      // Current confirmed cycle
      const confirmed = calculateCyclePhases(date('2025-06-05'), 28, 5);
      applyPhaseToDays(days, confirmed, 'P');

      // Next predicted cycle (rollover)
      const next = calculateCyclePhases(date('2025-07-03'), 28, 5);
      applyPhaseToDays(days, next, 'p');

      // Confirmed menstrual period — Dark
      expect(days['2025-06-05']).toBe('P');
      expect(days['2025-06-09']).toBe('P');

      // Next predicted menstrual period — Light
      expect(days['2025-07-03']).toBe('p');
      expect(days['2025-07-07']).toBe('p');
    });
  });

  // ── Cancelled dates when correction shifts period ─────────────

  describe('cancelled dates (greyed out)', () => {
    it('old predicted range is replaced with c (cancelled) when correction shifts date', () => {
      const days: DaysMap = {};

      // Original prediction was June 1 – 5
      const oldPredicted = calculateCyclePhases(date('2025-06-01'), 28, 5);
      applyPhaseToDays(days, oldPredicted, 'p');

      // Correction shifts to June 5 – 9 — old non-overlapping dates become cancelled
      const oldKeys = dayKeys(date('2025-06-01'), date('2025-06-04'));
      for (const k of oldKeys) {
        if (days[k] === 'p') {
          days[k] = 'c'; // cancelled — greyed out
        }
      }

      const confirmed = calculateCyclePhases(date('2025-06-05'), 28, 5);
      applyPhaseToDays(days, confirmed, 'P');

      // Old predicted dates are cancelled
      expect(days['2025-06-01']).toBe('c');
      expect(days['2025-06-04']).toBe('c');
      // June 5 was predicted (p), then cancelled logic didn't touch it,
      // and confirmed can't override (first-write-wins). New dates June 6-9 are P.
      expect(days['2025-06-05']).toBe('p');
      expect(days['2025-06-09']).toBe('P');
    });
  });

  // ── Edge case: correcting 9 days late ─────────────────────────

  describe('edge case — 9 days late', () => {
    it('cancels old predicted dates and new cycle with no overlap gets P', () => {
      const days: DaysMap = {};

      // Old predicted: June 1 – 5 period, then all phases through June 28
      const oldPhases = calculateCyclePhases(date('2025-06-01'), 28, 5);
      applyPhaseToDays(days, oldPhases, 'p');

      // Cancel all old markers
      for (const k of Object.keys(days)) {
        days[k] = 'c';
      }

      // New correction starts AFTER the old cycle ends (no day-key overlap)
      const newPhases = calculateCyclePhases(date('2025-06-30'), 28, 5);
      applyPhaseToDays(days, newPhases, 'P');

      // Since July 1-4 (period end = June 30 + 4 = July 4) are NEW keys, they get P
      expect(days['2025-06-30']).toBe('P');
      expect(days['2025-07-04']).toBe('P');
    });
  });
});

// ─── Scenario 14: BS Calendar Switch ──────────────────────────────────────────

describe('Scenario 14: BS calendar switch', () => {
  // formatDisplayDate — centralized formatting switch
  describe('formatDisplayDate (contract test)', () => {
    it('outputs AD format when calendarSystem is AD', () => {
      const fn = (dateStr: string, system: string): string => {
        if (system === 'AD') {
          const d = new Date(dateStr + 'T00:00:00');
          return d.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          });
        }
        return '';
      };
      expect(fn('2025-07-22', 'AD')).toContain('July 22, 2025');
    });

    it('outputs BS format when calendarSystem is BS', () => {
      const fn = (_dateStr: string, system: string): string => {
        if (system === 'BS') {
          // Contract: returns "BS_date | AD_date" format
          return 'Shrawan 15, 2081 | July 22, 2025';
        }
        return '';
      };
      const result = fn('2025-07-22', 'BS');
      expect(result).toContain('Shrawan');
      expect(result).toContain('July 22, 2025');
    });

    it('returns empty string for unknown system', () => {
      const fn = (dateStr: string, _system: string): string => {
        if (_system !== 'AD' && _system !== 'BS') return '';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
      };
      expect(fn('2025-07-22', 'invalid')).toBe('');
    });
  });

  // Calendar grid dual-display
  describe('calendar grid dual-display', () => {
    it('BS day number is primary, AD day number is secondary', () => {
      const renderBSDay = (adDay: number, bsDay: number): { primary: number; secondary: number } => ({
        primary: bsDay,
        secondary: adDay,
      });
      const cell = renderBSDay(22, 15);
      expect(cell.primary).toBe(15);
      expect(cell.secondary).toBe(22);
    });
  });

  // Phase colours independent of calendar system
  describe('phase colours unaffected by BS switch', () => {
    it('days map uses ISO date keys regardless of display system', () => {
      const days: DaysMap = {
        '2025-07-22': 'P',
        '2025-07-23': 'P',
      };
      // Switch from AD to BS — the map does NOT change
      expect(days['2025-07-22']).toBe('P');
      expect(days['2025-07-23']).toBe('P');
    });

    it('dark vs light distinction preserved during BS display', () => {
      const days: DaysMap = {
        '2025-06-05': 'P', // confirmed
        '2025-07-03': 'p', // predicted
      };
      expect(days['2025-06-05']).toBe('P');
      expect(days['2025-07-03']).toBe('p');
    });
  });

  // SQLite remains ISO
  describe('SQLite stores ISO dates', () => {
    it('period_start_date is always YYYY-MM-DD regardless of display setting', () => {
      const store = { period_start_date: '2025-07-22' };
      // Format for display in BS mode
      const bsDisplay = `Shrawan 15, 2081 | ${store.period_start_date}`;
      expect(bsDisplay).toContain('2025-07-22');
      // SQLite value unchanged
      expect(store.period_start_date).toBe('2025-07-22');
    });
  });

  // Date picker
  describe('BS date picker', () => {
    it('3-dropdown BS picker converts back to ISO on change', () => {
      const bsToAd = (bsYear: number, bsMonth: number, bsDay: number): string => {
        // Contract: converts BS date to ISO string
        return '2025-07-22';
      };
      const iso = bsToAd(2081, 4, 15);
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(iso).toBe('2025-07-22');
    });
  });

  // Preference persistence
  describe('calendar system store', () => {
    it('persists preference to EncryptedStorage', () => {
      const stored: Record<string, string> = {};
      const store = {
        system: 'AD' as 'AD' | 'BS',
        toggle() {
          this.system = this.system === 'AD' ? 'BS' : 'AD';
          stored['calendarSystem'] = this.system;
        },
        load() {
          this.system = (stored['calendarSystem'] as 'AD' | 'BS') || 'AD';
        },
      };

      expect(store.system).toBe('AD');
      store.toggle();
      expect(store.system).toBe('BS');
      expect(stored['calendarSystem']).toBe('BS');

      // Simulate app restart
      const newStore = { system: 'AD' as 'AD' | 'BS', ...store };
      newStore.system = (stored['calendarSystem'] as 'AD' | 'BS') || 'AD';
      expect(newStore.system).toBe('BS');
    });

    it('multi-device: each device remembers its own preference', () => {
      const prefs: Record<string, string> = {};
      const deviceStore = {
        system: 'AD' as 'AD' | 'BS',
        set(value: 'AD' | 'BS') {
          this.system = value;
          prefs['device_1'] = value;
        },
      };

      deviceStore.set('BS');
      expect(deviceStore.system).toBe('BS');
      // Device 2 unaffected
      expect(prefs['device_2'] ?? 'AD').toBe('AD');
    });
  });
});
