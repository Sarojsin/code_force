import { localDb } from './index';

/**
 * Seed day-observation masters (symptoms + medications) from bundled JSON
 * on first launch (DayDetailShee_plan.md §13.2). Idempotent — no-ops when
 * already seeded. Background server re-sync happens via useSymptoms /
 * useMedications hooks.
 */
export async function seedDayMastersIfNeeded(): Promise<void> {
  try {
    await localDb.dayMaster.ensureSeeded();
  } catch {
    // Migration 0008 may not have run yet — suppress and let the hooks retry.
  }
}
