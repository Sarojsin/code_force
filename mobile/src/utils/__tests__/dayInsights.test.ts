import { getInsightForDay } from 'src/utils/dayInsights';
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
  medications: [],
  medicationDoses: {},
  notes: '',
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
