import { shouldShowOnboarding, StoredOnboardingFlag } from 'src/utils/onboardingDecision';

describe('shouldShowOnboarding', () => {
  const flag = (isCompleted: boolean, userId: string | null): StoredOnboardingFlag => ({
    isCompleted,
    userId,
  });

  it('returns false when no current user (auth stack handles it upstream)', () => {
    expect(shouldShowOnboarding(null, null, false)).toBe(false);
    expect(shouldShowOnboarding(null, null, true)).toBe(false);
    expect(shouldShowOnboarding(flag(true, 'a'), null, null)).toBe(false);
  });

  it('trusts stored flag when it belongs to the current user', () => {
    expect(shouldShowOnboarding(flag(true, 'a'), 'a', false)).toBe(false);
    expect(shouldShowOnboarding(flag(false, 'a'), 'a', null)).toBe(true);
  });

  it('ignores a foreign user flag and falls back to server flag', () => {
    // User A completed onboarding, sibling B registers: stale global flag must not leak.
    expect(shouldShowOnboarding(flag(true, 'a'), 'b', false)).toBe(true);
    expect(shouldShowOnboarding(flag(true, 'a'), 'b', true)).toBe(false);
  });

  it('defaults to showing onboarding when server flag is unknown/null', () => {
    expect(shouldShowOnboarding(null, 'a', null)).toBe(true);
    expect(shouldShowOnboarding(flag(true, 'other'), 'a', null)).toBe(true);
  });

  it('shows onboarding for a brand-new user with no stored flag and server false', () => {
    expect(shouldShowOnboarding(null, 'new-user', false)).toBe(true);
  });

  it('does not re-onboard an existing user when server says completed', () => {
    expect(shouldShowOnboarding(null, 'existing', true)).toBe(false);
    expect(shouldShowOnboarding(flag(true, 'other'), 'existing', true)).toBe(false);
  });

  it('handles legacy persisted flag with null userId via server fallback', () => {
    // Legacy value: { isCompleted: true } with no userId -> storedFlag.userId is null.
    expect(shouldShowOnboarding(flag(true, null), 'a', true)).toBe(false);
    expect(shouldShowOnboarding(flag(true, null), 'a', false)).toBe(true);
  });
});
