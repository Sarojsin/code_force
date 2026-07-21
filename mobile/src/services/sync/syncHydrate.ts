import { localDb } from '../localDb';
import { logger } from '../../utils';
import { useSyncMetricsStore } from '../../stores/syncMetricsStore';
import type { SyncChangeItem } from './types';

const TYPE_TO_DB_METHOD: Record<string, keyof typeof localDb> = {
  'cycle/create': 'cycle',
  'cycle/update': 'cycle',
  'cycle/correction': 'cycle',
  'cycle/snooze': 'cycle',
  'journal/create': 'journal',
  'journal/update': 'journal',
  'mood/create': 'mood',
  'safety/contact/create': 'emergencyContact',
  'safety/contact/update': 'emergencyContact',
  'safety/contact/delete': 'emergencyContact',
  'safety/sos/trigger': 'sosAlert',
  'safety/sos/cancel': 'sosAlert',
  'safety/sos/resolve': 'sosAlert',
  'sos/trigger': 'sosAlert',
  'breathing/complete': 'cycle',
  'family/create': 'familyLink',
  'family/update': 'familyLink',
  'family/delete': 'familyLink',
};

function mapOperationTypeToService(operationType: string): keyof typeof localDb | null {
  return TYPE_TO_DB_METHOD[operationType] ?? null;
}

export async function hydrateFromServerData(
  operationType: string,
  serverData: Record<string, unknown>
): Promise<void> {
  const serviceKey = mapOperationTypeToService(operationType);
  if (!serviceKey) return;

  try {
    const service = localDb[serviceKey];
    if (typeof (service as any).upsert === 'function') {
      const start = performance.now();
      await (service as any).upsert(serverData);
      useSyncMetricsStore.getState().recordSqliteWrite(performance.now() - start);
    }
  } catch (error) {
    useSyncMetricsStore.getState().recordSqliteError();
    logger.warn('sync.hydrate.push_failed', { operationType, error });
  }
}

export async function hydrateChangeItem(change: SyncChangeItem): Promise<void> {
  const entityType = change.entity_type;

  let service: any = null;
  if (entityType === 'cycle') service = localDb.cycle;
  else if (entityType === 'journal') service = localDb.journal;
  else if (entityType === 'mood') service = localDb.mood;
  else if (entityType === 'emergency_contact') service = localDb.emergencyContact;
  else if (entityType === 'sos_alert') service = localDb.sosAlert;
  else if (entityType === 'family_link') service = localDb.familyLink;
  else if (entityType === 'pregnancy_profile') service = localDb.pregnancyProfile;
  else if (entityType === 'pregnancy_milestone') service = localDb.pregnancyMilestone;
  else if (entityType === 'health_insight') service = localDb.healthInsight;
  else if (entityType === 'feature_flag') service = localDb.featureFlag;

  if (!service) return;

  try {
    if (change.action === 'deleted' && typeof service.softDelete === 'function') {
      const start = performance.now();
      await service.softDelete(change.entity_id);
      useSyncMetricsStore.getState().recordSqliteWrite(performance.now() - start);
    } else if (change.action === 'created' || change.action === 'updated') {
      if (typeof service.upsert === 'function') {
        const start = performance.now();
        await service.upsert(change.data);
        useSyncMetricsStore.getState().recordSqliteWrite(performance.now() - start);
      }
    }
  } catch (error) {
    useSyncMetricsStore.getState().recordSqliteError();
    logger.warn('sync.hydrate.pull_failed', { entityType, action: change.action, error });
  }
}

export async function hydrateChangeItems(changes: SyncChangeItem[]): Promise<void> {
  for (const change of changes) {
    await hydrateChangeItem(change);
  }
}
