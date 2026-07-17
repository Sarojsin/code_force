import { NativeModules, Platform } from 'react-native';
import { tokenizer } from './tokenizer';
import { WordPieceTokenizer } from './wordpieceTokenizer';

const isNative = Platform.OS !== 'web';

class MinILMEmbedder {
  private session: any = null;
  private loading = false;
  private wpTokenizer: WordPieceTokenizer | null = null;
  private onnxruntime: any = null;

  private _loadModule(): void {
    if (this.onnxruntime) return;
    // Gate: don't require if native module isn't linked (prevents uncatchable JSI crash from binding.ts)
    if (!NativeModules.Onnxruntime) return;
    try {
      this.onnxruntime = require('onnxruntime-react-native');
    } catch {
      // onnxruntime native module unavailable
    }
  }

  async initialize(): Promise<void> {
    if (!isNative) return;
    this._loadModule();
    if (!this.onnxruntime || this.session || this.loading) return;
    this.loading = true;
    try {
      this.session = await this.onnxruntime.InferenceSession.create(
        require('assets/models/minilm_embedder.onnx'),
      );
      this.wpTokenizer = new WordPieceTokenizer();
    } catch {
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get 384-dimensional sentence embedding
   */
  async embed(text: string): Promise<number[]> {
    if (!isNative || !this.session) {
      return Array.from({ length: 384 }, (_, i) =>
        Math.sin(text.length + i * 0.1) * 0.5,
      );
    }

    const { Tensor } = this.onnxruntime;
    const t0 = performance.now();

    // Use WordPiece tokenizer for proper BERT encoding
    const inputIds = this.wpTokenizer?.encode(text) ?? tokenizer.encode(text);
    const attentionMask = inputIds.map((id) => (id === 0 ? 0 : 1));

    const outputs = await this.session.run({
      input_ids: new Tensor('int64', inputIds, [1, 128]),
      attention_mask: new Tensor('int64', attentionMask, [1, 128]),
    });

    // Use pooler_output (CLS token representation) as sentence embedding
    const poolerOutput = outputs[1] as Float32Array; // shape [1, 384]
    const embedding = Array.from(poolerOutput);

    console.log(`[MinILMEmbedder] inference ${(performance.now() - t0).toFixed(1)}ms`);
    return embedding;
  }

  /**
   * Cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar entries from a list of embeddings
   */
  static findSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: { id: string; embedding: number[] }[],
    topK = 5,
  ): { id: string; score: number }[] {
    return candidateEmbeddings
      .map(({ id, embedding }) => ({
        id,
        score: this.cosineSimilarity(queryEmbedding, embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

export const minilmEmbedder = new MinILMEmbedder();