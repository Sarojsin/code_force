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

jest.mock('expo-sqlite', () => {
  const Database = require('better-sqlite3');
  const dbs = new Map();
  return {
    openDatabaseSync: jest.fn((name: string) => {
      if (dbs.has(name)) return dbs.get(name);
      const sqlite = new Database(':memory:');
      const client = {
        prepareSync: (sql: string) => {
          const stmt = sqlite.prepare(sql);
          return {
            executeSync: (params: any[]) => {
              const runResult = stmt.run(...(params ?? []));
              return {
                changes: runResult.changes,
                lastInsertRowId: Number(runResult.lastInsertRowid ?? 0),
                runSync: () => runResult,
                getAllSync: () => stmt.raw().all(...(params ?? [])),
                getFirstSync: () => stmt.raw().get(...(params ?? [])) ?? null,
              };
            },
            executeForRawResultSync: (params: any[]) => ({
              getAllSync: () => stmt.raw().all(...(params ?? [])),
            }),
          };
        },
        execSync: (sql: string) => sqlite.exec(sql),
        runSync: (sql: string, params?: any[]) => sqlite.prepare(sql).run(...(params ?? [])),
        getAllSync: (sql: string, params?: any[]) => sqlite.prepare(sql).all(...(params ?? [])),
        getFirstSync: (sql: string, params?: any[]) => sqlite.prepare(sql).get(...(params ?? [])) ?? null,
        closeAsync: () => sqlite.close(),
      };
      dbs.set(name, client);
      return client;
    }),
  };
});
