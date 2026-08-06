import { getLunaContext } from '../../services/companion/lunaContext';

describe('lunaContext', () => {
  it('home returns idle animation and phase message', () => {
    const ctx = getLunaContext('home', { lunaEnabled: true, pregnancyMode: false, currentPhase: 'Menstrual' });
    expect(ctx.animation).toBe('idle');
    expect(ctx.message).toContain('Menstrual');
  });

  it('home without phase shows track message', () => {
    const ctx = getLunaContext('home', { lunaEnabled: true, pregnancyMode: false });
    expect(ctx.message).toContain('Track your cycle');
  });

  it('disabled luna returns empty', () => {
    const ctx = getLunaContext('home', { lunaEnabled: false, pregnancyMode: false });
    expect(ctx.animation).toBe('idle');
    expect(ctx.message).toBe('');
  });

  it('pregnancy mode returns bounce', () => {
    const ctx = getLunaContext('home', { lunaEnabled: true, pregnancyMode: true, week: 20, trimester: 2, babySize: 'a mango' });
    expect(ctx.animation).toBe('bounce');
    expect(ctx.message).toContain('mango');
  });
});