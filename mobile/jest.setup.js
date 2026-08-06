// jest.setup.js - runs before the test framework is installed

// expo-crypto mock. `randomUUID` stays deterministic; the AES-GCM surface
// (luna2phase2 §1.3 value encryption) is a reversible test double so
// encrypted-value round-trips run in-memory.
jest.mock('expo-crypto', () => {
  const enc = (s) => Buffer.from(s, 'utf8').toString('base64');
  const dec = (b) => Buffer.from(b, 'base64').toString('utf8');

  class MockEncryptionKey {
    size = 256;
    static async generate() {
      return new MockEncryptionKey();
    }
    static async import() {
      return new MockEncryptionKey();
    }
    async bytes() {
      return new Uint8Array(32).fill(7);
    }
    async encoded() {
      return Buffer.from(new Uint8Array(32).fill(7)).toString('base64');
    }
  }

  class MockSealedData {
    static fromCombined(combined) {
      return new MockSealedData(combined);
    }
    constructor(combinedB64) {
      this._combined = combinedB64;
      this.combinedSize = combinedB64.length;
      this.ivSize = 12;
      this.tagSize = 16;
    }
    async combined(encoding = 'bytes') {
      if (encoding === 'base64') return this._combined;
      const payload = dec(this._combined).replace(/^SEALED\./, '');
      return new Uint8Array(Buffer.from(payload, 'base64'));
    }
    async iv(encoding = 'bytes') {
      const b = new Uint8Array(12);
      return encoding === 'base64' ? Buffer.from(b).toString('base64') : b;
    }
    async tag(encoding = 'bytes') {
      const b = new Uint8Array(16);
      return encoding === 'base64' ? Buffer.from(b).toString('base64') : b;
    }
    async ciphertext(options = {}) {
      return this.combined(options.encoding ?? 'bytes');
    }
  }

  return {
    randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
    getRandomBytes: (n) => new Uint8Array(n),
    getRandomBytesAsync: async (n) => new Uint8Array(n),
    getRandomValues: (arr) => arr,
    digest: async () => new ArrayBuffer(32),
    digestStringAsync: async (_algorithm, data, _options) =>
      Buffer.from(String(data)).toString('hex'),
    AESKeySize: { AES128: 128, AES192: 192, AES256: 256 },
    AESEncryptionKey: MockEncryptionKey,
    AESSealedData: MockSealedData,
    aesEncryptAsync: async (plaintextB64) =>
      new MockSealedData(enc('SEALED.' + plaintextB64)),
    aesDecryptAsync: async (sealed, _key, options = {}) => {
      const payload = dec(sealed._combined).replace(/^SEALED\./, '');
      if (options.output === 'base64') return payload;
      return new Uint8Array(Buffer.from(payload, 'base64'));
    },
  };
});

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

// expo-speech mock (luna2phase3 TTS). speak/stop/getAvailableVoicesAsync are
// jest.fn so tests can assert calls and fire the utterance callbacks manually.
jest.mock('expo-speech', () => {
  const VoiceQuality = { Default: 'Default', Enhanced: 'Enhanced' };
  return {
    speak: jest.fn(() => {}),
    stop: jest.fn(),
    getAvailableVoicesAsync: jest.fn(async () => []),
    isSpeakingAsync: jest.fn(async () => false),
    VoiceQuality,
  };
});
