import {
  INSIGHT_KEYWORDS,
  matchesInsightKeyword,
  buildInsightReply,
  buildInsightReplyWithDisclaimer,
} from '../lunaReply';

const CARD = {
  title: 'Heat + gentle stretch',
  body: 'Place a heat pack on your lower abdomen.',
  cta: 'Log water intake',
};

describe('lunaReply', () => {
  describe('matchesInsightKeyword', () => {
    it('accepts each defined keyword case-insensitively', () => {
      for (const kw of INSIGHT_KEYWORDS) {
        expect(matchesInsightKeyword(`tell me about ${kw.toUpperCase()}`)).toBe(true);
      }
    });

    it('returns true when wrapped in a sentence', () => {
      expect(matchesInsightKeyword('what should i do for cramps today?')).toBe(true);
      expect(matchesInsightKeyword("i'd like today's tip")).toBe(true);
    });

    it('rejects non-topical speech', () => {
      expect(matchesInsightKeyword('hello there, how are you?')).toBe(false);
      expect(matchesInsightKeyword('thank you')).toBe(false);
      expect(matchesInsightKeyword('')).toBe(false);
    });
  });

  describe('buildInsightReply', () => {
    it('formats title + body with cta suffix', () => {
      expect(buildInsightReply(CARD)).toBe('Heat + gentle stretch: Place a heat pack on your lower abdomen. Log water intake');
    });

    it('omits the cta when absent', () => {
      expect(buildInsightReply({ title: 'T', body: 'B' })).toBe('T: B');
    });

    it('returns null when there is no card', () => {
      expect(buildInsightReply(null)).toBeNull();
    });
  });

  describe('buildInsightReplyWithDisclaimer', () => {
    it('appends the medical disclaimer', () => {
      const reply = buildInsightReplyWithDisclaimer(CARD);
      expect(reply).toContain(buildInsightReply(CARD));
      expect(reply).toContain("not a substitute for professional medical advice");
    });

    it('returns null when there is no card', () => {
      expect(buildInsightReplyWithDisclaimer(null)).toBeNull();
    });
  });
});