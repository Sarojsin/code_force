import { Platform } from 'react-native';
import { minilmTokenizer } from './minilmTokenizer';

const isNative = Platform.OS !== 'web';

export interface EmbeddingResult {
  embedding: number[];        // 384-dim normalized embedding
  inference_time_ms: number;
}

class MiniLMEmbedder {
  private session: any = null;
  private loading = false;
  private readonly EMBEDDING_DIM = 384;

  async initialize(): Promise<void> {
    if (!isNative) return;
    if (this.session || this.loading) return;
    this.loading = true;
    try {
      const { InferenceSession } = require('onnxruntime-react-native');
      this.session = await InferenceSession.create(
        require('assets/models/minilm_embedder.onnx'),
      );
    } finally {
      this.loading = false;
    }
  }

  async isReady(): Promise<boolean> {
    if (!isNative) return true;
    if (!this.session) await this.initialize();
    return !!this.session;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    if (!isNative) {
      // Return deterministic dummy embedding for web/dev
      const dummy = new Array(this.EMBEDDING_DIM).fill(0).map((_, i) => Math.sin(i * 0.1));
      return { embedding: dummy, inference_time_ms: 0 };
    }

    await this.initialize();
    if (!this.session) throw new Error('ONNX session not initialized');

    const { Tensor } = require('onnxruntime-react-native');
    const t0 = performance.now();

    const { inputIds, attentionMask } = minilmTokenizer.encodeWithAttention(text);

    const results = await this.session.run({
      input_ids: new Tensor('int64', inputIds, [1, 128]),
      attention_mask: new Tensor('int64', attentionMask, [1, 128]),
    });

    // Use pooler_output (CLS token embedding) - shape [1, 384]
    const poolerOutput = results.pooler_output as Float32Array;
    const embedding = Array.from(poolerOutput);

    // Normalize to unit length (cosine similarity ready)
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    const normalized = norm > 0 ? embedding.map((v) => v / norm) : embedding;

    return {
      embedding: normalized,
      inference_time_ms: performance.now() - t0,
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  // Cosine similarity between two embeddings (both assumed normalized)
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error('Dimension mismatch');
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return Math.max(-1, Math.min(1, dot));
  }

  // Find top-k similar entries from a corpus
  static findSimilar(
    queryEmbedding: number[],
    corpus: { id: string; embedding: number[] }[],
    k = 5,
  ): { id: string; score: number }[] {
    return corpus
      .map((item) => ({
        id: item.id,
        score: MiniLMEmbedder.cosineSimilarity(queryEmbedding, item.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

export const minilmEmbedder = new MiniLMEmbedder();