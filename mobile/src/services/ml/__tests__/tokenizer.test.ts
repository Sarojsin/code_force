import { tokenizer } from '../tokenizer';

describe('WhitespaceTokenizer', () => {
  it('encodes a simple sentence into 128 int IDs', () => {
    const ids = tokenizer.encode('I feel happy today');
    expect(ids).toHaveLength(128);
    expect(ids.every((id) => Number.isInteger(id) && id >= 0)).toBe(true);
  });

  it('left-pads short input with 0', () => {
    const ids = tokenizer.encode('');
    expect(ids).toHaveLength(128);
    expect(ids[0]).toBe(0);
  });

  it('truncates long input to last 128 tokens', () => {
    const long = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ');
    const ids = tokenizer.encode(long);
    expect(ids).toHaveLength(128);
  });

  it('maps known tokens to vocab indices', () => {
    const ids = tokenizer.encode('the happy');
    const theIdx = ids[126];
    const happyIdx = ids[127];
    expect(typeof theIdx).toBe('number');
    expect(typeof happyIdx).toBe('number');
  });

  it('strips emoji without crashing', () => {
    const ids = tokenizer.encode('I feel 😊 today');
    expect(ids).toHaveLength(128);
    expect(ids.every((id) => Number.isInteger(id))).toBe(true);
  });

  it('handles Unicode NFC normalization', () => {
    const cafe1 = tokenizer.encode('café');
    const cafe2 = tokenizer.encode('cafe\u0301');
    expect(cafe1).toEqual(cafe2);
  });

  it('represents unknown tokens as 100', () => {
    const ids = tokenizer.encode('xyznonexistentword12345');
    const allPadOrUnk = ids.filter((id) => id !== 0).every((id) => id === 100);
    expect(allPadOrUnk).toBe(true);
  });
});
