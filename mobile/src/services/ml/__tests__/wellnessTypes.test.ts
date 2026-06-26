import { WellnessAnalysis } from '../wellnessTypes';

describe('WellnessAnalysis type contract', () => {
  it('has the correct shape', () => {
    const analysis: WellnessAnalysis = {
      mood_score: 7,
      sentiment: 'positive',
      symptom_mentions: ['cramps'],
      crisis_flags: {
        self_harm_mention: false,
        abuse_mention: false,
        emergency_keyword: false,
      },
      inference_time_ms: 42,
    };
    expect(analysis.mood_score).toBe(7);
    expect(analysis.sentiment).toBe('positive');
    expect(analysis.symptom_mentions).toContain('cramps');
    expect(analysis.crisis_flags.self_harm_mention).toBe(false);
    expect(analysis.inference_time_ms).toBeLessThan(100);
  });

  it('accepts extreme mood scores', () => {
    const low: WellnessAnalysis = {
      mood_score: 1,
      sentiment: 'negative',
      symptom_mentions: [],
      crisis_flags: { self_harm_mention: false, abuse_mention: false, emergency_keyword: false },
      inference_time_ms: 0,
    };
    const high: WellnessAnalysis = {
      mood_score: 10,
      sentiment: 'positive',
      symptom_mentions: [],
      crisis_flags: { self_harm_mention: false, abuse_mention: false, emergency_keyword: false },
      inference_time_ms: 0,
    };
    expect(low.mood_score).toBe(1);
    expect(high.mood_score).toBe(10);
  });

  it('validates crisis flag combinations', () => {
    const crisis: WellnessAnalysis = {
      mood_score: 2,
      sentiment: 'negative',
      symptom_mentions: [],
      crisis_flags: { self_harm_mention: true, abuse_mention: false, emergency_keyword: true },
      inference_time_ms: 10,
    };
    expect(crisis.crisis_flags.self_harm_mention).toBe(true);
    expect(crisis.crisis_flags.emergency_keyword).toBe(true);
    expect(crisis.crisis_flags.abuse_mention).toBe(false);
  });
});
