import { getInsightForDay, getDayInsight, getMotivationForDay } from 'src/utils/dayInsights';
import type { DayObservation } from 'src/components/ui/DayDetailSheet';

const base: DayObservation = {
  mood: null,
  moodIntensity: 3,
  painLevel: 0,
  energyLevel: null,
  sleepMinutes: 0,
  waterGlasses: 0,
  flowLevel: null,
  symptoms: [],
  symptomSeverities: {},
  medications: [],
  medicationDoses: {},
  notes: '',
  recommendationsCompleted: [],
};

describe('getInsightForDay', () => {
  it('returns null for empty observation', () => {
    expect(getInsightForDay(base)).toBeNull();
  });

  it('returns insight for high pain', () => {
    const obs = { ...base, painLevel: 7 };
    const result = getInsightForDay(obs);
    expect(result).toContain('Significant pain');
  });

  it('returns insight for low energy', () => {
    const obs = { ...base, energyLevel: 1 };
    const result = getInsightForDay(obs);
    expect(result).toContain('Low energy');
  });

  it('returns insight for low water', () => {
    const obs = { ...base, waterGlasses: 2 };
    const result = getInsightForDay(obs);
    expect(result).toContain('A few glasses');
  });

  it('returns insight for well hydrated', () => {
    const obs = { ...base, waterGlasses: 15 };
    const result = getInsightForDay(obs);
    expect(result).toContain('Well hydrated');
  });

  it('returns insight for cramps with pain', () => {
    const obs = { ...base, symptoms: ['Cramps'], painLevel: 4 };
    const result = getInsightForDay(obs);
    expect(result).toContain('Cramps');
  });

  it('returns insight for headache', () => {
    const obs = { ...base, symptoms: ['Headache'] };
    const result = getInsightForDay(obs);
    expect(result).toContain('Headache');
  });

  it('returns insight for fatigue with low energy', () => {
    const obs = { ...base, symptoms: ['Fatigue'], energyLevel: 1 };
    const result = getInsightForDay(obs);
    expect(result).toContain('Low energy');
  });
});

describe('getDayInsight (tier-aware, plan §7)', () => {
  it('maps severe pain (>=7) to seek_care with no motivation copy', () => {
    const result = getDayInsight({ ...base, painLevel: 8 }, 'menstrual');
    expect(result.tier).toBe('seek_care');
    expect(result.motivation).toBeNull();
    expect(result.rules.length).toBeGreaterThan(0);
  });

  it('adds out-of-period rule for pain ≥ 7 off-cycle', () => {
    const result = getDayInsight({ ...base, painLevel: 9 }, 'luteal');
    expect(result.tier).toBe('seek_care');
    expect(result.rules.some((r) => r.ruleId === 'rule-4')).toBe(true);
  });

  it('maps pain 4-6 to recommendation with no motivation copy', () => {
    const result = getDayInsight({ ...base, painLevel: 5 }, 'follicular');
    expect(result.tier).toBe('recommendation');
    expect(result.motivation).toBeNull();
  });

  it('maps fatigue/bloating symptoms to recommendation', () => {
    const result = getDayInsight({ ...base, symptoms: ['Bloating'] }, 'luteal');
    expect(result.tier).toBe('recommendation');
  });

  it('gives maintenance copy for pain 1-3', () => {
    const result = getDayInsight({ ...base, painLevel: 2 }, 'menstrual');
    expect(result.tier).toBe('maintenance');
    expect(result.motivation).toBeTruthy();
  });

  it('gives motivation copy for a calm day', () => {
    const result = getDayInsight(base, 'follicular');
    expect(result.tier).toBe('motivation');
    expect(result.motivation).toBeTruthy();
  });

  it('getMotivationForDay returns only the motivational string', () => {
    const text = getMotivationForDay({ ...base, painLevel: 2 }, 'menstrual');
    expect(text).toBeTruthy();
    expect(getMotivationForDay({ ...base, painLevel: 8 }, 'menstrual')).toBeNull();
  });
});
