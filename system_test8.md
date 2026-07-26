# Scenario 22: EncryptedStorage Fails (Cannot Read/Write) — Detailed Explanation

This scenario validates the security isolation and graceful degradation of your storage layer. It simulates a rare but critical edge case: the device's SecureStore (iOS Keychain / Android Keystore) becomes corrupted or inaccessible. This could happen due to a failed OS update, full secure storage space, or a hardware fault.

The system must gracefully degrade without crashing, while ensuring the user's historical data (SQLite) is never compromised by the failure of a separate security module.

---

## 1. The Problem: Why SecureStore Fails

| Cause | Description |
|-------|-------------|
| Keychain Corruption | iOS/Android SecureStore becomes unreadable due to a system update or a conflict with other apps. |
| Storage Full | The secure enclave has limited space. If too many apps store tokens, `setItem` throws an error. |
| User Restriction | The user disables "Keychain Access" for the app in iOS settings. |
| Hardware Failure | The secure enclave chip fails or malfunctions. |

**The Critical Risk:** If the app crashes on this error, the user is locked out. Worse, if we treat the error as a "logout" without preserving SQLite, the user loses access to their local history.

---

## 2. The Architecture: Separation of Concerns

This is the most important concept in this scenario:

| Layer | Technology | Storage Location | Dependency on SecureStore? |
|-------|-----------|------------------|----------------------------|
| EncryptedStorage (Vault) | `expo-secure-store` | iOS Keychain / Android Keystore (Hardware-backed) | Self-contained |
| Permanent Cache (SQLite) | `expo-sqlite` | App's Documents Directory (`shecare.db` file) | Completely Independent |

**The Golden Rule:** SQLite does NOT use SecureStore. It reads/writes a standard `.db` file using SQLite's C++ engine. Even if SecureStore is destroyed, the `.db` file remains intact.

---

## 3. Step-by-Step System Behavior

### Step 3A: The Storage Adapter Safety Net (`src/services/storage.ts`)

The adapter wraps every `getItem` and `setItem` call in a try-catch. It does not let the error bubble up to the UI.

**Logic:**

```typescript
async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    // Log to Sentry immediately
    Sentry.captureException(error, { tags: { context: 'storage.getItem', key } });
    // Return null — UI assumes the key doesn't exist
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    Sentry.captureException(error, { tags: { context: 'storage.setItem', key } });
    // Do NOT throw — the UI continues
    // The operation is NOT written to SecureStore, but the app doesn't crash
  }
}
```

**Result:**

- **Reads:** The app acts as if the key doesn't exist (returns `null`).
- **Writes:** The write fails silently (logged to Sentry). The app continues.

---

### Step 3B: Auth Store Degradation (`authStore.hydrate()`)

What happens when the user opens the app?

`authStore.hydrate()` calls `tokenStore.getAccess()`.

`getAccess()` calls `storage.getItem('shecare.accessToken')`.

**SecureStore Error:** `getItem` returns `null` (because the catch swallowed the error).

**Decision:** The `authStore` sees `null` and assumes the user is not logged in.

**Result:** The app navigates to the Auth Stack (Login/Register).

**User Experience:** The user sees the login screen. They are forced to re-authenticate.

**Why this is the safest choice:**

- If SecureStore fails, we cannot trust any cached credentials.
- Requiring re-login ensures the user can re-establish a valid session, which may repair the SecureStore connection.

---

### Step 3C: Offline Queue Degradation (`offlineStore.hydrate()`)

What happens to pending writes?

`offlineStore.hydrate()` calls `storage.getItem('shecare.offline.queue')`.

**SecureStore Error:** `getItem` returns `null`.

**Result:** The `offlineStore` initializes with an empty queue (as if there were no pending writes).

**Data Loss Risk:** The user's unsynced period logs, journals, and corrections are temporarily invisible to the app.

**The Critical Nuance (Data is NOT deleted):**

- The queue is not deleted from SecureStore. The SecureStore is just temporarily unreadable.
- If the user writes a new period while SecureStore is broken, the `setItem` call will silently fail—the new write will not be saved to the queue.
- **Recovery:** On the next successful `setItem` (which might happen after a successful login), the app should attempt to re-hydrate the queue from SecureStore. If the SecureStore recovers, the queue will reappear.

---

### Step 3D: SQLite Remains Fully Functional (The Silver Bullet)

Why this is the hero of this scenario:

`expo-sqlite` writes to `shecare.db` in the app's `FileSystem.documentDirectory`.

This is a standard file on the device's storage—completely independent of the Keychain/Keystore.

**Result:**

- The Calendar loads instantly (dark pink blocks from SQLite).
- Cycle History is visible (all past periods).
- Journal List is visible (all past entries).
- Mood History is visible.

The user does NOT lose access to their historical data. They just lose access to their session token (they must re-login) and any pending writes (unsynced data).

---

## 4. The User Experience (What the User Sees & Does)

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| App Launch | Login Screen appears. | "I need to log in again." |
| During Login | User enters credentials. | "My password is correct." |
| After Login (Success) | App navigates to Main Dashboard. Calendar shows all historical data instantly (from SQLite). | "My data is still here!" |
| Pending Writes (Offline Queue) | If SecureStore is still broken, the pending sync badge is missing. New period logs will not be queued. | "Is my data saving?" (Potential confusion). |
| Queue Recovery | If SecureStore heals, on the next app launch, `offlineStore.hydrate()` reads the queue. The pending operations reappear. | "Oh, my data synced." |

**The Warning Banner:**
If `offlineStore.hydrate()` fails to read the queue (SecureStore broken), the app should display a non-blocking warning banner at the top of the Dashboard:

> "Storage unavailable. Your data is safe, but some features may not work offline. Please restart the app."

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ App does NOT crash. | Mock `expo-secure-store` to throw an exception on `getItemAsync` and `setItemAsync`. Open the app. The app should show the Login screen, not a blank white screen or a crash. | Proves the try-catch wrapper in `storage.ts` is effective. |
| ✅ User is logged out gracefully. | After the SecureStore error, `authStore.hydrate()` should return `null` for the token. The app navigates to Auth Stack. | Proves the app does not "hang" on a loading state or assume an invalid session. |
| ✅ Offline queue is NOT deleted. | Even though `getItem` returns `null`, the `setItem` method should not overwrite the queue with an empty array. The queue data remains in SecureStore (it's just unreadable temporarily). | Proves we are not accidentally clearing the secure storage. |
| ✅ SQLite data is still accessible. | Open the app (offline, with SecureStore broken). Navigate to Cycle History. The data should still be visible (from SQLite). | Proves that the SQLite cache is independent of EncryptedStorage. |
| ✅ Warning banner appears. | When `offlineStore.hydrate()` fails, check if the "Storage unavailable" banner is rendered on the Dashboard. | Proves the user is informed of the degraded state. |

---

## 6. Why This Matters (The Business Logic)

| Without Graceful Degradation | With Graceful Degradation |
|------------------------------|---------------------------|
| App crashes on launch → User deletes the app → Loses all local data. | App shows Login screen → User re-authenticates → Reconnects to the server. |
| User loses offline queue → Pending writes never sync → Data loss. | User loses queue temporarily, but it reappears when SecureStore recovers. |
| Developer gets no error report → Bug remains unfixed for months. | Error is immediately sent to Sentry → Team fixes the underlying SecureStore issue. |

---

## 7. Summary

This scenario proves that your app is resilient against native storage failures. By wrapping all EncryptedStorage calls in try-catch, logging errors to Sentry, and falling back to a degraded state (Login screen), the app ensures that a rare SecureStore failure does not result in a crash or permanent data loss. The separation of SQLite and EncryptedStorage ensures that the user's historical data is always safe, even when the secure token storage fails. 🌸🛡️

---

# Scenario 23: SQLite Fails (Corrupted / Disk Full) — Detailed Explanation

This scenario validates the resilience of the offline-first architecture when the permanent cache (SQLite) becomes unavailable. Unlike EncryptedStorage (which holds tokens and the queue), SQLite holds the historical data (cycles, journals, moods). If SQLite fails, the app must gracefully degrade to a read-only mode using the in-memory React Query cache, while ensuring that new writes are never lost (they are safely queued in EncryptedStorage).

---

## 1. The Problem: Why SQLite Fails

| Cause | Description |
|-------|-------------|
| Disk Full (`SQLITE_FULL`) | The device's storage is completely full. SQLite cannot allocate new pages to write data. |
| Database Corruption (`SQLITE_CORRUPT`) | The `shecare.db` file headers are damaged (e.g., due to a crash during a write operation, or a faulty filesystem). |
| File Locking Issues | Another process (or a previous crashed instance) holds a lock on the `.db` file. |
| Permission Issues | The app loses read/write permissions to its own documents directory (rare on iOS/Android). |

**The Critical Risk:** If the app crashes on a SQLite error, the user loses the ability to log periods, view history, or even open the app. Worse, if we treat the error as "no data available" and clear the React Query cache, the user will see a blank screen.

---

## 2. The Architecture: SQLite vs. React Query Memory

| Layer | Technology | Storage Location | Failure Impact |
|-------|-----------|------------------|----------------|
| Permanent Cache (SQLite) | `expo-sqlite` | App's Documents Directory (`shecare.db` file) | **FAILED** (cannot read/write) |
| Ephemeral Cache (React Query) | In-Memory (RAM) | Volatile memory | **STILL FUNCTIONAL** (holds data from the current session) |
| Write Queue (EncryptedStorage) | `expo-secure-store` | iOS Keychain / Android Keystore | **FUNCTIONAL** (independent of SQLite) |

**The Golden Rule:** The React Query `queryFn` must be structured to handle SQLite failures gracefully. It should not propagate the error to the UI. Instead, it should fall back to the existing in-memory React Query cache (if available) or return an empty array with a warning.

---

## 3. Step-by-Step System Behavior

### Step 3A: The SQLite Error Handler (`BaseLocalService`)

Every SQLite operation in the `localDb` services is wrapped in a try-catch. The base service does not throw errors to the UI.

**Logic:**

```typescript
// src/services/localDb/BaseLocalService.ts
async function getHistory(userId: string): Promise<CycleEntry[]> {
  try {
    return await db.select().from(cycleEntries).where(eq(user_id, userId));
  } catch (error) {
    // Log to Sentry with full context
    Sentry.captureException(error, { 
      tags: { context: 'sqlite.getHistory', userId },
      extra: { error: error.message }
    });
    // Return empty array — UI shows empty state
    return [];
  }
}
```

**Result:** The `queryFn` receives `[]` (empty array) instead of the actual history. But crucially, React Query will keep the previous data in its in-memory cache because `gcTime` hasn't expired.

---

### Step 3B: The Read Path (`queryFn` Fallback Logic)

The `queryFn` must be aware that SQLite might fail. It must attempt to preserve the user's existing session cache.

**Flow:**

1. **Try SQLite:** `const localData = await localDb.cycle.getHistory(userId)`
   - If SQLite succeeds: Return the data.
   - If SQLite fails (returns empty):
     - Check if React Query's in-memory cache has data from earlier in the session: `const cachedData = queryClient.getQueryData(['cycle', 'entries', userId])`
     - If cached data exists: return it (stale, but better than nothing).
     - If no cached data: return `[]`.
2. **Show Toast:** A non-blocking toast appears: "Local storage unavailable. Some data may not be available offline."

**Implementation Snippet:**

```typescript
// src/services/queries/useCycleHistory.ts
const queryFn = async () => {
  if (!userId) return [];

  let localData: CycleEntry[] = [];
  let sqliteError = false;

  // 1. Attempt SQLite read
  try {
    localData = await localDb.cycle.getHistory(userId, options);
  } catch (e) {
    sqliteError = true;
    Sentry.captureException(e);
  }

  // 2. If SQLite failed OR returned empty, fall back to in-memory cache
  if (sqliteError || localData.length === 0) {
    const cachedData = queryClient.getQueryData(['cycle', 'entries', userId]);
    if (cachedData && (cachedData as any[]).length > 0) {
      // Show toast only if SQLite failed
      if (sqliteError) {
        Toast.show({ 
          type: 'warning', 
          text1: 'Local storage unavailable. Showing cached data.' 
        });
      }
      return cachedData;
    }
  }

  return localData;
};
```

---

### Step 3C: The Write Path (Optimistic UI + EncryptedStorage Safety)

**Critical:** The write path does NOT depend on SQLite for success.

1. **Optimistic UI:** The user logs a period. The calendar instantly updates (Dark Pink). React Query cache is updated optimistically.
2. **EncryptedStorage Queue:** The mutation fires. If the network is offline, the operation is queued to EncryptedStorage (which is still functional).
3. **SQLite Attempt (Background):** The mutation attempts to write to SQLite via `localDb.cycle.upsert()`.
4. **If SQLite fails:** The error is caught, logged to Sentry. The operation is not retried immediately.
5. **The Sync Engine will retry:** The `syncEngine` (which runs on the next sync cycle) will attempt to `upsert` the server data into SQLite. When the server returns a 200 OK, the sync engine calls `localDb.cycle.upsert(server_data)` again. At that point, if the disk is still full, it will fail again—but the server already has the data. The SQLite catch-up will happen the moment the disk frees up.

---

## 4. The User Experience (What the User Sees)

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| App Launch (SQLite broken) | Dashboard loads instantly (from in-memory cache or empty state). A subtle warning banner appears at the bottom: "Local storage unavailable." | "I see my data, but there's a warning." |
| Viewing History | Cycle History shows data from the in-memory cache (if available) or empty state. | "I can still see my recent history." |
| Logging a Period (Online) | Calendar updates instantly. Toast: "Saved!" (success). | "My period is logged." |
| Logging a Period (Offline) | Calendar updates instantly. Toast: "Saved offline." | "The app will sync later." |
| Background Sync | Sync engine pushes to server. Server returns 200. SQLite write fails (disk full). The sync engine logs the error to Sentry but does NOT retry immediately (to avoid hammering the disk). | "The data is safe on the server." |
| Disk Frees Up | On the next app launch or sync cycle, the sync engine retries the SQLite upsert. Succeeds. | "The warning banner disappears." |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Graceful degradation (Read). | Mock SQLite to throw an error (or fill the disk). Open the app. The app should not crash. The UI should show data from the in-memory React Query cache (if available) or empty state. | Proves that the `queryFn` catches SQLite errors and does not propagate them to the UI. |
| ✅ App does not crash (Write). | Mock SQLite to throw an error. Log a period. The app should not crash. The calendar should update optimistically. | Proves that the `localDb.cycle.upsert()` call is wrapped in try-catch in the mutation's `onSuccess` handler. |
| ✅ User can still log periods. | While SQLite is broken, log a period offline. The operation should be successfully queued to EncryptedStorage. The `syncEngine` should push it to the server. | Proves that the write path is completely decoupled from SQLite. SQLite is only a "read cache" + "post-sync validation" layer. |
| ✅ Toast appears. | When SQLite fails, a non-blocking toast should appear: "Local storage unavailable." | Proves the user is informed of the degraded state. |
| ✅ Retry on next sync cycle. | After SQLite recovers (disk space freed), the `syncEngine.pullServerData()` or `syncEngine.pushOperations()` should eventually call `localDb.cycle.upsert(server_data)` and succeed. | Proves the system is self-healing. The next network sync fixes the cache. |

---

## 6. Why This Matters (The Business Logic)

| Without Graceful Degradation | With Graceful Degradation |
|------------------------------|---------------------------|
| App crashes on `SQLITE_FULL` → User deletes the app → Loses all local data (even though it's on the server, the UX is terrible). | App shows a warning banner. User can still log periods. The data is safe on the server. |
| User thinks the app is broken because they see a blank screen. | User sees cached data (from React Query memory). They understand the app is in a degraded state. |
| Devs don't know about the disk issue because the app just crashes. | Error is immediately sent to Sentry. The team knows the user's disk is full. |

---

## 7. Summary

This scenario proves that your app is resilient against permanent cache failures. By:

- Wrapping SQLite operations in try-catch and returning `[]` instead of throwing.
- Falling back to the React Query in-memory cache when SQLite fails.
- Decoupling writes from SQLite (writes go to EncryptedStorage → Server → then SQLite).
- Showing a non-blocking warning toast.

The app ensures that a disk full or database corruption does not result in a crash or data loss. The user can still log periods, and the system automatically repairs itself when the disk frees up on the next sync cycle. 🌸🛡️

---

# Scenario 24: App Update (SQLite Schema Migration) — Detailed Explanation

This scenario validates the schema evolution capability of your offline-first architecture. It simulates the most common production event: the development team adds a new feature that requires storing a new piece of data (e.g., a user's stress level during a specific cycle). The app must safely update the local SQLite database schema without losing existing user data, and without the need for a complex cache-busting mechanism (since React Query's AsyncStorage persist has been removed).

---

## 1. The Problem: Schema Drift

| Challenge | Description |
|-----------|-------------|
| Adding New Columns | A new feature requires a new column in the `cycle_entries` table (e.g., `stress_level`). |
| Existing User Data | The user has 3 years of historical cycles stored in SQLite. These rows do not have the new column. |
| App Update Rollout | The user updates the app from the App Store. The new binary expects the `stress_level` column to exist. |
| Data Loss Risk | If the migration fails or crashes the app, the user may be unable to open the app until they reinstall. |

**The Critical Requirement:** The migration must be non-destructive (preserves all existing data), fast (< 500ms), and idempotent (running it twice does not cause errors).

---

## 2. The Architecture: Drizzle + Expo-SQLite

| Component | Role |
|-----------|------|
| Drizzle ORM | Generates the `ALTER TABLE` SQL statements automatically based on your schema changes. |
| `drizzle-kit` | Compares the previous schema (from the migration history) with the new schema and generates a migration file. |
| `useMigrations` Hook | Runs on app launch (`_layout.tsx`). Blocks the UI (Splash Screen) until the migration is complete. |
| `__drizzle_migrations` Table | Internal Drizzle tracking table. Stores which migration versions have already been applied, ensuring migrations are only run once. |

---

## 3. Step-by-Step System Behavior

### Step 3A: Developer Action (Before Release)

**Schema Update:** The developer updates `src/db/schema.ts`:

```typescript
// BEFORE
export const cycleEntries = sqliteTable('cycle_entries', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  period_start_date: text('period_start_date').notNull(),
  // ... other columns
});

// AFTER (Adding stress_level)
export const cycleEntries = sqliteTable('cycle_entries', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  period_start_date: text('period_start_date').notNull(),
  stress_level: text('stress_level'), // NEW
  // ... other columns
});
```

**Migration Generation:** The developer runs:

```bash
npx drizzle-kit generate --name=add_stress_level_to_cycles
```

Drizzle compares the current `schema.ts` with the `__drizzle_migrations` table state in the dev database.

It generates a migration file: `src/db/migrations/0002_add_stress_level_to_cycles.sql`.

The SQL:

```sql
ALTER TABLE cycle_entries ADD COLUMN stress_level TEXT;
```

---

### Step 3B: App Update & Launch (User Side)

**User Updates:** The user downloads the new app version from the App Store/Play Store.

**App Launches:** The app starts. The `useMigrations()` hook in `_layout.tsx` runs immediately, before the Splash Screen disappears.

---

### Step 3C: Migration Execution (The Critical Path)

1. **Check Version:** The hook queries the internal `__drizzle_migrations` table:

   ```sql
   SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1;
   ```

   **Result:** The last applied migration is `0001_initial_schema`.

2. **Apply Pending Migration:** Drizzle detects that `0002_add_stress_level_to_cycles.sql` is pending. It executes the migration inside a SQLite transaction:

   ```sql
   BEGIN TRANSACTION;
   ALTER TABLE cycle_entries ADD COLUMN stress_level TEXT;
   INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('hash_0002', NOW());
   COMMIT;
   ```

3. **Existing Data Preservation:** Because `ALTER TABLE ADD COLUMN` is used (not DROP or RENAME), existing rows remain intact:

   - The 3 years of historical `cycle_entries` are all preserved.
   - For these old rows, `stress_level` is set to `NULL`.

4. **Completion:** The migration finishes (typically < 100ms). The Splash Screen disappears, and the app navigates to the Dashboard.

---

### Step 3D: React Query & SQLite Interaction (The "No Buster" Effect)

**Before (Phase 1 - RQ Persist):**

React Query's AsyncStorage persisted cache would hold the old schema (without `stress_level`). If we added a new column, the cache data shape would be "stale" compared to the new SQLite schema. We had to increment the buster version to force a full cache clear, which caused a mandatory network re-fetch for all users.

**Now (Phase 2 - No RQ Persist):**

React Query's cache is purely in-memory. On a fresh app launch after the update, the in-memory cache is empty. The `queryFn` fires and reads the updated SQLite schema (`stress_level` is included). The app loads the data with the new shape immediately. No stale cache errors. No buster needed. No unnecessary network re-fetch.

**The Service Layer Adaptation:**

```typescript
// The existing BaseLocalService handles the new field gracefully
// Since the schema is updated, the SELECT * returns the new column.
// If a query specifically asks for stress_level (e.g., for analytics), it will be NULL for historical data.
```

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| User skips an update (jumps from v1 to v3). | Drizzle applies migrations in order: `0001` → `0002` → `0003`. All executed sequentially. |
| Migration fails (corrupt database). | The transaction rolls back. The app catches the error, logs to Sentry, and shows a toast: "Failed to update local storage. Please reinstall if issues persist." The app continues with the old schema (if the failure is due to a temporary lock). |
| Downgrade (user rolls back to old version). | The old code does NOT query the new `stress_level` column. Since `SELECT *` in SQLite returns the column, the old app safely ignores it. No errors. |
| Adding a NOT NULL column. | Drizzle Warning: If you add `stress_level: text('stress_level').notNull()`, you MUST provide a `$default` value (e.g., `'medium'`) in the schema. Drizzle will generate a migration that sets the default for existing rows. |

---

## 5. The User Experience

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| Splash Screen | Stays visible for ~500ms longer than usual. | "The app is preparing my data." |
| Post-Launch | Dashboard loads instantly. Historical data appears in the calendar. | "Nothing changed. My data is still here." |
| New Feature (e.g., Stress Log) | User logs a new period, sees an extra field for "Stress Level" (which they can fill out). | "I can now track how stress affects my cycle." |
| Old Data | The new field is blank (NULL) for historical entries. Analytics do not break. | "I understand why old entries don't have this data." |

---

## 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Migrations run smoothly. | Update the schema. Generate a migration. Run the app on a simulator with existing SQLite data. The `useMigrations` hook should complete without throwing an error. Check the `__drizzle_migrations` table to verify the new migration is logged. | Proves the auto-migration pipeline is functional. |
| ✅ Existing data is preserved. | Query SQLite after the migration. Verify that all old `cycle_entries` rows still exist, and the new `stress_level` column is `NULL` for all of them. | Proves the `ALTER TABLE` operation is non-destructive. |
| ✅ No stale cache errors. | Open the app, navigate to Cycle History. Verify that the data loads instantly. No "Network Error" or "Failed to fetch" messages appear related to cache shape mismatches. | Proves that removing `persistQueryClient` eliminated the stale cache problem. |
| ✅ App doesn't crash due to mismatched data shapes. | The `queryFn` reads from SQLite. Since the schema is updated, the `CycleEntry` interface now includes `stress_level`. The UI renders without crashing because the field is properly typed. | Proves the service layer is resilient to new columns. |
| ✅ Migration is idempotent. | Run the app again (second launch). The `useMigrations` hook should detect that `0002` is already applied and skip it. No errors. | Proves Drizzle correctly tracks migration history. |

---

## 7. Why This Matters (The Business Logic)

| Without a Migration Strategy | With Drizzle Migrations |
|------------------------------|-------------------------|
| App crashes on launch because the new code expects a column that doesn't exist. | App seamlessly adds the column, preserving all old data. |
| User uninstalls the app out of frustration, losing all offline cache. | User updates the app, sees the new feature, and continues tracking. |
| Developer must manually write `ALTER TABLE` statements and risk typos. | `drizzle-kit generate` handles the SQL automatically, reducing human error. |

---

## 8. Summary

This scenario proves that your app can evolve over time without breaking existing users. By leveraging Drizzle's auto-migration system:

- Schema changes are atomic and safe (using transactions).
- Existing data is never deleted (`ALTER TABLE ADD COLUMN` is non-destructive).
- React Query's in-memory cache eliminates the need for complex buster versioning.
- The user experiences a seamless update, with no data loss and no "reset to factory" state.

This is the hallmark of a production-grade, maintainable mobile app. You can now safely add new features (like stress logging, symptom severity scales, or UI preferences) without fear of breaking offline capabilities for existing users. 🌸📱🚀

---

# Scenario 25: The "Kill Switch" (User Logs Out Globally) — Detailed Explanation

This scenario validates the security isolation and data persistence mechanisms of your offline-first architecture. It simulates the most severe session termination event: the user's authentication token is revoked by an admin (e.g., due to a security breach), or the user changes their password on another device (triggering the `user_secret_key` rotation).

The system must immediately terminate the session (clear all authentication and queued writes) while preserving the historical data in SQLite to ensure a seamless return if the user logs back in. This is a delicate balance between security and user experience.

---

## 1. The Problem: Global Logout vs. Local Data

| Trigger | Description |
|---------|-------------|
| Admin Revocation | An administrator manually revokes the user's access (e.g., due to a privacy breach or account suspension). |
| Password Change (Multi-Device) | The user changes their password on the Web Dashboard. The `user_secret_key` rotates, invalidating all existing JWTs (per the Phase 0 kill-switch). |
| Session Timeout | The refresh token expires, and the refresh endpoint returns a 401. |

**The Critical Risk (Data Contamination):**
If we clear the offline queue but also clear SQLite, the user loses their entire historical archive (cycles, journals, moods) just because they changed their password. This is a catastrophic UX failure.

**The Opposite Risk (Security Leak):**
If we keep the offline queue after a global logout, the sync engine might try to sync pending writes under the new user's account (if the user logs in as a different person on the same device), causing cross-account data contamination.

**The Golden Rule:**

1. Kill the Keys (Tokens, Pending Queue).
2. Keep the Archive (SQLite).
3. Filter by ID (Ensure the archive is only accessible to the rightful owner).

---

## 2. The Architecture: Two-Tier Data Security

| Layer | What it stores | Security Boundary | On Global Logout |
|-------|---------------|-------------------|------------------|
| EncryptedStorage (Auth) | Access Token, Refresh Token, `user_secret_key`, user object | SecureStore (Keychain/Keystore) | **CLEAR** (Immediately) |
| EncryptedStorage (Queue) | `PendingOperation[]` (unsynced writes) | SecureStore (Keychain/Keystore) | **CLEAR** (Immediately) |
| SQLite (Permanent Cache) | Historical `cycle_entries`, `journal_entries`, `mood_logs` | File System (Documents Directory) | **RETAIN** (Do not clear) |
| SQLite (Partition) | `user_id` column on every table | Row-level filtering in `localDb` queries | **USED** (All queries filter by `user_id`) |

---

## 3. Step-by-Step System Behavior

### Step 3A: The Kill Signal (Interceptor)

**Trigger:** Any API call (e.g., `GET /cycle/calendar`) returns a `401 Unauthorized` with a specific detail message.

**The Interceptor Logic (Axios):**

```typescript
// src/services/api/client.ts
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const detail = error.response.data?.detail;
      if (detail === "Session expired. Please log in again." ||
          detail === "Session compromised. All sessions revoked. Please log in again.") {
        // TRIGGER THE KILL SWITCH
        await triggerSessionExpired();
      }
    }
    return Promise.reject(error);
  }
);
```

---

### Step 3B: The Purge (Clearing EncryptedStorage)

The `triggerSessionExpired()` function performs a hard reset of the authentication and queue layers.

```typescript
// src/stores/authStore.ts (simplified)
export async function triggerSessionExpired() {
  // 1. Clear tokens
  await tokenStore.clear(); // Removes accessToken and refreshToken from SecureStore

  // 2. Clear the offline queue (CRITICAL for security)
  await offlineStore.clear(); // Removes all pending operations from SecureStore

  // 3. Clear the in-memory user state
  authStore.setState({ user: null, isHydrated: true });

  // 4. Clear React Query's in-memory cache
  queryClient.clear();

  // 5. Reset navigation to Auth Stack
  navigationRef.navigate('Auth');

  // 6. Show a toast
  Toast.show({ type: 'error', text1: 'Session expired. Please log in again.' });
}
```

**Why clearing the queue is critical:**

- If the user logs out, any pending operations (e.g., a period log created offline 5 minutes ago) belong to the old user.
- If we don't clear the queue, and a new user logs in on the same device, the sync engine might try to push those old operations to the new user's account, causing catastrophic data corruption.
- **The Rule:** The offline queue is tied to the session, not the device. When the session dies, the queue dies.

---

### Step 3C: SQLite Isolation (The Data remains intact)

The critical question: We just cleared React Query and the queue. What happens to SQLite?

**Answer:** Nothing. The `shecare.db` file is untouched.

**Why this is safe (Row-Level Security):**

- SQLite tables have a `user_id` column.
- Every `localDb` service method includes `WHERE user_id = ?` in its queries.
- Even though the data is physically present in the `.db` file, the service layer prevents the new (or logged-out) user from seeing it.

**Example:**

```sql
-- Even if SQLite has 10,000 records, this query only returns data for the logged-in user.
SELECT * FROM cycle_entries WHERE user_id = 'current_user_uuid';
```

---

### Step 3D: Re-Login (Same User — The "Instant Recovery")

**Action:** The original user (e.g., "Priya") logs back in with her email and password.

**System Behavior:**

- Auth store sets a new `accessToken` and persists it to EncryptedStorage.
- The app navigates to the Main Dashboard.
- **The Magic:** React Query `queryFn` fires. It queries SQLite: `SELECT * FROM cycle_entries WHERE user_id = 'priya_uuid'`.

**Result:** SQLite still has all of Priya's historical cycles. The data appears instantly (< 50ms).

**User Experience:** The user sees her full cycle history immediately. She does not lose her offline archives just because she changed her password.

---

### Step 3E: New User Login (Data Isolation)

**Action:** A different user (e.g., "Ananya") logs in on the same device after Priya logged out.

**System Behavior:**

- Auth store sets `user_id = 'ananya_uuid'`.
- `queryFn` runs: `SELECT * FROM cycle_entries WHERE user_id = 'ananya_uuid'`.

**Result:** Since Ananya has never used this device before, SQLite returns `[]` (empty array). The UI shows an empty state.

**Security Guarantee:** Priya's data remains in the `.db` file, but it is completely isolated by the `user_id` filter. Ananya cannot see Priya's cycles.

---

## 4. The User Experience (What the User Sees)

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| Global Logout | The app suddenly navigates to the Login screen. A toast appears: "Session expired." | "I've been logged out." |
| Re-login (Same User) | After entering credentials, the dashboard loads instantly with all historical calendar data. | "My data is still here!" |
| New User Login | After entering credentials, the dashboard shows an empty calendar or onboarding prompts. | "I don't see previous user's data. Good." |

---

## 5. Optional Enhancement: `clearSqliteOnLogout` (Privacy Mode)

**The Dilemma:** While retaining SQLite is great for UX (instant recovery), some privacy-conscious users (or corporate policies) might require absolute data wipe on logout.

**Enhancement:** Add a toggle in the Settings screen: "Clear local data on logout (recommended for shared devices)."

**Implementation:**

```typescript
if (settings.clearDataOnLogout) {
  // Hard delete all SQLite tables
  await localDb.cycle.hardDeleteAllByUser(userId);
  await localDb.journal.hardDeleteAllByUser(userId);
  await localDb.mood.hardDeleteAllByUser(userId);
}
```

**Default:** OFF (Retain data for instant recovery).

---

## 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Session ends immediately. | Mock the server to return a 401 with the "Session expired" message. The app should immediately navigate to the Auth Stack. No infinite refresh loops. | Proves the interceptor correctly identifies the kill-switch and does not attempt to refresh the token. |
| ✅ App fully resets auth state. | After the logout, check EncryptedStorage. The `shecare.accessToken`, `shecare.refreshToken`, and `shecare.offline.queue` keys should be cleared. | Proves that stale credentials and pending writes are completely removed from secure storage. |
| ✅ SQLite persists safely for the returning user. | Log out. Log back in (same user). Navigate to Cycle History. The data should appear instantly (no network spinner). Query SQLite directly; the rows are still present. | Proves that the "Session Death" does not trigger a "Data Death." The archive is independent. |
| ✅ Different users cannot see each other's data. | Log out User A. Log in User B. Navigate to Cycle History. The data should be empty (or only User B's data, if they used this device before). Query SQLite: `SELECT * FROM cycle_entries WHERE user_id = 'B'` returns only B's data. | Proves that the `user_id` partition in SQLite acts as a hard security boundary. |
| ✅ Offline queue is cleared. | Create a pending operation (go offline, log a period). Log out. Log back in. Check the `offlineStore`. The pending operation should be gone. | Proves that cross-account sync contamination is prevented. |

---

## 7. Why This Matters (The Business Logic)

| Without Proper Kill-Switch Isolation | With The Kill-Switch Isolation |
|--------------------------------------|-------------------------------|
| User changes password on web → Mobile app keeps trying to sync old queue → Server rejects with 401 → App enters infinite login loop. | App kills the session immediately, clears the queue, and navigates to the Login screen. |
| User logs out, sister logs in → Syncing engine pushes sister's period logs to user's cloud account (disaster). | User logs out → Queue is cleared. Sister logs in → Queue is empty. No data contamination. |
| User logs out and logs back in → Calendar is blank (SQLite was wiped), requiring a slow network re-download. | User logs out and logs back in → Calendar loads instantly from SQLite (snappy UX). |

---

## 8. Summary

This scenario proves that your app distinguishes "Session State" from "User Data":

- **Session State (Tokens, Queue):** Lives in EncryptedStorage. Destroyed on logout to prevent security leaks and cross-account contamination.
- **User Data (Historical Records):** Lives in SQLite. Retained on logout to ensure instant recovery for returning users.
- **Row-Level Security:** The `user_id` filter in SQLite queries ensures that even though the data physically remains in the file, it is strictly partitioned by the authenticated user.

This architecture guarantees that a password change or admin revocation does not result in data loss, while simultaneously ensuring that no stale writes infect a new user's session. This is the hallmark of a secure, offline-first, multi-device health app. 🌸🛡️🔑
