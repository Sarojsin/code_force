import { localDb } from './index';
import { requestIdleIdle } from '../../utils/idle';

let writeChain: Promise<void> = Promise.resolve();

function enqueueWrite(run: () => Promise<void>): void {
  writeChain = writeChain.then(() => new Promise<void>((resolve) => {
    requestIdleIdle(() => {
      run().finally(resolve);
    });
  }));
}

export function upsertCycleEntry(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.cycle.getById(id) : null;
    await localDb.cycle.upsert({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    } as any);
  });
}

export function upsertJournalEntry(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.journal.getById(id) : null;
    await localDb.journal.upsert({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    } as any);
  });
}

export function upsertMoodLog(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.mood.getById(id) : null;
    await localDb.mood.upsert({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    } as any);
  });
}

export function upsertEmergencyContact(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.emergencyContact.getById(id) : null;
    await localDb.emergencyContact.upsert({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    } as any);
  });
}

export function upsertSosAlert(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.sosAlert.getById(id) : null;
    await localDb.sosAlert.upsert({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    } as any);
  });
}

export function upsertSnoozeEvent(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.snoozeEvent.getById(id) : null;
    await localDb.snoozeEvent.upsert({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    } as any);
  });
}

export function upsertPregnancyProfile(serverData: Record<string, unknown>): void {
  enqueueWrite(async () => {
    const id = serverData.id as string | undefined;
    const existing = id ? await localDb.pregnancyProfile.getById(id) : null;
    await localDb.pregnancyProfile.upsert({
      ...(existing ?? {}),
      ...serverData,
      synced_at: new Date().toISOString(),
    } as any);
  });
}

export function softDeleteLocalEntity(
  service: { softDelete: (id: string) => Promise<void> },
  id: string,
): void {
  enqueueWrite(() => service.softDelete(id));
}
