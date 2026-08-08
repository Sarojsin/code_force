import { getRecommendations, MAX_CARDS } from 'src/utils/expertRecommendations';

const base = {
  phaseKey: 'menstrual' as const,
  painLevel: 2,
  selectedSymptoms: ['Abdominal Cramps'],
};

describe('getRecommendations — phase-locked content', () => {
  it('returns empty cards when no relevant symptoms', () => {
    const result = getRecommendations({ ...base, selectedSymptoms: ['Headache'] });
    expect(result).toEqual([]);
  });

  it('only shows cramps card when pain is in 4-6 band', () => {
    expect(getRecommendations({ ...base, painLevel: 3 }).length).toBe(0);
    expect(getRecommendations({ ...base, painLevel: 4 }).length).toBe(1);
    expect(getRecommendations({ ...base, painLevel: 5 }).length).toBe(1);
    expect(getRecommendations({ ...base, painLevel: 6 }).length).toBe(1);
    expect(getRecommendations({ ...base, painLevel: 7 }).length).toBe(0);
  });

  it('emits fatigue and bloating cards without a pain band gate', () => {
    const result = getRecommendations({
      phaseKey: 'luteal',
      painLevel: 2,
      selectedSymptoms: ['Fatigue', 'Bloating'],
    });
    expect(result.map((c) => c.id)).toEqual(['luteal-fatigue', 'luteal-bloating']);
  });

  it('returns female-specific content per phase for cramps', () => {
    const spike = { ...base, painLevel: 5 };
    const menstrual = getRecommendations({ ...spike, phaseKey: 'menstrual' });
    const luteal = getRecommendations({ ...spike, phaseKey: 'luteal' });
    expect(menstrual[0].id).toBe('menstrual-cramps');
    expect(menstrual[0].body).toContain('heat pack');
    expect(luteal[0].id).toBe('luteal-cramps');
    expect(luteal[0].body).toContain('Magnesium');
  });

  it('caps the result at MAX_CARDS', () => {
    const result = getRecommendations({
      phaseKey: 'follicular',
      painLevel: 5,
      selectedSymptoms: ['Abdominal Cramps', 'Fatigue', 'Bloating'],
    });
    expect(result.length).toBeLessThanOrEqual(MAX_CARDS);
    expect(result.length).toBe(3);
  });

  it('every card has a stable id, icon, title and body', () => {
    const result = getRecommendations({
      phaseKey: 'ovulation',
      painLevel: 5,
      selectedSymptoms: ['Abdominal Cramps', 'Fatigue'],
    });
    for (const card of result) {
      expect(card.id).toMatch(/^[a-z-]+-(cramps|fatigue|bloating)$/);
      expect(card.icon).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.body.length).toBeGreaterThan(10);
    }
  });
});

describe('getRecommendations — aliases', () => {
  it('accepts legacy "Cramps" and "Low Energy" names', () => {
    const result = getRecommendations({
      phaseKey: 'menstrual',
      painLevel: 5,
      selectedSymptoms: ['Cramps', 'Low Energy'],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((c) => c.id === 'menstrual-cramps')).toBe(true);
    expect(result.some((c) => c.id === 'menstrual-fatigue')).toBe(true);
  });

  it('matches "lower back pain" as a cramps alias', () => {
    const result = getRecommendations({
      phaseKey: 'menstrual',
      painLevel: 5,
      selectedSymptoms: ['Lower Back Pain'],
    });
    expect(result.some((c) => c.id === 'menstrual-cramps')).toBe(true);
  });
});