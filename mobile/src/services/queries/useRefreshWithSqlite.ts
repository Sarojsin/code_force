import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { localDb } from '../localDb';

type LocalDbUpsertMany = (records: any[]) => Promise<void>;

export function useRefreshWithSqlite(
  queryKey: any[],
  fetchFn: () => Promise<any[]>,
  upsertManyFn?: LocalDbUpsertMany,
) {
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    const data = await fetchFn();
    if (upsertManyFn && Array.isArray(data) && data.length > 0) {
      await upsertManyFn(data);
    }
    qc.setQueryData(queryKey, data);
  }, [queryKey, fetchFn, upsertManyFn, qc]);

  return refresh;
}

const upsertMap: Record<string, LocalDbUpsertMany> = {
  cycle: (r) => localDb.cycle.upsertMany(r),
  journal: (r) => localDb.journal.upsertMany(r),
  mood: (r) => localDb.mood.upsertMany(r),
  emergencyContact: (r) => localDb.emergencyContact.upsertMany(r),
};

export function getUpsertMany(entity: string): LocalDbUpsertMany | undefined {
  return upsertMap[entity];
}
