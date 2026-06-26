import { create } from 'zustand';
import { EncryptedStorage } from 'src/services/storage';
import { logger } from 'src/utils';
import type { PendingOperation } from 'src/services/sync';

const QUEUE_KEY = 'shecare.offline.queue';

interface OfflineState {
  operations: PendingOperation[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  enqueue: (op: Omit<PendingOperation, 'id' | 'createdAt' | 'retryCount' | 'maxRetries'>) => Promise<string>;
  remove: (id: string) => Promise<void>;
  removeMany: (ids: string[]) => Promise<void>;
  removeCascading: (tempId: string) => Promise<void>;
  incrementRetry: (id: string) => Promise<void>;
  getPendingOperations: () => PendingOperation[];
  discard: (id: string) => Promise<void>;
  discardMany: (ids: string[]) => Promise<void>;
  size: () => number;
  clear: () => Promise<void>;
  clearFailed: (maxRetries?: number) => Promise<void>;
}

async function persist(ops: PendingOperation[]): Promise<void> {
  try {
    await EncryptedStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  } catch (err) {
    logger.error('offlineStore.persist_failed', err);
  }
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  operations: [],
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await EncryptedStorage.getItem(QUEUE_KEY);
      if (raw) {
        set({ operations: JSON.parse(raw) as PendingOperation[] });
      }
    } catch (err) {
      logger.error('offlineStore.hydrate_failed', err);
    } finally {
      set({ isHydrated: true });
    }
  },

  enqueue: async (op) => {
    const id = crypto.randomUUID();
    const newOp: PendingOperation = {
      ...op,
      id,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 5,
    };
    const ops = [...get().operations, newOp];
    set({ operations: ops });
    await persist(ops);
    return id;
  },

  remove: async (id) => {
    const ops = get().operations.filter(o => o.id !== id && o.tempId !== id);
    set({ operations: ops });
    await persist(ops);
  },

  removeMany: async (ids) => {
    const idSet = new Set(ids);
    const ops = get().operations.filter(o => !idSet.has(o.id) && !(o.tempId && idSet.has(o.tempId)));
    set({ operations: ops });
    await persist(ops);
  },

  removeCascading: async (tempId) => {
    const ops = get().operations.filter(o => o.tempId !== tempId);
    set({ operations: ops });
    await persist(ops);
  },

  incrementRetry: async (id) => {
    const ops = get().operations.map(o =>
      o.id === id ? { ...o, retryCount: o.retryCount + 1 } : o,
    );
    set({ operations: ops });
    await persist(ops);
  },

  getPendingOperations: () => get().operations.filter(o => o.retryCount < o.maxRetries),

  discard: async (id) => {
    const ops = get().operations.filter(o => o.id !== id);
    set({ operations: ops });
    await persist(ops);
  },

  discardMany: async (ids) => {
    const idSet = new Set(ids);
    const ops = get().operations.filter(o => !idSet.has(o.id));
    set({ operations: ops });
    await persist(ops);
  },

  size: () => get().operations.length,

  clear: async () => {
    set({ operations: [] });
    await persist([]);
  },

  clearFailed: async (maxRetries = 5) => {
    const ops = get().operations.filter(o => o.retryCount < maxRetries);
    set({ operations: ops });
    await persist(ops);
  },
}));
