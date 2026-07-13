import { EncryptedStorage } from 'src/services/storage';
import { safetyService, SosTriggerRequest } from 'src/services/api';
import { logger, generateId } from 'src/utils';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'shecare.safety.offlineQueue';

export interface QueuedSosItem {
  id: string;
  type: 'safety/sos/trigger' | 'safety/sos/resolve' | 'safety/sos/cancel';
  data: Record<string, unknown>;
  sosId?: string;
  idempotencyKey: string;
  priority: 'critical' | 'normal' | 'low';
  createdAt: string;
  retryCount: number;
}

async function getQueue(): Promise<QueuedSosItem[]> {
  try {
    const raw = await EncryptedStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedSosItem[]): Promise<void> {
  await EncryptedStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueSos(data: SosTriggerRequest): Promise<string> {
  const item: QueuedSosItem = {
    id: generateId(),
    type: 'safety/sos/trigger',
    data: data as unknown as Record<string, unknown>,
    idempotencyKey: `sos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    priority: 'critical',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  const queue = await getQueue();
  queue.unshift(item);
  await saveQueue(queue);
  return item.id;
}

export async function enqueueResolve(sosId: string): Promise<void> {
  const queue = await getQueue();
  queue.push({
    id: generateId(),
    type: 'safety/sos/resolve',
    data: { sos_id: sosId },
    sosId,
    idempotencyKey: generateId(),
    priority: 'critical',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  await saveQueue(queue);
}

export async function enqueueCancel(sosId: string): Promise<void> {
  const queue = await getQueue();
  queue.push({
    id: generateId(),
    type: 'safety/sos/cancel',
    data: { sos_id: sosId, false_alarm: true },
    sosId,
    idempotencyKey: generateId(),
    priority: 'critical',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  await saveQueue(queue);
}

export async function syncQueue(): Promise<void> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const queue = await getQueue();
  if (queue.length === 0) return;

  const sorted = queue.sort((a, b) => {
    const order = { critical: 0, normal: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  const remaining: QueuedSosItem[] = [];
  for (const item of sorted) {
    try {
      if (item.type === 'safety/sos/trigger') {
        await safetyService.triggerSos(item.data as unknown as SosTriggerRequest, item.idempotencyKey);
      } else if (item.type === 'safety/sos/resolve' && item.sosId) {
        await safetyService.resolveSos(item.sosId);
      } else if (item.type === 'safety/sos/cancel' && item.sosId) {
        await safetyService.cancelSos(item.sosId);
      }
      logger.info('safetySyncQueue.synced', { id: item.id, type: item.type });
    } catch (err) {
      item.retryCount += 1;
      if (item.retryCount < 5) {
        remaining.push(item);
      } else {
        logger.warn('safetySyncQueue.dropped', { id: item.id, type: item.type, retries: item.retryCount });
      }
    }
  }
  await saveQueue(remaining);
}

export async function getQueueSize(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

export function initSafetyQueueListener(): () => void {
  const unsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncQueue().catch((err) => logger.warn('safetyQueue.sync_on_reconnect', err));
    }
  });
  return unsub;
}
