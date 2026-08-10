import { getRecommendations, MAX_CARDS } from 'src/utils/expertRecommendations';

describe('getRecommendations — pain bands & severity gates', () => {
  it('returns empty when pain is in the safety band (>= 7)', () => {
    const result = getRecommendations({
      phaseKey: 'menstrual',
      painLevel: 7,
      selectedSymptoms: ['Abdominal Cramps'],
    });
    expect(result).toEqual([]);
  });

  it('shows the cramps card only when pain is in 4-6 band, else a phase comfort card', () => {
    const base = { phaseKey: 'menstrual' as const, selectedSymptoms: ['Abdominal Cramps'] };
    expect(getRecommendations({ ...base, painLevel: 3 }).map((c) => c.id)).toEqual([
      'menstrual-comfort',
    ]);
    expect(getRecommendations({ ...base, painLevel: 4 }).map((c) => c.id)).toEqual([
      'menstrual-cramps',
    ]);
    expect(getRecommendations({ ...base, painLevel: 5 }).map((c) => c.id)).toEqual([
      'menstrual-cramps',
    ]);
    expect(getRecommendations({ ...base, painLevel: 6 }).map((c) => c.id)).toEqual([
      'menstrual-cramps',
    ]);
    expect(getRecommendations({ ...base, painLevel: 6 === 6 ? 6 : 0 }).length).toBe(1);
  });

  it('skips heavy bleeding unless severity >= 5', () => {
    const low = getRecommendations({
      phaseKey: 'menstrual',
      painLevel: 2,
      selectedSymptoms: ['Heavy / Prolonged Bleeding'],
      severities: { 'Heavy / Prolonged Bleeding': 3 },
    });
    expect(low.map((c) => c.id)).toEqual(['menstrual-comfort']);

    const high = getRecommendations({
      phaseKey: 'menstrual',
      painLevel: 2,
      selectedSymptoms: ['Heavy / Prolonged Bleeding'],
      severities: { 'Heavy / Prolonged Bleeding': 5 },
    });
    expect(high.map((c) => c.id)).toEqual(['menstrual-heavy-prolonged-bleeding']);
  });
});

describe('getRecommendations — motivation & comfort fallbacks', () => {
  it.each(['menstrual', 'follicular', 'fertile', 'ovulation', 'luteal'] as const)(
    'returns exactly one phase-locked motivation card on a normal day (%s)',
    (phaseKey) => {
      const result = getRecommendations({
        phaseKey,
        painLevel: 0,
        selectedSymptoms: [],
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(`${phaseKey}-motivation`);
    },
  );

  it('returns a phase comfort card when pain >= 2 but no symptom matched the band', () => {
    const result = getRecommendations({
      phaseKey: 'luteal',
      painLevel: 2,
      selectedSymptoms: ['Cramps'],
    });
    expect(result.map((c) => c.id)).toEqual(['luteal-comfort']);
  });
});

describe('getRecommendations — per-category phase content', () => {
  it('matches a phase-locked symptom in each of the six categories', () => {
    const cases: Array<[Parameters<typeof getRecommendations>[0], string]> = [
      [
        { phaseKey: 'luteal', painLevel: 5, selectedSymptoms: ['Abdominal Cramps'] },
        'luteal-cramps',
      ],
      [
        { phaseKey: 'luteal', painLevel: 2, selectedSymptoms: ['Bloating'] },
        'luteal-bloating',
      ],
      [
        { phaseKey: 'luteal', painLevel: 2, selectedSymptoms: ['Acne / Pimples'] },
        'luteal-acne-pimples',
      ],
      [
        { phaseKey: 'luteal', painLevel: 2, selectedSymptoms: ['Low Energy'] },
        'luteal-fatigue',
      ],
      [
        { phaseKey: 'luteal', painLevel: 2, selectedSymptoms: ['Irritability'] },
        'luteal-irritability',
      ],
      [
        { phaseKey: 'luteal', painLevel: 2, selectedSymptoms: ['PMDD (Severe PMS)'] },
        'luteal-pmdd-severe-pms',
      ],
    ];
    for (const [input, expectedId] of cases) {
      const result = getRecommendations(input);
      expect(result.map((c) => c.id)).toContain(expectedId);
    }
  });

  it('resolves legacy names via alias map (Cramps → Abdominal Cramps, Low Energy → Fatigue)', () => {
    const result = getRecommendations({
      phaseKey: 'menstrual',
      painLevel: 5,
      selectedSymptoms: ['Cramps', 'Low Energy'],
    });
    expect(result.some((c) => c.id === 'menstrual-cramps')).toBe(true);
    expect(result.some((c) => c.id === 'menstrual-fatigue')).toBe(true);
  });

  it('lower back pain maps to its own card, not the cramps card (behavior fix)', () => {
    const result = getRecommendations({
      phaseKey: 'menstrual',
      painLevel: 5,
      selectedSymptoms: ['Lower Back Pain'],
    });
    expect(result.some((c) => c.id === 'menstrual-lower-back-pain')).toBe(true);
    expect(result.some((c) => c.id === 'menstrual-cramps')).toBe(false);
  });
});

describe('getRecommendations — general fallback & dedupe & cap', () => {
  it('falls back to the phase-agnostic general matrix when no phase row exists', () => {
    const result = getRecommendations({
      phaseKey: 'follicular',
      painLevel: 2,
      selectedSymptoms: ['Vision Changes'],
    });
    expect(result.some((c) => c.id === 'general-vision-changes')).toBe(true);
  });

  it('dedupes when the same source symptom resolves through an alias', () => {
    const result = getRecommendations({
      phaseKey: 'luteal',
      painLevel: 2,
      selectedSymptoms: ['Fatigue', 'Low Energy'],
    });
    const fatigueIds = result.filter((c) => c.id === 'luteal-fatigue').length;
    expect(fatigueIds).toBe(1);
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

  it('every card is well-formed (kebab id, icon, title, body)', () => {
    const result = getRecommendations({
      phaseKey: 'ovulation',
      painLevel: 5,
      selectedSymptoms: ['Abdominal Cramps', 'Fatigue'],
    });
    for (const card of result) {
      expect(card.id).toMatch(/^[a-z0-9-]+$/);
      expect(card.title).toBeTruthy();
      expect(card.body.length).toBeGreaterThan(10);
      expect(card.icon).toBeTruthy();
    }
  });
});

describe('getRecommendations — legacy persistent ids preserved', () => {
  it('keeps menstrual-cramps, luteal-fatigue and luteal-bloating stable', () => {
    const menstrual = getRecommendations({
      phaseKey: 'menstrual',
      painLevel: 5,
      selectedSymptoms: ['Abdominal Cramps'],
    });
    const luteal = getRecommendations({
      phaseKey: 'luteal',
      painLevel: 2,
      selectedSymptoms: ['Fatigue', 'Bloating'],
    });
    expect(menstrual.some((c) => c.id === 'menstrual-cramps')).toBe(true);
    expect(luteal.some((c) => c.id === 'luteal-fatigue')).toBe(true);
    expect(luteal.some((c) => c.id === 'luteal-bloating')).toBe(true);
  });
});