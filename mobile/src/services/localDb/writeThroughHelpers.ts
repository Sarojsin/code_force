import { localDb } from './index';

export async function upsertCycleEntry(serverData: Record<string, unknown>): Promise<void> {
  const id = serverData.id as string | undefined;
  const existing = id ? await localDb.cycle.getById(id) : null;
  await localDb.cycle.upsert({
    ...(existing ?? {}),
    ...serverData,
    synced_at: new Date().toISOString(),
  } as any);
}

export async function upsertJournalEntry(serverData: Record<string, unknown>): Promise<void> {
  const id = serverData.id as string | undefined;
  const existing = id ? await localDb.journal.getById(id) : null;
  await localDb.journal.upsert({
    ...(existing ?? {}),
    ...serverData,
    synced_at: new Date().toISOString(),
  } as any);
}

export async function upsertMoodLog(serverData: Record<string, unknown>): Promise<void> {
  const id = serverData.id as string | undefined;
  const existing = id ? await localDb.mood.getById(id) : null;
  await localDb.mood.upsert({
    ...(existing ?? {}),
    ...serverData,
    synced_at: new Date().toISOString(),
  } as any);
}

export async function upsertEmergencyContact(serverData: Record<string, unknown>): Promise<void> {
  const id = serverData.id as string | undefined;
  const existing = id ? await localDb.emergencyContact.getById(id) : null;
  await localDb.emergencyContact.upsert({
    ...(existing ?? {}),
    ...serverData,
    synced_at: new Date().toISOString(),
  } as any);
}

export async function upsertSosAlert(serverData: Record<string, unknown>): Promise<void> {
  const id = serverData.id as string | undefined;
  const existing = id ? await localDb.sosAlert.getById(id) : null;
  await localDb.sosAlert.upsert({
    ...(existing ?? {}),
    ...serverData,
    synced_at: new Date().toISOString(),
  } as any);
}

export async function upsertPregnancyProfile(serverData: Record<string, unknown>): Promise<void> {
  const id = serverData.id as string | undefined;
  const existing = id ? await localDb.pregnancyProfile.getById(id) : null;
  await localDb.pregnancyProfile.upsert({
    ...(existing ?? {}),
    ...serverData,
    synced_at: new Date().toISOString(),
  } as any);
}

export async function softDeleteLocalEntity(
  service: { softDelete: (id: string) => Promise<void> },
  id: string,
): Promise<void> {
  await service.softDelete(id);
}
