import { EncryptedStorage } from 'src/services/storage';
import { safetyService, SosTriggerRequest } from 'src/services/api';
import { logger } from 'src/utils';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'shecare.safety.offlineQueue';

export interface QueuedSosItem {
  id: string;
  data: SosTriggerRequest;
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
    id: `sos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    data,
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

export async function syncQueue(): Promise<void> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const queue = await getQueue();
  if (queue.length === 0) return;

  // Process critical items first, then normal, then low
  const sorted = queue.sort((a, b) => {
    const order = { critical: 0, normal: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  const remaining: QueuedSosItem[] = [];
  for (const item of sorted) {
    try {
      await safetyService.triggerSos(item.data, item.idempotencyKey);
      logger.info('safetySyncQueue.synced', { id: item.id });
    } catch (err) {
      item.retryCount += 1;
      if (item.retryCount < 5) {
        remaining.push(item);
      } else {
        logger.warn('safetySyncQueue.dropped', { id: item.id, retries: item.retryCount });
      }
    }
  }
  await saveQueue(remaining);
}

export async function getQueueSize(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}
