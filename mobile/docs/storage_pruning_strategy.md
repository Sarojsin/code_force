# SQLite Pruning Strategy

## Why Prune?

- Soft-deleted records accumulate in tables (`is_active = false`, `deleted_at` set). Over years of use, these outnumber active records.
- Journal entries contain large text bodies. A user who journals daily for 5 years will have ~1,825 journal entries averaging ~500 bytes each. Not a problem.
- The real concern is deleted records — a user who bulk-deletes old cycles leaves soft-deleted records that are never cleaned up.

## Pruning Rules

| Action | Target | Criteria | Frequency |
|--------|--------|----------|-----------|
| Hard-delete | Soft-deleted records | `deleted_at < NOW() - 30 days` | Every app launch after migration |
| Trim sync_log | Sync log table | Keep latest 500 records | Every app launch |
| Trim predictions | Predictions table | Keep latest 50 records | Every app launch |
| Vacuum | Database file | After hard-delete batch | Every app launch |

## Implementation

File: `src/services/localDb/pruneLocalDb.ts`

Runs in `App.tsx` after SQLite migration succeeds:

```typescript
if (success && !cleaned.current) {
  cleaned.current = true;
  AsyncStorage.removeItem('REACT_QUERY_OFFLINE_CACHE').catch(() => {});
  pruneLocalDb();
}
```

## Tables with soft-delete support

- `cycle_entries`
- `journal_entries`
- `mood_logs`
- `emergency_contacts`
- `sos_alerts`
- `family_links`

## What NOT to Prune

- Active records — never prune where `is_active = true`.
- Cycle entries less than 2 years old — needed for ML prediction accuracy.
- Mood logs — keep indefinitely (tiny rows, high analytical value).
