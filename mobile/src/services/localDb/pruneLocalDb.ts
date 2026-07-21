import { getNativeDb } from '../../db/connection';
import { logger } from '../../utils';

const TABLES_WITH_SOFT_DELETE = [
  'cycle_entries',
  'journal_entries',
  'mood_logs',
  'emergency_contacts',
  'sos_alerts',
  'family_links',
];

const SOFT_DELETE_TTL_DAYS = 30;
const SYNC_LOG_RETENTION = 500;
const PREDICTION_RETENTION = 50;

export function pruneLocalDb(): void {
  try {
    const db = getNativeDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SOFT_DELETE_TTL_DAYS);
    const cutoffIso = cutoff.toISOString();

    for (const table of TABLES_WITH_SOFT_DELETE) {
      const deleted = db.runSync(
        `DELETE FROM ${table} WHERE is_active = 0 AND deleted_at IS NOT NULL AND deleted_at < ?`,
        [cutoffIso],
      );
      if (deleted.changes > 0) {
        logger.info(`prune.${table}`, { removed: deleted.changes });
      }
    }

    const trimmedLogs = db.runSync(
      `DELETE FROM sync_log WHERE id NOT IN (SELECT id FROM sync_log ORDER BY started_at DESC LIMIT ?)`,
      [SYNC_LOG_RETENTION],
    );
    if (trimmedLogs.changes > 0) {
      logger.info('prune.sync_log', { removed: trimmedLogs.changes });
    }

    const trimmedPredictions = db.runSync(
      `DELETE FROM predictions WHERE id NOT IN (SELECT id FROM predictions ORDER BY synced_at DESC LIMIT ?)`,
      [PREDICTION_RETENTION],
    );
    if (trimmedPredictions.changes > 0) {
      logger.info('prune.predictions', { removed: trimmedPredictions.changes });
    }

    db.runSync('VACUUM');

    logger.info('prune.complete');
  } catch (error) {
    logger.warn('prune.failed', error);
  }
}
