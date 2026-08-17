/**
 * sessionReset — complete per-user session isolation on logout.
 *
 * Golden rule (see plans/signin_signout_flow_logic.md): anything tied to a user
 * must be cleared. ZERO exceptions. If a new Zustand store, storage key, or
 * SQLite table is added, it MUST be added to this file in the same PR.
 *
 * Order matters: clear in-memory (stores) first → then encrypted → then
 * async storage → then SQLite → then the React Query cache.
 */

import { deleteDatabaseAsync } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EncryptedStorage } from 'src/services/storage';
import { closeDb } from 'src/db/connection';
import { runMigrations } from 'src/db/runMigrations';
import { clearQueryCache } from 'src/services/sync/syncEngine';
import { logger } from 'src/utils';

// ----- All Zustand stores (extend this list as new stores are added) -----
import { useAuthStore } from 'src/stores/authStore';
import { useOnboardingStore } from 'src/stores/onboardingStore';
import { useCycleStore } from 'src/stores/cycleStore';
import { useSafetyStore } from 'src/stores/safetyStore';
import { useOfflineStore } from 'src/stores/offlineStore';
import { useCompanionStore } from 'src/stores/companionStore';
import { useEndDateStore } from 'src/stores/endDateStore';
import { useHealthMetricsStore } from 'src/stores/healthMetricsStore';
import { useAchievementStore } from 'src/stores/achievementStore';
import { useDiaryAssetStore } from 'src/stores/diaryAssetStore';
import { useDownloadStore } from 'src/stores/downloadStore';
import { useSyncMetricsStore } from 'src/stores/syncMetricsStore';
import { usePregnancyModeStore } from 'src/stores/pregnancyModeStore';

// ----- EncryptedStorage keys (explicit removeItem — clear() is a no-op) -----
const ENCRYPTED_KEYS = [
  'shecare.accessToken',
  'shecare.refreshToken',
  'shecare.user',
  'user_preferences',
  'shecare.session_analytics_id',
  'draft_metadata',
  'shecare.offline.queue',
  'local_correction_delta',
  'shecare.sync.lastPull',
  'global_model_json',
  'global_model_version',
  'shecare.sqlite.backfilled',
  'shecare_sticky_snooze_v2',
];

// ----- AsyncStorage keys -----
const ASYNC_KEYS = [
  'shecare.onboarding',
  'shecare_pregnancy_mode',
  'REACT_QUERY_OFFLINE_CACHE',
  'shecare.last_known_location',
  'shecare.sticky_snooze',
  'shecare.db_maintenance.last_run',
  'shecare.sync.metrics',
  'shecare.sync.metrics_v2',
];

// Fallback DELETE list. Keep in sync with src/db/schema.ts — new tables MUST be
// added here.
const ALL_TABLES = [
  'user_profiles',
  'onboarding_data',
  'cycle_entries',
  'journal_entries',
  'mood_logs',
  'emergency_contacts',
  'sos_alerts',
  'pregnancy_profiles',
  'pregnancy_daily_logs',
  'pregnancy_milestones',
  'pregnancy_recommendations',
  'family_links',
  'chat_rooms',
  'nurse_contents',
  'feature_flags',
  'health_insights',
  'predictions',
  'snooze_events',
  'sync_log',
  'companion_metadata',
  'health_metrics',
  'diaries',
  'diary_pages',
  'diary_page_objects',
  'diary_media',
  'diary_assets',
];

/**
 * Delete-and-recreate the SQLite file. Falls back to DELETE FROM per table if
 * the atomic delete fails (rare permission errors).
 */
async function purgeSQLite(): Promise<void> {
  try {
    // Release file locks on Android before deleting.
    await closeDb();
    await deleteDatabaseAsync('shecare.db');
    // Re-create the empty schema in the same process, so a re-login without an
    // app restart still has functional tables.
    try {
      await runMigrations();
    } catch (migrateErr) {
      logger.warn('sessionReset.sqlite.remigrate_failed', migrateErr);
    }
    logger.info('sessionReset.sqlite.deleted');
    return;
  } catch (err) {
    logger.warn('sessionReset.sqlite.delete_failed_falling_back', err);
  }

  // Fallback: trim all rows (PRAGMA foreign_keys off during cascade-free wipe).
  try {
    const { getNativeDb, runExclusive } = await import('src/db/connection');
    await runExclusive(async () => {
      const db = await getNativeDb();
      const deletes = ALL_TABLES.map((t) => `DELETE FROM "${t}";`).join('\n');
      await db.execAsync(`PRAGMA foreign_keys = OFF;\n${deletes}\nPRAGMA foreign_keys = ON;`);
    });
    logger.info('sessionReset.sqlite.truncated');
  } catch (err) {
    logger.error('sessionReset.sqlite.fallback_failed', err);
  }
}

/**
 * Reset every Zustand store to its initial state. Add ANY new store here.
 */
function resetStores(): Array<Promise<void>> {
  const jobs: Array<Promise<void>> = [];

  // async store resets
  const auth = useAuthStore.getState().reset;
  if (typeof auth === 'function') jobs.push(Promise.resolve(auth()));
  const onboarding = useOnboardingStore.getState().reset;
  if (typeof onboarding === 'function') jobs.push(Promise.resolve(onboarding()));
  const offline = useOfflineStore.getState().clear;
  if (typeof offline === 'function') jobs.push(Promise.resolve(offline()));
  const pregnancy = usePregnancyModeStore.getState().reset;
  if (typeof pregnancy === 'function') jobs.push(Promise.resolve(pregnancy()));

  // sync store resets
  useCycleStore.getState().resetLocalDelta();
  useSafetyStore.getState().clearAlert();
  useCompanionStore.getState().reset();
  useEndDateStore.getState().clearPending();
  useHealthMetricsStore.getState().reset();
  useAchievementStore.getState().reset();
  useDiaryAssetStore.getState().reset();
  useDownloadStore.getState().reset();
  useSyncMetricsStore.getState().reset();

  return jobs;
}

/**
 * Complete per-user session reset. Call BEFORE navigating to the Auth stack.
 */
export async function resetAppForLogout(): Promise<void> {
  try {
    // 1. In-memory stores first (avoids 1-frame stale-data flash).
    const jobs = resetStores();
    await Promise.allSettled(jobs);

    // 2. Encrypted storage keys.
    await Promise.allSettled(ENCRYPTED_KEYS.map((k) => EncryptedStorage.removeItem(k)));

    // 2b. Luna sync queue (per-user key — see sessionReset golden rule).
    try {
      const { clearLunaSync } = await import('src/services/companion/lunaSyncClient');
      const uid = useAuthStore.getState().user?.id;
      if (uid) await clearLunaSync(uid);
    } catch {
      // suppress — queue cleared on next app start if import fails
    }

    // 3. AsyncStorage keys.
    await Promise.allSettled(ASYNC_KEYS.map((k) => AsyncStorage.removeItem(k)));

    // 4. Purge SQLite (schema re-created empty on next migration run).
    await purgeSQLite();

    // 5. Clear the React Query cache so stale user data is never served.
    clearQueryCache();
  } catch (err) {
    logger.error('sessionReset.logout_failed', err);
  }
}