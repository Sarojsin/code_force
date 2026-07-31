// jest.setup.js - runs before the test framework is installed
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));

jest.mock('expo', () => ({
  isRunningInExpoGo: jest.fn(() => true),
  requireNativeModule: jest.fn(() => ({})),
  requireNativeViewManager: jest.fn(() => () => null),
}));

jest.mock('expo-modules-core', () => {
  class EventEmitter {
    addListener() {}
    removeListener() {}
    removeAllListeners() {}
    emit() {}
  }
  return {
    EventEmitter,
    requireNativeModule: jest.fn(() => ({})),
    requireNativeViewManager: jest.fn(() => () => null),
    NativeModulesProxy: {},
    Platform: { OS: 'ios', select: (obj: any) => (obj.ios ?? obj.default) },
    uuid: {
      v4: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
    },
    CodedError: class extends Error {},
    UnavailabilityError: class extends Error {},
  };
});

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    runSync: jest.fn(),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    execSync: jest.fn(),
    closeAsync: jest.fn(),
  })),
}));
