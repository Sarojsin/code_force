import { heuristicScorer } from '../heuristicScorer';

describe('HeuristicScorer', () => {
  it('returns a valid WellnessAnalysis for any text', () => {
    const result = heuristicScorer.analyze('I had a good day');
    expect(result.mood_score).toBeGreaterThanOrEqual(1);
    expect(result.mood_score).toBeLessThanOrEqual(10);
    expect(['positive', 'negative', 'neutral']).toContain(result.sentiment);
    expect(Array.isArray(result.symptom_mentions)).toBe(true);
    expect(result.crisis_flags).toBeDefined();
    expect(typeof result.crisis_flags.self_harm_mention).toBe('boolean');
    expect(typeof result.crisis_flags.abuse_mention).toBe('boolean');
    expect(typeof result.crisis_flags.emergency_keyword).toBe('boolean');
  });

  it('scores positive mood for positive words', () => {
    const result = heuristicScorer.analyze('I feel great happy amazing love wonderful best');
    expect(result.mood_score).toBeGreaterThanOrEqual(7);
    expect(result.sentiment).toBe('positive');
  });

  it('scores negative mood for negative words', () => {
    const result = heuristicScorer.analyze('I feel bad terrible sad awful horrible pain worst');
    expect(result.mood_score).toBeLessThanOrEqual(4);
    expect(result.sentiment).toBe('negative');
  });

  it('detects self-harm crisis keywords', () => {
    const result = heuristicScorer.analyze('I want to hurt myself tonight');
    expect(result.crisis_flags.self_harm_mention).toBe(true);
  });

  it('detects abuse crisis keywords', () => {
    const result = heuristicScorer.analyze('He hit me again and I feel unsafe');
    expect(result.crisis_flags.abuse_mention).toBe(true);
  });

  it('detects emergency keywords', () => {
    const result = heuristicScorer.analyze('I need an ambulance');
    expect(result.crisis_flags.emergency_keyword).toBe(true);
  });

  it('extracts symptom mentions', () => {
    const result = heuristicScorer.analyze('I have terrible cramps and a migraine');
    expect(result.symptom_mentions).toContain('cramps');
    expect(result.symptom_mentions).toContain('headache');
  });

  it('returns neutral for benign text', () => {
    const result = heuristicScorer.analyze('I went to the store and bought some milk');
    expect(result.sentiment).toBe('neutral');
  });
});
