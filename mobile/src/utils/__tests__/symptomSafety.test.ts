import {
  getSafetyForDay,
  RULE_1_MESSAGE,
  RULE_4_MESSAGE,
  SEEK_CARE_THRESHOLD,
  tierOf,
} from 'src/utils/symptomSafety';

const base = {
  painLevel: 0,
  phaseKey: 'menstrual' as const,
  selectedSymptomNames: [] as string[],
};

describe('getSafetyForDay — Rule 1 (severe pain)', () => {
  it('flags seek_care when pain >= threshold', () => {
    const result = getSafetyForDay({ ...base, painLevel: SEEK_CARE_THRESHOLD });
    expect(result.tier).toBe('seek_care');
    expect(result.flags.map((f) => f.ruleId)).toEqual(['rule-1']);
    expect(result.flags[0].message).toBe(RULE_1_MESSAGE);
  });

  it('flags seek_care for pain above threshold', () => {
    const result = getSafetyForDay({ ...base, painLevel: 9 });
    expect(result.tier).toBe('seek_care');
  });

  it('does not duplicate rule-1 when also out of period — adds rule-4 instead', () => {
    const result = getSafetyForDay({
      painLevel: 8,
      phaseKey: 'luteal',
      selectedSymptomNames: [],
    });
    expect(result.tier).toBe('seek_care');
    const ruleIds = result.flags.map((f) => f.ruleId);
    expect(ruleIds).toEqual(['rule-1', 'rule-4']);
    expect(result.flags.find((f) => f.ruleId === 'rule-4')?.message).toBe(RULE_4_MESSAGE);
  });
});

describe('getSafetyForDay — Rule 4 (out-of-period pain)', () => {
  it('adds rule-4 when phase is not menstrual', () => {
    const result = getSafetyForDay({
      painLevel: 8,
      phaseKey: 'follicular',
      selectedSymptomNames: [],
    });
    expect(result.flags.map((f) => f.ruleId)).toContain('rule-4');
  });

  it('omits rule-4 when phase is menstrual', () => {
    const result = getSafetyForDay({ ...base, painLevel: 8 });
    expect(result.flags.map((f) => f.ruleId)).toEqual(['rule-1']);
  });
});

describe('getSafetyForDay — lower tiers', () => {
  it('recommendation for pain 4-6', () => {
    expect(getSafetyForDay({ ...base, painLevel: 4 }).tier).toBe('recommendation');
    expect(getSafetyForDay({ ...base, painLevel: 6 }).tier).toBe('recommendation');
  });

  it('recommendation for fatigue / bloating / digestive symptoms with low pain', () => {
    const result = getSafetyForDay({ ...base, selectedSymptomNames: ['Fatigue', 'Bloating'] });
    expect(result.tier).toBe('recommendation');
    expect(result.flags).toEqual([]);
  });

  it('maintenance for pain 1-3', () => {
    expect(getSafetyForDay({ ...base, painLevel: 1 }).tier).toBe('maintenance');
    expect(getSafetyForDay({ ...base, painLevel: 3 }).tier).toBe('maintenance');
  });

  it('motivation for pain 0 with no concerning symptoms', () => {
    expect(getSafetyForDay(base).tier).toBe('motivation');
  });

  it('returns empty flags for non-seek-care tiers', () => {
    for (const painLevel of [0, 1, 4, 6]) {
      const result = getSafetyForDay({ ...base, painLevel });
      if (result.tier !== 'seek_care') {
        expect(result.flags).toEqual([]);
      }
    }
  });
});

describe('tierOf', () => {
  it('returns only the tier key', () => {
    expect(tierOf({ ...base, painLevel: 8 })).toBe('seek_care');
    expect(tierOf({ ...base, painLevel: 5 })).toBe('recommendation');
    expect(tierOf(base)).toBe('motivation');
  });
});
