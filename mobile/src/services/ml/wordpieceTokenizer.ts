import VOCAB from 'src/assets/vocab_minilm.json';

/**
 * WordPiece tokenizer matching BERT/transformers behavior
 * Used by sentence-transformers/all-MiniLM-L6-v2
 */
export class WordPieceTokenizer {
  private readonly UNK_TOKEN = '[UNK]';
  private readonly CLS_TOKEN = '[CLS]';
  private readonly SEP_TOKEN = '[SEP]';
  private readonly PAD_TOKEN = '[PAD]';
  private readonly MAX_LEN = 128;

  private vocab: Map<string, number>;
  private invVocab: Map<number, string>;
  private unkId: number;
  private padId: number;

  constructor() {
    this.vocab = new Map(Object.entries(VOCAB));
    this.invVocab = new Map(
      Object.entries(VOCAB).map(([k, v]) => [v as unknown as number, k]),
    );
    this.unkId = this.vocab.get(this.UNK_TOKEN) ?? 100;
    this.padId = this.vocab.get(this.PAD_TOKEN) ?? 0;
  }

  /**
   * WordPiece tokenize a single word
   * Implements greedy longest-match-first algorithm
   */
  private wordpieceTokenize(word: string): string[] {
    const chars = word.split('');
    const tokens: string[] = [];
    let start = 0;

    while (start < chars.length) {
      let end = chars.length;
      let found = false;

      while (end > start) {
        const substr = (start === 0 ? '' : '##') + chars.slice(start, end).join('');
        if (this.vocab.has(substr)) {
          found = true;
          tokens.push(substr);
          start = end;
          break;
        }
        end--;
      }

      if (!found) {
        tokens.push(this.UNK_TOKEN);
        break;
      }
    }
    return tokens;
  }

  /**
   * Encode text to token IDs (no attention mask)
   */
  encode(text: string): number[] {
    const cleaned = text.toLowerCase().normalize('NFC');
    const words = cleaned.split(/[^a-z0-9]+/).filter(Boolean);

    const tokens: string[] = [this.CLS_TOKEN];
    for (const word of words) {
      const pieces = this.wordpieceTokenize(word);
      tokens.push(...pieces);
      if (tokens.length >= this.MAX_LEN - 1) break;
    }
    tokens.push(this.SEP_TOKEN);

    const ids = tokens.slice(0, this.MAX_LEN).map((t) => this.vocab.get(t) ?? this.unkId);
    while (ids.length < this.MAX_LEN) ids.push(this.padId);
    return ids;
  }

  /**
   * Encode text to token IDs with attention mask
   */
  encodeWithAttention(text: string): { inputIds: number[]; attentionMask: number[] } {
    const cleaned = text.toLowerCase().normalize('NFC');
    const words = cleaned.split(/[^a-z0-9]+/).filter(Boolean);

    const tokens: string[] = [this.CLS_TOKEN];
    for (const word of words) {
      const pieces = this.wordpieceTokenize(word);
      tokens.push(...pieces);
      if (tokens.length >= this.MAX_LEN - 1) break;
    }
    tokens.push(this.SEP_TOKEN);

    const inputIds = tokens.slice(0, this.MAX_LEN).map((t) => this.vocab.get(t) ?? this.unkId);
    const attentionMask = inputIds.map((id) => (id === this.padId ? 0 : 1));

    while (inputIds.length < this.MAX_LEN) {
      inputIds.push(this.padId);
      attentionMask.push(0);
    }
    return { inputIds, attentionMask };
  }

  /**
   * Decode token IDs back to text (approximate)
   */
  decode(ids: number[]): string {
    const tokens = ids
      .map((id) => this.invVocab.get(id) ?? this.UNK_TOKEN)
      .filter((t) => t !== this.PAD_TOKEN && t !== this.CLS_TOKEN && t !== this.SEP_TOKEN);
    return tokens.join('').replace(/##/g, '');
  }
}