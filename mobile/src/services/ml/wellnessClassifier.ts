import { Platform } from 'react-native';
import { tokenizer } from './tokenizer';
import { WellnessAnalysis, CrisisFlags, SentimentLabel, SYMPTOM_LABELS } from './wellnessTypes';

const isNative = Platform.OS !== 'web';

class WellnessClassifier {
  private session: any = null;
  private loading = false;

  async initialize(): Promise<void> {
    if (!isNative) return;
    if (this.session || this.loading) return;
    this.loading = true;
    try {
      const { InferenceSession } = require('onnxruntime-react-native');
      this.session = await InferenceSession.create(
        require('assets/models/wellness_classifier.onnx'),
      );
    } catch {
    } finally {
      this.loading = false;
    }
  }

  async analyze(text: string): Promise<WellnessAnalysis> {
    if (!isNative || !this.session) {
      return {
        mood_score: 5,
        sentiment: 'neutral',
        symptom_mentions: [],
        crisis_flags: { self_harm_mention: false, abuse_mention: false, emergency_keyword: false },
        inference_time_ms: 0,
      };
    }
    const t0 = performance.now();
    const { Tensor } = require('onnxruntime-react-native');
    const inputIds = tokenizer.encode(text);

    const results = await this.session!.run({
      input_ids: new Tensor('int64', inputIds, [1, 128]),
    });

    const moodScore = Math.max(1, Math.min(10, Math.round(Number(results.mood.data[0]))));

    const symptomProbs = Array.from(results.symptoms.data as Float32Array)
      .map((x: number) => 1 / (1 + Math.exp(-x)));
    const symptomMentions = SYMPTOM_LABELS.filter((_, i) => symptomProbs[i] > 0.5);

    const crisisProbs = Array.from(results.crisis.data as Float32Array)
      .map((x: number) => 1 / (1 + Math.exp(-x)));
    const crisisFlags: CrisisFlags = {
      self_harm_mention: crisisProbs[0] > 0.25,
      abuse_mention: crisisProbs[1] > 0.25,
      emergency_keyword: crisisProbs[2] > 0.5,
    };

    const sentiment: SentimentLabel =
      moodScore >= 7 ? 'positive'
      : moodScore <= 4 ? 'negative'
      : 'neutral';

    return {
      mood_score: moodScore,
      sentiment,
      symptom_mentions: symptomMentions,
      crisis_flags: crisisFlags,
      inference_time_ms: performance.now() - t0,
    };
  }
}

export const wellnessClassifier = new WellnessClassifier();
