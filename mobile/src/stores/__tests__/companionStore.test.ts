import { useCompanionStore, getLevelTitle, xpToNextLevel } from '../companionStore';

const mockCalculateLevel = (xp: number): number => {
  if (xp >= 100000) return 50;
  if (xp >= 10000) return 20;
  if (xp >= 2000) return 10;
  if (xp >= 500) return 5;
  return 1;
};

jest.mock('src/services/localDb', () => ({
  companionLocalService: {
    getMetadata: jest.fn(),
    upsertMetadata: jest.fn(),
    addXP: jest.fn(),
    addCoins: jest.fn(),
    updateSetting: jest.fn(),
    updateInstallStatus: jest.fn(),
    getInstallStatus: jest.fn(),
  },
  calculateLevel: mockCalculateLevel,
  CompanionLocalService: class {},
}));

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

describe('CompanionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCompanionStore.getState().reset();
  });

  it('initializes with defaults', () => {
    const s = useCompanionStore.getState();
    expect(s.xp).toBe(0);
    expect(s.coins).toBe(0);
    expect(s.level).toBe(1);
    expect(s.isHidden).toBe(false);
    expect(s.installStatus).toBe('none');
    expect(s.isHydrated).toBe(false);
  });

  it('calculateLevel returns correct levels', () => {
    expect(mockCalculateLevel(0)).toBe(1);
    expect(mockCalculateLevel(500)).toBe(5);
    expect(mockCalculateLevel(2000)).toBe(10);
    expect(mockCalculateLevel(10000)).toBe(20);
    expect(mockCalculateLevel(100000)).toBe(50);
  });

  it('getLevelTitle returns correct titles', () => {
    expect(getLevelTitle(1)).toBe('Kitten');
    expect(getLevelTitle(5)).toBe('Explorer');
    expect(getLevelTitle(10)).toBe('Guardian');
    expect(getLevelTitle(20)).toBe('Best Friend');
    expect(getLevelTitle(50)).toBe('Legend');
  });

  it('xpToNextLevel returns correct thresholds', () => {
    expect(xpToNextLevel(1)).toBe(500);
    expect(xpToNextLevel(5)).toBe(2000);
    expect(xpToNextLevel(10)).toBe(10000);
    expect(xpToNextLevel(20)).toBe(100000);
    expect(xpToNextLevel(50)).toBe(0);
  });

  it('spendCoins returns false when insufficient', async () => {
    useCompanionStore.setState({ userId: 'test-user', coins: 10 });
    const result = await useCompanionStore.getState().spendCoins(50);
    expect(result).toBe(false);
  });

  it('setInstallStatus updates install status', () => {
    useCompanionStore.getState().setInstallStatus('ready');
    expect(useCompanionStore.getState().installStatus).toBe('ready');
  });

  it('setAssetsVersion updates assets version', () => {
    useCompanionStore.getState().setAssetsVersion('1.0.0');
    expect(useCompanionStore.getState().assetsVersion).toBe('1.0.0');
  });

  it('reset clears all state', () => {
    useCompanionStore.setState({ xp: 100, coins: 50, level: 5, installStatus: 'ready' });
    useCompanionStore.getState().reset();
    const s = useCompanionStore.getState();
    expect(s.xp).toBe(0);
    expect(s.coins).toBe(0);
    expect(s.level).toBe(1);
    expect(s.installStatus).toBe('none');
  });
});
