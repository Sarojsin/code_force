import VOCAB from 'src/assets/vocab.json';

class WhitespaceTokenizer {
  private readonly UNK_TOKEN = 100;
  private readonly MAX_LEN = 128;
  private vocab: Map<string, number>;

  constructor() {
    this.vocab = new Map(Object.entries(VOCAB));
  }

  encode(text: string): number[] {
    const cleaned = text.toLowerCase().normalize('NFC');
    const tokens = cleaned.split(/[^a-z0-9]+/).filter(Boolean);
    const slice = tokens.slice(-this.MAX_LEN);
    const ids = slice.map((t) => this.vocab.get(t) ?? this.UNK_TOKEN);
    while (ids.length < this.MAX_LEN) {
      ids.unshift(0);
    }
    return ids;
  }
}

export const tokenizer = new WhitespaceTokenizer();
