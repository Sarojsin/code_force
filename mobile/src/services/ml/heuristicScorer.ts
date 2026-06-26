import { WellnessAnalysis, CrisisFlags } from './wellnessTypes';

class HeuristicScorer {
  analyze(text: string): WellnessAnalysis {
    const moodScore = this._computeMoodScore(text);
    const sentiment = this._computeSentiment(text);
    const symptoms = this._extractSymptoms(text);
    const crisis = this._detectCrisis(text);
    return {
      mood_score: moodScore,
      sentiment,
      symptom_mentions: symptoms,
      crisis_flags: crisis,
      inference_time_ms: 0,
    };
  }

  private _computeMoodScore(text: string): number {
    const positiveWords = ['good', 'great', 'happy', 'excellent', 'love', 'wonderful', 'amazing', 'better', 'best'];
    const negativeWords = ['bad', 'terrible', 'sad', 'awful', 'horrible', 'pain', 'tired', 'angry', 'worst'];
    const words = text.toLowerCase().split(/\s+/);
    const pos = words.filter((w) => positiveWords.includes(w)).length;
    const neg = words.filter((w) => negativeWords.includes(w)).length;
    return Math.max(1, Math.min(10, Math.round(5 + ((pos - neg) / words.length) * 5)));
  }

  private _computeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const score = this._computeMoodScore(text);
    if (score >= 7) return 'positive';
    if (score <= 4) return 'negative';
    return 'neutral';
  }

  private _extractSymptoms(text: string): string[] {
    const symptomKeywords: Record<string, string[]> = {
      cramps: ['cramp', 'cramping'],
      headache: ['headache', 'head ache', 'migraine'],
      fatigue: ['tired', 'fatigue', 'exhausted', 'no energy'],
      nausea: ['nausea', 'sick to stomach', 'throwing up'],
      bloating: ['bloat', 'bloated', 'puffy'],
      backache: ['backache', 'back pain', 'lower back'],
      anxiety: ['anxious', 'anxiety', 'worried', 'panic'],
      irritability: ['irritable', 'irritated', 'snapping', 'short tempered'],
    };
    const lower = text.toLowerCase();
    return Object.entries(symptomKeywords)
      .filter(([_, keywords]) => keywords.some((kw) => lower.includes(kw)))
      .map(([symptom]) => symptom);
  }

  private _detectCrisis(text: string): CrisisFlags {
    const lower = text.toLowerCase();
    return {
      self_harm_mention: ['hurt myself', 'self harm', 'suicide', 'want to die', 'end it', 'cutting']
        .some((kw) => lower.includes(kw)),
      abuse_mention: ['abused', 'hit me', 'violence', 'assaulted', 'unsafe', 'forced']
        .some((kw) => lower.includes(kw)),
      emergency_keyword: ['emergency', 'hospital', 'ambulance', 'attack', 'bleeding', '911', 'help me']
        .some((kw) => lower.includes(kw)),
    };
  }
}

export const heuristicScorer = new HeuristicScorer();
