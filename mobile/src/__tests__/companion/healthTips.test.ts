jest.mock('../../services/api/client', () => ({
  api: {
    get: jest.fn().mockRejectedValue(new Error('Network error')),
  },
}));

import { getHealthTip, getFallbackTip, getDailyTips } from '../../services/healthTips';

describe('healthTips', () => {
  it('getFallbackTip returns a tip from bundled JSON', () => {
    const tip = getFallbackTip('sleep');
    expect(tip).toBeTruthy();
    expect(typeof tip).toBe('string');
  });

  it('getFallbackTip returns null for unknown category', () => {
    expect(getFallbackTip('invalid' as any)).toBeNull();
  });

  it('getHealthTip falls back when API fails', async () => {
    const tip = await getHealthTip('water');
    expect(tip).toBeTruthy();
  });

  it('getDailyTips returns max 3', async () => {
    const tips = await getDailyTips();
    expect(tips.length).toBeLessThanOrEqual(3);
  });
});
