import { localDb } from './index';
import { requestIdleIdle } from '../../utils/idle';
import { useAuthStore } from 'src/stores/authStore';

let writeChain: Promise<void> = Promise.resolve();

function enqueueWrite(run: () => Promise<void>): void {
  writeChain = writeChain.then(() => new Promise<void>((resolve) => {
    requestIdleIdle(() => {
      run().finally(resolve);
    });
  }));
}

function withUserId(record: Record<string, unknown>): Record<string, unknown> {
  if (record.user_id) return record;
  const user = useAuthStore.getState().user;
  return user ? { ...record, user_id: user.id } : record;
}

export function upsertCycleEntry(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.cycle.getById(id) : null;
    await localDb.cycle.upsert(withUserId({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    }) as any);
  });
}

export function upsertJournalEntry(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.journal.getById(id) : null;
    await localDb.journal.upsert(withUserId({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    }) as any);
  });
}

export function upsertMoodLog(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.mood.getById(id) : null;
    await localDb.mood.upsert(withUserId({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    }) as any);
  });
}

export function upsertEmergencyContact(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.emergencyContact.getById(id) : null;
    await localDb.emergencyContact.upsert(withUserId({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    }) as any);
  });
}

export function upsertSosAlert(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.sosAlert.getById(id) : null;
    await localDb.sosAlert.upsert(withUserId({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    }) as any);
  });
}

export function upsertSnoozeEvent(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.snoozeEvent.getById(id) : null;
    await localDb.snoozeEvent.upsert(withUserId({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    }) as any);
  });
}

export function upsertCycleDay(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.cycleDay.getById(id) : null;
    await localDb.cycleDay.upsertDayFromServer(withUserId({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    }));
  });
}

export function upsertPregnancyProfile(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.pregnancyProfile.getById(id) : null;
    await localDb.pregnancyProfile.upsert(withUserId({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    }) as any);
  });
}

export function softDeleteLocalEntity(
  service: { softDelete: (id: string) => Promise<void> },
  id: string,
): void {
  enqueueWrite(() => service.softDelete(id));
}
