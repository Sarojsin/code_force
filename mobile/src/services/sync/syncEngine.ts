import { AxiosError } from 'axios';
import pako from 'pako';
import * as Sentry from '@sentry/react-native';
import { api } from 'src/services/api/client';
import { EncryptedStorage } from 'src/services/storage';
import { logger } from 'src/utils';
import { useAuthStore } from 'src/stores/authStore';
import { useOfflineStore } from 'src/stores/offlineStore';
import { useSyncMetricsStore } from 'src/stores/syncMetricsStore';

import type { PendingOperation, SyncBatchResponse, SyncChangesResponse } from './types';

let _queryClient: any = null;
let _isSyncing = false;

export function setQueryClient(qc: any): void {
  _queryClient = qc;
}

function isRetryableError(error: unknown): boolean {
  const axiosErr = error as AxiosError;
  const status = axiosErr?.response?.status;
  if (!status) return true;
  return status === 429 || (status >= 500 && status < 600);
}

const GZIP_THRESHOLD = 10;

export async function pushOperations(ops: PendingOperation[]): Promise<void> {
  if (ops.length === 0) return;

  const user = useAuthStore.getState().user;
  if (!user) {
    logger.info('sync.push_skipped_no_auth');
    return;
  }

  const store = useOfflineStore.getState();
  const operations = ops.map(op => ({
    type: op.type,
    data: { ...op.data, client_updated_at: op.clientUpdatedAt },
    temp_id: op.tempId,
    idempotency_key: op.idempotencyKey,
    client_updated_at: op.clientUpdatedAt,
  }));

  const config: Record<string, any> = {};
  const payload = { operations };

  if (operations.length >= GZIP_THRESHOLD) {
    config.transformRequest = [
      (data: any) => {
        const json = typeof data === 'string' ? data : JSON.stringify(data);
        return pako.gzip(json) as any;
      },
    ];
    config.headers = { 'Content-Encoding': 'gzip', ...config.headers };
  }

  try {
    const response = await api.post<SyncBatchResponse>('/sync/batch', payload, config);
    const results = response.data.results;

    const succeeded: string[] = [];
    const failedOps: PendingOperation[] = [];
    let stopBatch = false;

    for (let i = 0; i < results.length; i++) {
      if (stopBatch) break;

      const result = results[i];
      const op = ops[i];
      if (!op) continue;

      if (result.status === 'created' || result.status === 'updated' || result.status === 'deleted') {
        succeeded.push(op.tempId || op.id);
      } else if (result.status === 'conflict') {
        logger.warn('sync.conflict', { entity_id: result.entity_id });
        succeeded.push(op.tempId || op.id);
        if (result.server_data && result.entity_id && _queryClient) {
          const { inferQueryKey, inferBaseQueryKey } = require('./queryKeyMapper');
          const qKey = inferQueryKey(op.type, result.entity_id);
          const baseKey = inferBaseQueryKey(op.type);
          if (qKey.length > 0) {
            _queryClient.setQueryData(qKey, (old: any) => {
              if (!old) return old;
              if (Array.isArray(old)) {
                return old.map((item: any) =>
                  item.id === result.entity_id || item.id === op.tempId
                    ? { ...result.server_data, _conflict_resolved: true }
                    : item
                );
              }
              return old;
            });
          }
          if (baseKey.length > 0) {
            _queryClient.invalidateQueries({ queryKey: baseKey });
          }
        }
      } else {
        if (result.status === 'failed') {
          const isNonRetryable = (
            (result.error?.includes('400') || result.error?.includes('VALIDATION')) ??
            (result.error?.includes('401') || result.error?.includes('UNAUTHORIZED')) ??
            (result.error?.includes('404') || result.error?.includes('NOT_FOUND'))
          );

          if (isNonRetryable) {
            store.discard(op.id);
            if (op.type.endsWith('/create') && op.tempId) {
              store.removeCascading(op.tempId);
            }
            continue;
          }
        }
        failedOps.push(op);
      }
    }

    if (succeeded.length > 0) {
      store.removeMany(succeeded);
    }

    for (const failedOp of failedOps) {
      if (failedOp.type.endsWith('/create')) {
        if (failedOp.tempId) {
          store.removeCascading(failedOp.tempId);
        }
      } else {
        store.incrementRetry(failedOp.id);
      }
    }
  } catch (error) {
    logger.error('sync.push_failed', error);
    if (!isRetryableError(error)) {
      for (const op of ops) {
        store.discard(op.id);
        if (op.type.endsWith('/create') && op.tempId) {
          store.removeCascading(op.tempId);
        }
      }
    } else {
      for (const op of ops) {
        store.incrementRetry(op.id);
      }
    }
  }
}

export async function pullServerData(): Promise<string | null> {
  let since: string | null = null;
  try {
    since = await EncryptedStorage.getItem('shecare.sync.lastPull');
  } catch {}

  const params: Record<string, string> = {};
  if (since) params.since = since;

  try {
    const response = await api.get<SyncChangesResponse>('/sync/changes', { params });
    const { changes } = response.data;

    if (changes.length > 0) {
      const latestChange = changes[changes.length - 1].updated_at;
      await EncryptedStorage.setItem('shecare.sync.lastPull', latestChange);

      if (_queryClient) {
        _queryClient.invalidateQueries();
      }
    }

    return changes.length > 0 ? changes[changes.length - 1].updated_at : null;
  } catch (error) {
    logger.warn('sync.pull_failed', error);
    return null;
  }
}

function getRetryableOps(ops: PendingOperation[]): PendingOperation[] {
  const exhausted: string[] = [];
  const retryable: PendingOperation[] = [];

  for (const op of ops) {
    if (op.retryCount >= op.maxRetries) {
      exhausted.push(op.id);
    } else {
      retryable.push(op);
    }
  }

  if (exhausted.length > 0) {
    const store = useOfflineStore.getState();
    store.discardMany(exhausted);
  }

  return retryable;
}

export async function syncAll(): Promise<void> {
  if (_isSyncing) {
    logger.warn('sync.cycle.skipped_already_syncing');
    return;
  }

  const user = useAuthStore.getState().user;
  if (!user) {
    logger.warn('sync.cycle.skipped_no_auth');
    return;
  }

  Sentry.setTag('sync.is_syncing', 'true');

  _isSyncing = true;
  const startTime = Date.now();
  const store = useOfflineStore.getState();
  const queueSizeBefore = store.operations.length;

  logger.info('sync.cycle.starting', {
    event: 'sync_cycle_started',
    queue_size: queueSizeBefore,
    user_id: user.id,
  });

  let opsPushed = 0;
  let opsPulled = 0;

  try {
    const pending = store.getPendingOperations();
    const pendingToPush = getRetryableOps(pending);

    if (pendingToPush.length > 0) {
      logger.info('sync.push.starting', {
        event: 'sync_push_started',
        op_count: pendingToPush.length,
      });
      await pushOperations(pendingToPush);
      opsPushed = pendingToPush.length;
    }

    const latestTimestamp = await pullServerData();
    if (latestTimestamp) {
      opsPulled = 1;
    }

    const queueSizeAfter = store.operations.length;
    const duration = Date.now() - startTime;

    logger.info('sync.cycle.completed', {
      event: 'sync_cycle_completed',
      duration_ms: duration,
      ops_pushed: opsPushed,
      ops_pulled: opsPulled,
      queue_size_before: queueSizeBefore,
      queue_size_after: queueSizeAfter,
      user_id: user.id,
    });

    const metrics = useSyncMetricsStore.getState();
    metrics.recordSync('success', duration, opsPushed, opsPulled, queueSizeAfter);
  } catch (error) {
    const duration = Date.now() - startTime;

    Sentry.captureException(error, {
      tags: {
        sync_phase: opsPushed > 0 ? 'push' : 'pull',
        queue_size: String(queueSizeBefore),
      },
      extra: {
        pending_ops: store.operations.slice(0, 50).map(o => ({
          id: o.id,
          type: o.type,
          priority: o.priority,
          retryCount: o.retryCount,
        })),
      },
    });

    logger.error('sync.cycle.failed', {
      event: 'sync_cycle_failed',
      duration_ms: duration,
      queue_size_before: queueSizeBefore,
      error: error instanceof Error ? error.message : String(error),
      user_id: user.id,
    });

    const metrics = useSyncMetricsStore.getState();
    metrics.recordSync('failed', duration, opsPushed, opsPulled, store.operations.length);
  } finally {
    Sentry.setTag('sync.is_syncing', 'false');
    _isSyncing = false;
  }
}
