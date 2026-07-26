# Scenario 26: Fresh Install — Migration Runs Successfully — Detailed Explanation

This scenario validates the initial bootstrapping of the local SQLite database. It simulates the very first time a user downloads and opens the app on a brand-new device (or after clearing all app data). The system must automatically create the entire database schema from scratch, ensure all tables are correctly structured, and do so quickly enough that the user doesn't perceive a delay before reaching the login/onboarding screens.

---

## 1. The Problem: The "Blank Slate" State

| Challenge | Description |
|-----------|-------------|
| No Database File | The app's documents directory does not contain `shecare.db`. The file does not exist. |
| No Tables | SQLite has no schema. No `cycle_entries`, no `journal_entries`, no `__drizzle_migrations` tracking table. |
| No Migration History | Drizzle doesn't know which migrations have been applied (because none have). |
| The Risk | If the app tries to query a table that doesn't exist, it will crash with a `SQLITE_ERROR`. If the migration fails (e.g., permission denied to write to the documents directory), the user will be stuck on the splash screen forever. |

**The Critical Requirement:** The migration must be idempotent (can be run safely once), fast (< 500ms), and atomic (all tables are created in a single transaction).

---

## 2. The Architecture: `useMigrations` + Expo-SQLite

| Component | Role |
|-----------|------|
| Expo-SQLite | Provides the underlying C++ SQLite engine and the `openDatabaseSync` API to access `shecare.db`. |
| Drizzle ORM | Generates the SQL `CREATE TABLE IF NOT EXISTS` statements from your `src/db/schema.ts` definitions. |
| `drizzle-kit` (Build Time) | Generates the migration `.sql` files (e.g., `0001_initial_schema.sql`) and bundles them into the app assets. |
| `useMigrations` Hook | Runs on app launch (`_layout.tsx`). Compares the bundled migration files against the `__drizzle_migrations` tracking table and applies any pending migrations. |

---

## 3. Step-by-Step System Behavior

### Step 3A: App Launch & Splash Screen Blocking

**User Action:** Taps the app icon for the first time.

**App Startup:** The Expo Router loads `_layout.tsx`.

**Splash Screen:** The `<SplashScreen />` component is rendered.

**Migration Trigger:** Inside `_layout.tsx`, the `useMigrations` hook from Drizzle is called.

```typescript
// src/app/_layout.tsx
const { success, error } = useMigrations(db, migrations);

if (error) {
  // Log to Sentry, show toast, continue without SQLite
}
if (!success && !error) {
  // Show splash screen with "Preparing your data..." message
  return <SplashScreen message="Preparing your data..." />;
}
// Success → render the app
return <RootNavigator />;
```

---

### Step 3B: Drizzle's Internal Check

1. **Open Database:** `expo-sqlite` creates an empty `shecare.db` file in the app's `FileSystem.documentDirectory`.
2. **Check Tracking Table:** Drizzle executes the following query:

   ```sql
   SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations';
   ```

   Since this is a fresh install, the result is empty (the table does not exist).

---

### Step 3C: Applying the Migration (The "Bootstrap")

Because the tracking table is empty, Drizzle knows it must apply all migrations from the beginning.

1. **Read Migration File:** Drizzle reads the bundled SQL migration file (e.g., `0001_initial_schema.sql`) from the app's assets.
2. **Execute SQL (Atomic Transaction):** The entire migration is wrapped in a single SQLite transaction.

   ```sql
   BEGIN TRANSACTION;

   -- Create all tables
   CREATE TABLE IF NOT EXISTS cycle_entries (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     period_start_date TEXT NOT NULL,
     period_end_date TEXT,
     flow_intensity TEXT,
     symptoms TEXT,  -- JSON
     mood_tags TEXT, -- JSON
     energy_level INTEGER,
     notes TEXT,
     is_correction INTEGER DEFAULT 0,
     corrected_prediction_id TEXT,
     synced_at TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     is_active INTEGER DEFAULT 1,
     deleted_at TEXT
   );
   CREATE INDEX idx_cycle_entries_user_id ON cycle_entries(user_id);
   -- ... (all other tables: journal_entries, mood_logs, etc.)

   -- Create the tracking table
   CREATE TABLE IF NOT EXISTS __drizzle_migrations (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     hash TEXT NOT NULL,
     created_at TEXT NOT NULL
   );

   -- Log this migration as applied
   INSERT INTO __drizzle_migrations (hash, created_at) 
   VALUES ('hash_of_0001', CURRENT_TIMESTAMP);

   COMMIT;
   ```

---

### Step 3D: Completion & Health Verification

1. **Hook Returns:** `useMigrations` returns `{ success: true, error: null }`.
2. **Splash Screen Release:** The `!success && !error` condition becomes false. The app proceeds to render the `RootNavigator`.
3. **Auth/Onboarding:** The user sees the Login/Register screen (or Onboarding, if they already have a token in EncryptedStorage—but this is a fresh install, so EncryptedStorage is empty).
4. **Performance:** For an empty database, creating ~8 tables and their indexes takes < 100ms on a modern device (well within the 500ms target).

---

## 4. The User Experience

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| App Launch | Branded Splash Screen with a subtle message: "Preparing your data..." | "The app is loading." |
| During Migration (< 500ms) | The Splash Screen remains visible. | "It's fast." |
| Post-Migration | The Splash Screen dismisses. The Login/Register screen (or Onboarding) appears. | "I'm ready to sign up." |

---

## 5. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Migration takes > 2 seconds (slow device). | The Splash Screen stays visible. The app does not time out or crash. The user waits a bit longer. |
| Migration fails (disk full / read-only). | The error object is non-null. The app logs the error to Sentry, shows a toast: "Storage unavailable. Please free up space.", and proceeds to the Auth screen without SQLite (fallback to React Query in-memory cache). |
| App is force-quit during migration. | SQLite's `BEGIN TRANSACTION` ensures the migration is rolled back if the app is killed mid-way. On the next launch, `useMigrations` will restart the migration from the beginning (since `__drizzle_migrations` doesn't contain the hash). |
| App update (new migration). | On a fresh install, this doesn't apply. But for completeness: `useMigrations` will apply the new migration file (`0002`) on top of the existing `0001`. |

---

## 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Tables exist in `sqlite_master`. | After the app launches successfully, run a query via `npx expo-sqlite` or the dev tools: `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`. Verify that `cycle_entries`, `journal_entries`, `__drizzle_migrations`, etc., are listed. | Proves the migration SQL executed correctly and created all the necessary tables. |
| ✅ App proceeds to Auth/Onboarding. | After the splash screen, observe the navigation destination. If no tokens exist, it should show Login/Register. If the user has a cached session (unlikely on a fresh install), it will show Onboarding/Main. | Proves the migration did not block the app's navigation flow. |
| ✅ Migration completes in < 500ms. | Measure the time from app launch to when the `RootNavigator` renders. On a clean simulator with a fast SSD, it should be ~100-200ms. On a physical low-end device, it should be < 500ms. | Proves the schema design is efficient (no heavy data imports) and the migration strategy is fast. |
| ✅ `__drizzle_migrations` is populated. | Query the `__drizzle_migrations` table. It should contain a single row with the hash of the `0001_initial_schema` migration. | Proves Drizzle correctly tracks applied migrations, preventing them from running again on the next launch. |

---

## 7. Why This Matters (The Business Logic)

| Without a Reliable Migration System | With Drizzle Migrations |
|-------------------------------------|--------------------------|
| Developer writes raw `CREATE TABLE` SQL in the app startup code. If a typo exists, the app crashes on all fresh installs until a hotfix is released. | Drizzle generates the SQL from the TypeScript schema. The SQL is verified during `drizzle-kit generate`. Typos are caught at compile time. |
| Manual schema versioning becomes messy. The app crashes if the schema doesn't match the query expectations. | The `__drizzle_migrations` table ensures migrations are applied in strict order, guaranteeing the schema matches the app's expectation on every launch. |
| Fresh installs take 5-10 seconds because the app runs heavy setup scripts. | The migration is optimized (only `CREATE TABLE` statements, no data insertion). It finishes in < 500ms. |

---

## 8. Summary

This scenario proves that your app can bootstrap itself from zero on a brand-new device with zero user intervention. By leveraging Drizzle's auto-migration system:

- The database file is automatically created in the app's documents directory.
- All tables and indexes are created atomically (in a single SQLite transaction).
- The migration tracking table (`__drizzle_migrations`) ensures the migration is only applied once.
- The Splash Screen blocks UI rendering until the migration is complete, preventing the user from seeing a blank screen or a crash.

This is the foundation of your offline-first architecture—without a reliable bootstrap, nothing else works. Once this passes, the app is ready to read/write data entirely offline, setting the stage for all subsequent features (cycle logging, journaling, sync, etc.). 🌸📱🚀

---

# Scenario 27: Fresh Install — Offline (No API) — Detailed Explanation

This scenario validates the "Zero Network Dependency" principle of your offline-first architecture. It simulates the ultimate test: a brand-new user downloads the app in a location with absolutely no internet (e.g., a remote village, airplane mode, or a dead zone). The app must successfully bootstrap itself from scratch, create the local database, and present the user with a functional Auth screen—without hanging, crashing, or throwing cryptic network errors.

---

## 1. The Problem: The "Desert" Scenario

| Challenge | Description |
|-----------|-------------|
| No Data on Device | The app has never been opened before. There is no `shecare.db` file, no tokens, no cached user profile. |
| No Network | The device is in Airplane mode. Any API call (e.g., `GET /auth/me`, `GET /onboarding/status`, `GET /cycle/predictions`) will immediately fail with a network error. |
| The Risk | If the app attempts to fetch data from the server and waits for a response before rendering the UI, the user will see an infinite loading spinner or a timeout error. This is the #1 UX killer for offline-first apps. |

**The Critical Requirement:** The app must render the Auth screen instantly, regardless of the network state, and gracefully handle any failed background requests without blocking the user interface.

---

## 2. The Architecture: "Offline-First Bootstrapping"

| Layer | State on Fresh Install (Offline) | Behavior |
|-------|----------------------------------|----------|
| EncryptedStorage (SecureStore) | Empty. No `accessToken`, no `refreshToken`, no user object. | `storage.getItem()` returns `null` instantly (no network call). |
| SQLite (Expo-SQLite) | Empty but Created. The `useMigrations()` hook creates the `shecare.db` file and all tables (Scenario 26) before the UI renders. | The database is ready, but contains 0 rows. |
| React Query (In-Memory) | Empty. The in-memory cache has no data. | `queryFn` for any data query is not called because `useQuery` is `enabled: !!userId`. The user is `null`. |

---

## 3. Step-by-Step System Behavior

### Step 3A: App Launch & Migration (No Network Needed)

**User Action:** Taps the app icon with Airplane mode ON.

1. **Splash Screen:** The app renders the Splash Screen.
2. **Migration (Bootstrap):** `useMigrations()` runs inside `_layout.tsx`.
   - It opens `shecare.db` (creates the empty file).
   - It creates all tables (`cycle_entries`, `journal_entries`, etc.) from the bundled SQL schema.
   - This requires zero network (all SQL is embedded in the app binary).
3. **Completion:** < 500ms.
4. **Splash Releases:** The `RootNavigator` is rendered.

---

### Step 3B: Auth Store Hydration (The Token Check)

1. `authStore.hydrate()` is called.
2. It calls `tokenStore.getAccess()`.
3. `getAccess()` reads `EncryptedStorage.getItem('shecare.accessToken')`.
4. **Result:** Since this is a fresh install, SecureStore is empty. The `getItem` call returns `null` instantly (no network).
5. `authStore` sets `user: null` and `isHydrated: true`.

---

### Step 3C: Navigation Decision (The Critical Instant Render)

The `RootNavigator` makes its decision based on the auth store:

```typescript
if (!isHydrated) return <SplashScreen />;
if (!user) return <AuthStack />; // <-- This happens immediately
if (!user.onboarding_completed) return <OnboardingStack />;
return <MainTabs />;
```

**Result:** Because `user` is `null`, the app navigates to the Auth Stack (Login/Register/Phone/Otp) immediately.

**Crucial Nuance:** The `AuthStack` does not trigger any network-heavy `queryFn` that could cause a spinner. The Login screen is purely local UI.

---

### Step 3D: If the User Tries to Log In (The Graceful API Failure)

**User Action:** User enters credentials and taps "Sign In".

1. **Mutation Fires:** The `useLogin` hook calls `apiClient.post('/auth/login')`.
2. **Network Error:** Since the device is offline, the fetch fails instantly (Network Request Failed).
3. **Error Handler:**
   - `isNetworkError(error)` returns `true`.
   - The mutation does NOT show an infinite spinner. It immediately shows a toast:
     > "No internet connection. Please check your network and try again."
   - The Login screen remains fully interactive.

---

## 4. The User Experience (What the User Sees)

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| App Launch | Splash Screen appears for < 500ms. | "The app is starting." |
| Post-Splash | Login Screen appears instantly. | "I'm ready to sign up or log in." |
| Trying to Log In (Offline) | A toast appears immediately: "No internet connection." The loading spinner disappears. | "I need to turn on my internet." |
| Attempting to Register | Same behavior as login. The form remains responsive. | "I'll try again when I have a signal." |

**The Key Takeaway:** The user never sees a permanent spinner. They are never locked out of the app. They can fill out forms, view static content, and read the privacy policy—all without internet.

---

## 5. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| User opens the app offline, but Onboarding was completed on a previous install (but data is empty). | Since `user` is `null`, the app routes to Auth, not Onboarding. So this doesn't apply. |
| Background queries for the Dashboard fire accidentally before navigation. | `useQuery` hooks are guarded by `enabled: !!userId`. Since `userId` is `null`, they are disabled. They never fire. |
| EncryptedStorage `getItem` throws an error. | The try-catch in `storage.ts` returns `null`. The app does not crash. |
| The user turns off Airplane mode and logs in. | The API call succeeds. Tokens are saved. The app routes to Main/Onboarding, and `queryFn` fetches fresh data from the server. |

---

## 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ No crash. | Open the app in Airplane mode. Navigate around the Auth stack. The app should never crash. | Proves that all async operations are wrapped in try-catch and that `useMigrations` handles the file creation gracefully. |
| ✅ No infinite spinners. | The Login screen should render immediately. If there is a loading state, it should disappear within < 200ms. | Proves that the `authStore.hydrate()` and navigation decision are synchronous (non-blocking) and do not wait for network timeout. |
| ✅ User can see the Login screen. | The screen should render the email/password fields, the logo, and the "Sign In" and "Create Account" buttons. | Proves that the UI is completely decoupled from the network state. |
| ✅ Migration runs successfully (tables created). | Use a SQLite inspector to connect to `shecare.db` and verify the `cycle_entries` and `__drizzle_migrations` tables exist. | Proves that the offline bootstrap (Scenario 26) works perfectly even without an internet connection. |

---

## 7. Why This Matters (The Business Logic)

| Without Offline-First Bootstrapping | With Offline-First Bootstrapping |
|-------------------------------------|----------------------------------|
| App shows a blank screen or infinite spinner at launch waiting for `GET /auth/me` to timeout (30 seconds). | App shows the Login screen instantly. |
| User uninstalls the app out of frustration because it "doesn't work offline." | User understands the app works offline but requires internet for login. |
| Error states cascade: the login mutation fails, the app crashes, or the UI hangs. | Error states are localized: the login mutation shows a toast, and the rest of the UI remains responsive. |

---

## 8. Summary

This scenario proves that your app is usable from the very first tap, even without a network connection. By:

- Bundling SQLite migrations inside the app binary (no download required).
- Checking EncryptedStorage synchronously for auth tokens (no network round-trip).
- Guarding data queries with `enabled: !!userId` (prevents background fetch storms).
- Handling network errors at the mutation level with localized toasts (not global crashes).

The app guarantees that a user in a remote area can open the app, read the privacy policy, and fill out the registration form—all while waiting for the perfect moment to tap "Sign In" when they walk into a Wi-Fi zone. This is the definitive hallmark of a truly offline-first mobile experience. 🌸📱✈️

---

# Scenario 28: Migration Failure (Corrupt DB) — Detailed Explanation

This scenario validates the "Nuclear Fallback" of your offline-first architecture. It simulates the ultimate data disaster: the `shecare.db` file is corrupted (e.g., due to a sudden power loss during a write operation, or a bug in the SQLite engine during a migration). Unlike a Disk Full error (Scenario 23), a corrupt database cannot be repaired by simply freeing up space. The system must detect the corruption, isolate it, and ensure the app remains fully functional using only the in-memory React Query cache.

---

## 1. The Problem: The "Broken Foundation"

| Challenge | Description |
|-----------|-------------|
| Database Corruption (`SQLITE_CORRUPT`) | The internal B-tree or header of the `shecare.db` file is damaged. SQLite cannot parse the file structure. |
| Migration Block | `useMigrations()` attempts to read the `__drizzle_migrations` table to check the migration history. If the file is corrupt, this read fails immediately. |
| The Risk (Critical) | If the app crashes on `useMigrations()` error, the user is permanently locked out of the app. They cannot even reach the login screen. This is a 100% fatal crash scenario. |

**The Golden Rule:** A corrupted local database must never crash the app. The app must treat the database as "unavailable" and seamlessly fall back to a purely in-memory state (React Query), while giving the user a clear warning and logging the issue to Sentry for debugging.

---

## 2. The Architecture: The "Circuit Breaker" Pattern

| Component | Role in the Fallback |
|-----------|----------------------|
| `useMigrations` (Drizzle) | Attempts to read the database. If it fails, it returns an error object instead of crashing. |
| `_layout.tsx` | Catches the error from `useMigrations` and sets a global flag `isSqliteAvailable = false`. |
| `BaseLocalService` | Before executing any query, checks `isSqliteAvailable`. If `false`, it returns `[]` (empty) immediately without even trying to execute SQL. |
| React Query | Falls back to the in-memory cache (if data was fetched earlier in the session) or shows empty states. |

---

## 3. Step-by-Step System Behavior

### Step 3A: App Launch & Splash Screen

**User Action:** Taps the app icon. The app has a corrupted `shecare.db` file from a previous crash.

1. **Splash Screen:** The app renders the Splash Screen.
2. **Migration Trigger:** `useMigrations(db, migrations)` is called inside `_layout.tsx`.

---

### Step 3B: The Migration Failure

1. **Database Open Attempt:** `expo-sqlite` tries to open `shecare.db`.
2. **SQLite Error:** The SQLite engine detects the corruption and throws an error (e.g., `SQLITE_CORRUPT: database disk image is malformed`).
3. **Drizzle Catch:** The `useMigrations` hook catches this error. It does not throw the error to the UI. Instead, it returns `{ success: false, error: Error }`.

---

### Step 3C: The Graceful Degradation Logic (`_layout.tsx`)

```typescript
// src/app/_layout.tsx
const { success, error } = useMigrations(db, migrations);

if (error) {
  // 1. Log to Sentry immediately with full context
  Sentry.captureException(error, {
    tags: { context: 'sqlite_migration_failure' },
    extra: { error_message: error.message },
  });

  // 2. Show a non-blocking toast
  Toast.show({
    type: 'warning',
    text1: 'Local storage unavailable. Your data is safe.',
    text2: 'Please restart the app if issues persist.',
  });

  // 3. Set the global circuit breaker flag
  isSqliteAvailable = false;

  // 4. Continue app execution (do NOT block)
}

// 5. Render the app regardless of success
return <RootNavigator />;
```

---

### Step 3D: The Circuit Breaker Activation (`BaseLocalService`)

Now that `isSqliteAvailable = false`, every `localDb` service method becomes a no-op.

```typescript
// src/services/localDb/BaseLocalService.ts
async function getHistory(userId: string): Promise<CycleEntry[]> {
  // 1. Check the global circuit breaker
  if (!isSqliteAvailable) {
    // 2. Return empty array immediately without executing SQL
    return [];
  }

  // 3. Normal SQLite query attempt...
  try {
    return await db.select().from(cycleEntries).where(eq(user_id, userId));
  } catch (e) {
    // If this fails, we return empty anyway.
    return [];
  }
}
```

---

### Step 3E: User Experience & State

1. **Auth Navigation:** The `RootNavigator` renders. If the user was logged in (tokens exist in EncryptedStorage), it navigates to the Main Dashboard.
2. **Dashboard State:** The `queryFn` for `useCycleHistory` fires.
   - It calls `localDb.cycle.getHistory()`.
   - The circuit breaker is `true`, so it returns `[]`.
3. **React Query:** `useQuery` returns `data: []`. The UI shows the empty state (e.g., "No cycles logged yet").
4. **App Functionality:** The user can still:
   - Log a new period (this goes to EncryptedStorage queue → server).
   - View Journal (empty, but doesn't crash).
   - Use the app's UI features (Settings, Profile).

---

## 4. The User Experience (What the User Sees)

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| App Launch | Splash Screen appears for a slightly longer duration (maybe 1-2 seconds). | "The app is loading slowly." |
| Post-Launch | A subtle toast appears at the bottom: "Local storage unavailable. Your data is safe." | "Something is wrong, but the app is still working." |
| Dashboard | The calendar is empty. "No cycles logged yet." | "My data is missing!" (Potential confusion). |
| Logging a Period | The period appears on the calendar (optimistic UI). A sync badge appears. | "The app saved my period." |
| App Restart | The toast appears again. The calendar remains empty. | "I should contact support about this." |

**The Critical UX Feedback Loop:** Because the app did not crash, the user is not locked out. They can still log new data, which will be sent to the server when they are online. The old corrupted data is temporarily lost, but a future app update (or a fix in the migration logic) might allow the database to be repaired or recreated.

---

## 5. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| The user re-installs the app. | The file is recreated fresh. The migration runs successfully (Scenario 26). Data is re-downloaded from the server. |
| SQLite works but the schema is outdated. | `useMigrations` applies pending migrations. If a migration fails, it falls back to the same degradation path. |
| The user has no internet and the database is corrupt. | The app shows empty states. The user cannot see historical data, but they can still log new periods (which go to the queue). When the disk is fixed/repaired, a future sync might restore data. |
| The user force-quits the app during migration. | The `BEGIN TRANSACTION` rolls back. The database remains in the pre-migration state, but the corruption check happens on the next launch. |

---

## 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ App does NOT crash. | Manually corrupt `shecare.db` (e.g., open it in a hex editor and replace the first 10 bytes with zeros) or simulate a `SQLITE_CORRUPT` error using a mock. Open the app. The app should render the Login/Dashboard screen, not a blank white screen. | Proves the try-catch in `useMigrations` and the `isSqliteAvailable` circuit breaker are correctly implemented. |
| ✅ Sentry receives the error report. | After the app launches, check your Sentry dashboard. An event should appear with the `sqlite_migration_failure` tag and the `SQLITE_CORRUPT` error message. | Proves that critical infrastructure errors are being captured for debugging. |
| ✅ Toast appears. | The app should show the warning toast: "Local storage unavailable." | Proves the user is informed of the degraded state (preventing confusion about "missing data"). |
| ✅ Empty state is shown. | Navigate to Cycle History or Journal List. The UI should show the empty state ("No cycles logged yet"), not an error state or a crash. | Proves the service layer respects the circuit breaker and returns `[]` without throwing errors. |
| ✅ Write path still works. | Log a period. The calendar should update optimistically. The `offlineStore.enqueue()` should still work (since it uses EncryptedStorage, not SQLite). | Proves that even with a dead SQLite, the core write pipeline (EncryptedStorage → Server) remains functional. |

---

## 7. Why This Matters (The Business Logic)

| Without the Circuit Breaker | With the Circuit Breaker |
|-----------------------------|--------------------------|
| App crashes on launch. User uninstalls the app out of frustration, losing any unsynced data in the queue. | App continues running. The user can still log new periods. The sync engine ensures new data is safe. |
| Support team receives a flood of "App won't open" tickets. They have no error logs to debug. | Sentry captures the `SQLITE_CORRUPT` error. The team knows exactly which version of the app and OS caused the issue. |
| A bug in a migration causes a full-scale rollback of the app version. | The bug is isolated to the corrupted local database. The app stays online, and the team fixes the migration path in the next release. |

---

## 8. Summary

This scenario proves that your app is resilient even when its core local database is destroyed. By:

- Treating SQLite as a "nice-to-have" for historical reads, rather than a "must-have."
- Implementing a circuit breaker (`isSqliteAvailable`) that bypasses all SQLite queries when the database is corrupt.
- Failing gracefully with a toast notification and Sentry logging.
- Keeping the write path active (EncryptedStorage → Server) so the user can still log new data.

The app ensures that a single corrupted file does not bring down the entire application. This is the hallmark of a robust, enterprise-grade mobile architecture. 🌸🛡️💾

---

# Scenario 29: SQLite Schema Upgrade (App Update) — Detailed Explanation

This scenario validates the "Evolution" capability of your offline-first architecture. It simulates the most common production event: the development team adds a new feature that requires storing a new piece of data (e.g., tracking a user's `stress_level` during a specific cycle). The app must safely update the local SQLite database schema without losing existing user data, and without causing crashes for users who are updating from the previous version.

---

## 1. The Problem: Schema Drift

| Challenge | Description |
|-----------|-------------|
| Adding New Columns | A new feature requires a new column in the `cycle_entries` table (e.g., `stress_level`). |
| Existing User Data | The user has 3 years of historical cycles stored in SQLite. These rows do not have the new column. |
| App Update Rollout | The user updates the app from the App Store. The new binary expects the `stress_level` column to exist. |
| Data Loss Risk | If the migration fails, the app may crash. If the migration drops the old table to recreate it, existing data is permanently lost. |

**The Critical Requirement:** The migration must be non-destructive (preserves all existing data), fast (< 500ms), and idempotent (running it twice does not cause errors).

**The Golden Rule of SQLite Migrations:** You can always `ALTER TABLE ADD COLUMN` safely. The new column will be `NULL` for all existing rows. You must never `DROP` or `RENAME` a column in a migration unless you explicitly handle data transformation (which is a more advanced operation, avoidable for V1).

---

## 2. The Architecture: Drizzle's Safe Migration Engine

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
// BEFORE (v1)
export const cycleEntries = sqliteTable('cycle_entries', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  period_start_date: text('period_start_date').notNull(),
  period_end_date: text('period_end_date'),
  // ... other columns
});

// AFTER (v2 — Adding stress_level)
export const cycleEntries = sqliteTable('cycle_entries', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  period_start_date: text('period_start_date').notNull(),
  period_end_date: text('period_end_date'),
  stress_level: text('stress_level'), // NEW COLUMN
  // ... other columns
});
```

**Migration Generation:** The developer runs:

```bash
npx drizzle-kit generate --name=add_stress_level_to_cycles
```

Drizzle compares the current `schema.ts` with the `__drizzle_migrations` table state in the dev database.

It generates a migration file: `src/db/migrations/0002_add_stress_level_to_cycles.sql`.

The SQL Generated:

```sql
-- Safe, non-destructive ALTER TABLE
ALTER TABLE cycle_entries ADD COLUMN stress_level TEXT;
```

---

### Step 3B: App Update & Launch (User Side)

**User Updates:** The user downloads the new app version (v2) from the App Store/Play Store.

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

---

### Step 3D: Existing Data Preservation (The "Silver Bullet")

Because `ALTER TABLE ADD COLUMN` is used (not `DROP` or `RENAME`), existing rows remain intact:

- The 3 years of historical `cycle_entries` are all preserved.
- For these old rows, the `stress_level` column is automatically set to `NULL`.
- No data is copied, no data is transformed, and no data is lost.

---

### Step 3E: The Service Layer Handling (NULL values)

The app's service layer must handle `NULL` values gracefully.

1. **Write Path:** When the user logs a new period in v2, they see a new "Stress Level" field. The app submits `stress_level: 'high'` to the server. SQLite stores this string.
2. **Read Path:** The `queryFn` reads the data from SQLite. For historical rows (v1), `stress_level` is `NULL`.
3. **UI Handling:** The app shows the historical cycle in the list. It simply displays "Stress: N/A" or hides the stress field for older entries. This does not cause a crash, because the UI conditionally renders the field only if `entry.stress_level !== null`.

---

## 4. The User Experience

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| Splash Screen | Stays visible for ~500ms longer than usual. | "The app is preparing my data." |
| Post-Launch | Dashboard loads instantly. Historical data appears in the calendar. The new stress field is visible in the "Log Period" screen. | "Nothing changed. My data is still here." |
| Viewing Historical Period | The "Stress Level" badge is not shown for old entries. | "I understand why old entries don't have this data." |
| Logging a New Period | The user fills out the "Stress Level" field. The calendar updates. | "I can now track how stress affects my cycle." |

---

## 5. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| User skips an update (jumps from v1 to v3). | Drizzle applies migrations in order: `0001` → `0002` → `0003`. All executed sequentially. |
| Adding a NOT NULL column (instead of nullable). | Drizzle Warning: You MUST provide a `$default` value (e.g., `'medium'`) in the schema. Drizzle will generate a migration that sets the default for existing rows. If you don't provide a default, the migration will fail for existing users. |
| Migration fails (corrupt database). | The transaction rolls back. The app logs to Sentry and shows a toast. (See Scenario 28). |
| Downgrade (user rolls back to old version). | The old code does NOT query the new `stress_level` column. Since `SELECT *` in SQLite returns the column, the old app safely ignores it. No errors. |
| Adding multiple columns in one migration. | Drizzle will generate multiple `ALTER TABLE` statements in the same migration file, all wrapped in a single transaction. |

---

## 6. Why is the Service Layer resilient to this?

The `queryFn` reads all columns via `SELECT *`. Since the new column is added to the table, the result set includes it. The `CycleEntry` TypeScript interface is updated in v2 to include `stress_level`, so the code compiles. Historical entries have `stress_level: null`, which is a valid state for a nullable field. The UI handles `null` with a simple `if (entry.stress_level) ...` check.

---

## 7. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Schema upgrade works. | 1. Install v1 of the app (with the old schema).<br>2. Log a few cycles.<br>3. Update to v2.<br>4. Open the app.<br>5. Query SQLite to verify the `stress_level` column exists. | Proves the `ALTER TABLE` statement was executed successfully. |
| ✅ Old data is preserved. | Query the `cycle_entries` table. Verify that all historical rows are still present and their data (e.g., `period_start_date`) is unchanged. Check that `stress_level` is `NULL` for these rows. | Proves the migration is non-destructive. |
| ✅ New entries have the new field populated. | Log a new period in v2 and fill out the `stress_level` field. Query SQLite. Verify the new row has `stress_level = 'high'`. | Proves the write path works with the new column. |
| ✅ App doesn't crash with null values. | Navigate to the cycle history screen. The list should render without crashing when encountering a row where `stress_level` is `NULL`. | Proves the UI and service layer handle optional fields gracefully. |
| ✅ `__drizzle_migrations` is updated. | Query the `__drizzle_migrations` table. It should now contain a hash for `0002_add_stress_level_to_cycles`. | Proves the migration is marked as "applied," preventing it from running on the next app launch. |

---

## 8. Why This Matters (The Business Logic)

| Without a Proper Migration System | With Drizzle Migrations |
|-----------------------------------|--------------------------|
| Developer manually writes `ALTER TABLE` SQL and tries to remember which version it applies to. Typos cause app crashes. | `drizzle-kit` generates the SQL automatically from the TypeScript schema. No manual typing errors. |
| App forces a full database reset on every update, losing all user data. | `ALTER TABLE ADD COLUMN` preserves all existing data. |
| Users see blank screens after updating because the new code expects a column that doesn't exist. | Users see their historical data immediately, with the new feature gracefully integrated. |

---

## 9. Summary

This scenario proves that your app can safely evolve over time without breaking existing users. By leveraging Drizzle's auto-migration system:

- Schema changes are atomic and safe (using transactions).
- Existing data is never deleted (`ALTER TABLE ADD COLUMN` is non-destructive).
- Service layers handle `NULL` gracefully, allowing new features to coexist with historical data.
- The user experiences a seamless update, with no data loss and no "reset to factory" state.

This is the hallmark of a production-grade, maintainable mobile app. You can now safely add new features (like stress logging, symptom severity scales, or UI preferences) without fear of breaking offline capabilities for existing users. 🌸📱🚀
