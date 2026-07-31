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

  function makeClient(name) {
    if (dbs.has(name)) return dbs.get(name);
    const sqlite = new Database(':memory:');
    const client = {
      prepareSync: (sql) => {
        const stmt = sqlite.prepare(sql);
        return {
          executeSync: (params) => {
            const runResult = stmt.run(...(params ?? []));
            return {
              changes: runResult.changes,
              lastInsertRowId: Number(runResult.lastInsertRowid ?? 0),
              runSync: () => runResult,
              getAllSync: () => stmt.raw().all(...(params ?? [])),
              getFirstSync: () => stmt.raw().get(...(params ?? [])) ?? null,
            };
          },
          executeForRawResultSync: (params) => ({
            getAllSync: () => stmt.raw().all(...(params ?? [])),
          }),
        };
      },
      prepareAsync: (sql) => {
        const stmt = sqlite.prepare(sql);
        return Promise.resolve({
          executeAsync: (params) => {
            const runResult = stmt.run(...(params ?? []));
            return Promise.resolve({
              changes: runResult.changes,
              lastInsertRowId: Number(runResult.lastInsertRowid ?? 0),
              getFirstAsync: () => Promise.resolve(stmt.get(...(params ?? [])) ?? null),
              getAllAsync: () => Promise.resolve(stmt.all(...(params ?? []))),
            });
          },
          executeForRawResultAsync: (params) => Promise.resolve({
            getFirstAsync: () => Promise.resolve(stmt.raw().get(...(params ?? [])) ?? null),
            getAllAsync: () => Promise.resolve(stmt.raw().all(...(params ?? []))),
          }),
          finalizeAsync: () => Promise.resolve(),
        });
      },
      execSync: (sql) => sqlite.exec(sql),
      execAsync: (sql) => Promise.resolve(sqlite.exec(sql)),
      runSync: (sql, params) => sqlite.prepare(sql).run(...(params ?? [])),
      runAsync: (sql, params) => {
        const info = sqlite.prepare(sql).run(...(params ?? []));
        return Promise.resolve({
          changes: info.changes,
          lastInsertRowId: Number(info.lastInsertRowid ?? 0),
        });
      },
      getAllSync: (sql, params) => sqlite.prepare(sql).all(...(params ?? [])),
      getAllAsync: (sql, params) => Promise.resolve(sqlite.prepare(sql).all(...(params ?? []))),
      getFirstSync: (sql, params) => sqlite.prepare(sql).get(...(params ?? [])) ?? null,
      getFirstAsync: (sql, params) => Promise.resolve(sqlite.prepare(sql).get(...(params ?? [])) ?? null),
      withExclusiveTransactionAsync: async (task) => {
        sqlite.exec('BEGIN EXCLUSIVE');
        try {
          await task(client);
          sqlite.exec('COMMIT');
        } catch (err) {
          sqlite.exec('ROLLBACK');
          throw err;
        }
      },
      closeAsync: () => Promise.resolve(sqlite.close()),
    };
    dbs.set(name, client);
    return client;
  }

  return {
    openDatabaseAsync: jest.fn((name) => Promise.resolve(makeClient(name))),
  };
});
