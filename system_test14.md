# Scenario 41: Type-Safe Parsing Error — Malformed JSON in SQLite — Detailed Explanation

This scenario validates the "Defensive Parsing" layer of your offline-first architecture. It simulates a rare but catastrophic data corruption event: a single cell in your SQLite database contains malformed JSON (e.g., `'{{'` instead of `'["cramps"]'`). This could happen due to a bug in a migration, a manual SQL edit gone wrong, or an interrupted write.

The system must ensure that one corrupt row does not sink the entire ship—the UI must render all healthy rows and gracefully skip or mask the corrupted data, while logging the exact error to Sentry so the team can repair it.

---

## 1. The Problem: The "Zombie JSON" Trap

| Challenge | Description |
|-----------|-------------|
| The Buggy Migration | A Drizzle migration adds a `symptoms` JSON column. Due to a manual SQL injection or a bug in the data transformation script, a row is inserted with `symptoms = '{{'` (malformed). |
| The `JSON.parse` Risk | Drizzle ORM, when configured with `text(..., { mode: 'json' })`, automatically parses the JSON string into a JavaScript object. If the string is malformed, `JSON.parse` throws a `SyntaxError`. |
| The UI Cascade | If the `queryFn` doesn't catch this error, the entire React Query query fails. The screen shows an error state (or crashes), rendering the user's entire historical cycle list inaccessible. |

**The Golden Rule:** A single corrupt database cell must never crash the app or block the rendering of healthy rows. The system must treat malformed JSON as a "missing" or "invalid" field, default to a safe value (e.g., `[]`), and aggressively log the issue for remediation.

---

## 2. The Architecture: The "Safe Mapper" Pattern

Since SQLite does not enforce JSON schema validation natively, the mobile app must handle invalid JSON at the service layer. We cannot rely on Drizzle's auto-parser alone.

| Component | Role in this Scenario |
|-----------|----------------------|
| Raw SQL Query | The `BaseLocalService` executes `SELECT * FROM cycle_entries`. This returns the raw string `symptoms = '{{'`. |
| The Safe Mapper | The service iterates over the result rows and parses the `symptoms` field individually inside a try-catch. |
| Sentry Logger | On parsing failure, the error is captured with the `entry_id` and `malformed_string` as extra context. |
| Fallback Value | If parsing fails, the service sets `symptoms = []` (empty array) for that row. |

**Implementation (Mental Model):**

```typescript
// src/services/localDb/BaseLocalService.ts

// Drizzle's auto-parser is skipped by selecting raw fields, or we catch errors post-parse.
async function getHistory(userId: string): Promise<CycleEntry[]> {
  try {
    const rawRows = await db.execute(
      sql`SELECT id, user_id, period_start_date, symptoms FROM cycle_entries WHERE user_id = ${userId}`
    );

    return rawRows.map((row) => {
      // SAFE PARSING: Try to parse symptoms individually.
      let parsedSymptoms: string[] = [];
      if (row.symptoms) {
        try {
          parsedSymptoms = JSON.parse(row.symptoms);
          // Ensure it's an array, otherwise treat as invalid.
          if (!Array.isArray(parsedSymptoms)) {
            throw new Error('JSON parsed to non-array');
          }
        } catch (parseError) {
          // Log to Sentry with specific context.
          Sentry.captureException(parseError, {
            tags: { context: 'sqlite.json_parse_failure' },
            extra: { entry_id: row.id, malformed_value: row.symptoms },
          });
          // Fallback to empty array.
          parsedSymptoms = [];
        }
      }
      return { ...row, symptoms: parsedSymptoms };
    });
  } catch (dbError) {
    // Fallback for database-level errors (return empty array to prevent UI crash).
    Sentry.captureException(dbError);
    return [];
  }
}
```

---

## 3. Step-by-Step System Behavior

### Step 3A: The Data Corruption (The "Zombie" Row)

- **Backend Bug:** A manual migration or an admin script accidentally inserts a row with `symptoms = '{{'`.
- **SQLite State:** The `cycle_entries` table now has 99 healthy rows (with valid JSON) and 1 corrupt row.

---

### Step 3B: The User Opens Cycle History

1. **UI Mounts:** `useCycleHistory` fires.
2. **Query Execution:** `localDb.cycle.getHistory(userId)` is called.
3. **Raw Fetch:** The service fetches all 100 rows (including the corrupt one) as raw SQLite TEXT values.

---

### Step 3C: The Safe Mapping (The Critical Step)

1. **Loop Iteration:** The service iterates over each row.
2. **Row 1–99 (Healthy):** `JSON.parse` succeeds. `symptoms` is stored as an array.
3. **Row 100 (Corrupt):**
   - `JSON.parse('{{')` throws a `SyntaxError`.
   - **Catch Block:** The service catches the error.
   - **Sentry Log:** `Sentry.captureException` is called with `entry_id` and `malformed_value`.
   - **Fallback:** The service sets `symptoms = []` for this row.
4. **Return Array:** The service returns the fully mapped array of 100 entries (99 with real symptoms, 1 with `[]`).

---

### Step 3D: UI Rendering

- The `FlatList` renders all 100 entries.
- The corrupted entry shows no symptom badges (or an empty symptom chip list).
- The app does not crash. The screen does not show a blank error state.

---

### Step 3E: The Remediation (Post-Crash)

1. **Sentry Alert:** The team receives a Sentry alert with the exact `entry_id` and malformed string.
2. **Manual Fix:** A developer runs a SQL query on the server: `UPDATE cycle_entries SET symptoms = '[]' WHERE id = 'x'`.
3. **Sync Fix:** On the next `syncEngine` pull, the fixed row is re-downloaded to SQLite, replacing the malformed value.

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Multiple corrupt rows (10+). | The loop continues. Each corrupt row is caught individually. The UI renders all rows. Sentry receives a single error per row (or aggregated). |
| The `symptoms` column is `NULL`. | The try-catch returns `[]` (if we check `if (!row.symptoms) return []`). No Sentry error is logged (`NULL` is valid). |
| The `symptoms` column is an empty string (`''`). | `JSON.parse('')` throws an error. The fallback sets `[]` and logs to Sentry. This alerts the team to a data quality issue. |
| The database query itself fails (corrupt file). | The outer try-catch for the `db.execute` call catches the error and returns `[]` (Scenario 28). |
| Drizzle auto-parser fails (if used). | To prevent this, the service layer uses raw SQL or catches the Drizzle mapping error. The plan explicitly avoids relying on Drizzle's `mode: 'json'` alone; it uses a manual mapping loop. |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ App doesn't crash on malformed data. | Manually insert a corrupt `symptoms` value into the SQLite database (e.g., via a migration or SQLite CLI). Open the app. Navigate to Cycle History. The list should render without a crash. | Proves the try-catch around `JSON.parse` is correctly isolating parsing errors. |
| ✅ Error is captured in Sentry. | Check Sentry dashboard after triggering the scenario. An event should appear with the `sqlite.json_parse_failure` tag, including the `entry_id` and the malformed string `'{{'`. | Proves the system is observability-aware. The team can proactively fix data corruption issues before they multiply. |
| ✅ The specific row displays `[]` for symptoms. | Identify the corrupt entry in the UI. The symptom badges should be missing (or an empty array). | Proves the fallback value is correctly applied to the damaged row. |
| ✅ Other rows display normally. | Scroll to other entries. Symptoms like "cramps" and "bloating" should appear correctly. | Proves that the parsing failure is isolated to the corrupt row and does not cascade to healthy rows. |

---

## 6. Why This Matters (The Business Logic)

| Without Defensive Parsing | With Defensive Parsing |
|---------------------------|------------------------|
| One corrupt row → `JSON.parse` throws → React Query query fails → Screen shows "Something went wrong" or crashes. | One corrupt row → Symptoms empty for that row → Other rows render normally. User doesn't notice a major disruption. |
| User complains: "My cycle history is blank!" | User complains: "My symptoms are missing for one month." (Minor issue). |
| Support team has no idea which row is corrupt. | Sentry has the exact `entry_id` and malformed string. The team fixes it in 5 minutes. |

---

## 7. Summary

This scenario proves that your app is resilient against unexpected data corruption, treating malformed JSON as a graceful degradation opportunity rather than a critical failure. By:

- Parsing JSON per-row inside a try-catch.
- Falling back to `[]` for corrupt fields.
- Capturing detailed Sentry logs for every parsing failure.

The app ensures that a single bit of bad data cannot take down the entire cycle history screen. This is the definitive safeguard against "data rot" in long-lived offline-first databases, ensuring the app remains stable even when the underlying data store contains errors. 🌸🛡️💾

---

# Scenario 42: Timezone Shift — User Travels from Nepal (+5:45) to US (-4:00) — Detailed Explanation

This scenario validates the "Timezone Immunity" of your offline-first architecture. It simulates the most common real-world travel edge case: a user logs a period in Kathmandu (UTC+5:45) at midnight, and then flies to New York (UTC-4:00). When she opens the app in the US, the period start date must remain exactly July 15, 2025—it must not shift to July 14 or July 16 due to the phone's local timezone change.

This is a notorious pitfall in React Native (and JavaScript in general) where parsing a date string like `"2025-07-15"` can result in a local time representation that differs by ±1 day depending on the timezone offset.

---

## 1. The Problem: The "Midnight UTC" Trap

| Challenge | Description |
|-----------|-------------|
| The User Action | The user logs a period starting July 15, 2025 in Nepal (UTC+5:45). Her phone stores the date in SQLite as `"2025-07-15"` (pure ISO string, no time component). |
| The Travel | She flies to New York (UTC-4:00). The phone's system timezone updates automatically. |
| The Native Date Trap (React Native) | In JavaScript, `new Date('2025-07-15')` is interpreted as midnight UTC (because the string lacks a timezone offset, JS treats it as UTC).<br>- In Nepal (UTC+5:45), `new Date('2025-07-15')` displays as July 15, 2025 at 05:45 AM (local time).<br>- In New York (UTC-4:00), the same `new Date('2025-07-15')` displays as July 14, 2025 at 08:00 PM (local time). |
| The Risk | If the app uses `date.toLocaleDateString()` without UTC handling, the period start date would shift back by one day (July 14) when viewed in the US. This is a catastrophic data inconsistency for a health app. |

**The Golden Rule:** Dates that represent a specific calendar day (e.g., "July 15") must always be treated as UTC or, even better, parsed and displayed purely as strings. We must never rely on the device's local timezone to interpret a calendar date.

---

## 2. The Architecture: The "UTC-Only" Date Pipeline

| Component | Role in this Scenario |
|-----------|----------------------|
| Storage (SQLite) | Stores dates as TEXT ISO strings: `'YYYY-MM-DD'`. No timezone attached. |
| `toDateStr(date: Date)` | Converts a JS Date to an ISO string using UTC methods: `date.getUTCFullYear()` etc. |
| `formatDisplayDate(date: Date, calendar: 'AD' \| 'BS')` | Formats the date for UI. It must use UTC methods to extract year/month/day to prevent shifting. |
| `adToBsDate(adDate: Date)` | The Bikram Sambat converter expects an AD Date object. It uses `.getUTCFullYear()` and `.getUTCMonth()` internally to read the correct calendar day regardless of the local timezone. |

---

## 3. Step-by-Step System Behavior

### Step 3A: User Logs a Period in Nepal

**Action:** User logs period starting July 15, 2025.

1. **Form Submission:** The DatePicker returns a JS Date object.
2. **Validation:** The app uses `toDateStr(date)`, which extracts the date components using UTC methods.

```typescript
// src/utils/formatDate.ts
export function toDateStr(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`; // '2025-07-15'
}
```

3. **Storage:** SQLite stores `period_start_date = '2025-07-15'`.

---

### Step 3B: User Travels to the US (Timezone Changes)

- **Device Timezone:** The phone automatically switches to UTC-4:00.
- **No Data Mutation:** SQLite still contains `'2025-07-15'`. The timezone change does not affect the raw string.

---

### Step 3C: User Opens the App in the US

1. **Query Execution:** `localDb.cycle.getHistory()` returns the raw string `'2025-07-15'`.
2. **React Query:** The `queryFn` constructs a JS Date object using the ISO string.

```typescript
// SAFE: Create a date object, but immediately use UTC methods.
const date = new Date('2025-07-15'); // Internally represents midnight UTC.
```

3. **UI Rendering:** The `formatDisplayDate` function is called.

```typescript
export function formatDisplayDate(date: Date, calendar: 'AD'): string {
  // CRITICAL: Use UTC getters to extract the components.
  const year = date.getUTCFullYear();   // Always 2025
  const month = date.getUTCMonth();      // 6 (July)
  const day = date.getUTCDate();         // Always 15
  return `${monthNames[month]} ${day}, ${year}`; // "July 15, 2025"
}
```

4. **Result:** The UI renders "July 15, 2025". The date did not shift to July 14.

---

## 4. The Critical Difference (Why this works in React Native)

| Implementation | Behavior | Result |
|----------------|----------|--------|
| ❌ WRONG (Local Timezone) | `date.toLocaleDateString('en-US')` | Nepal: "July 15"<br>US: "July 14" (Dangerous). |
| ✅ CORRECT (UTC Getters) | `date.getUTCMonth() + date.getUTCDate()` | Nepal: "July 15"<br>US: "July 15" (Safe). |
| ✅ CORRECT (String Parsing) | `isoString.substring(8,10)` (Parsing the string directly) | Nepal: "15"<br>US: "15" (Bulletproof). |

**The Rule:** When dealing with pure calendar dates (no time component), always use `.getUTCFullYear()`, `.getUTCMonth()`, `.getUTCDate()` for formatting, and always use `toISOString().split('T')[0]` or custom string slicing for storage/comparison. Avoid `toLocaleDateString` at all costs.

---

## 5. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Daylight Saving Time (DST) transition. | The UTC offset shifts by ±1 hour (e.g., US DST). The date string `2025-07-15` is unaffected. The UTC getters still return the correct year/month/day. |
| User travels across the International Date Line. | If the user travels from Asia to North America, the local time might shift by ~15 hours. The UTC getters ensure the calendar date (the user's actual period start date) remains constant. |
| Bikram Sambat (BS) conversion. | The `adToBsDate` function uses UTC getters internally. If it accidentally used local time, the BS date might shift. Ensure the conversion library (or wrapper) strictly uses UTC. |
| Comparing dates (e.g., `isSameDay`). | Use date-fns functions that compare dates in UTC, or compare the ISO strings directly (`'2025-07-15' === '2025-07-15'`). |

---

## 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Dates remain accurate across timezones. | 1. Manually set the phone's timezone to Nepal (UTC+5:45).<br>2. Log a period on July 15.<br>3. Change the phone's timezone to New York (UTC-4:00).<br>4. Open the app.<br>5. The calendar should show the period starting on July 15. | Proves the storage and formatting layers are decoupled from the device's local timezone. |
| ✅ No off-by-one errors. | 1. Log periods on the 1st, 15th, and 30th of a month.<br>2. Travel to a timezone with a large negative offset (e.g., UTC-8).<br>3. Open the app.<br>4. Verify the dates are displayed correctly (not shifted to the previous day). | Proves the `getUTCDate()` logic is correctly applied to all date displays, not just a single instance. |

---

## 7. The Code Level Rules (Enforcement)

To guarantee this behavior across the entire app, these rules must be enforced in code review:

- **Store:** Always store dates as ISO strings (`YYYY-MM-DD`). Never store Date objects directly in AsyncStorage.
- **Read:** When reading from SQLite, treat the string as a pure date. If you must create a Date object, do so with `new Date(string + 'T00:00:00Z')` or simply use `date-fns parseISO`.
- **Display:** Use `formatDisplayDate` (which wraps `.getUTCDate()`).
- **Input:** When the user selects a date from the picker, immediately convert it to UTC using `Date.UTC(year, month, day)` or `new Date(year, month, day)` and then normalize it via `toDateStr`.

---

## 8. Summary

This scenario proves that your app is immune to timezone shifts—a critical requirement for a global health app where users travel frequently. By strictly treating calendar dates as UTC-only entities, the app guarantees that a period logged in Nepal remains visually accurate in New York, London, or Tokyo.

- **Storage:** ISO strings (`YYYY-MM-DD`) eliminate timezone ambiguity.
- **Read/Write:** The app strictly uses `.getUTCFullYear()`, `.getUTCMonth()`, and `.getUTCDate()` to extract the date parts.
- **Display:** The UI never uses `toLocaleDateString` for calendar dates.

This guarantees that off-by-one errors (the most dreaded bug in calendar systems) are completely eradicated from the system. 🌸📅✈️

---

# Scenario 43: Multi-Device Setup — Temp ID Collision — Detailed Explanation

This scenario validates the "Local ID Isolation" principle—ensuring that the temporary IDs generated offline never cause data corruption, even in the astronomically unlikely event of a collision. It also highlights the critical distinction between `temp_id` (local optimistic UI tracking) and `idempotency_key` (server-side deduplication), and why the latter is the ultimate safeguard against edge-case collisions.

---

## 1. The Problem: The "Impossible" Collision

| Challenge | Description |
|-----------|-------------|
| The `temp_id` Role | When a user creates a period offline, the mobile app generates a `temp_id` (e.g., `'temp-abc'`) to link the optimistic UI entry to the pending operation in the offline queue. |
| The Collision Scenario | Device A (offline) generates `temp_id = 'abc'`. Device B (offline) generates `temp_id = 'abc'` at the exact same microsecond using the same fallback random generator (e.g., if `crypto.randomUUID()` is unavailable). |
| The Risk (If not handled) | When both devices sync, the server might see two operations with the same `temp_id`. If the server uses `temp_id` as the key for conflict resolution, it might overwrite one operation with the other, leading to data loss. |

**The Golden Rule:** `temp_id` is local to the device—it is NEVER sent to the server as a primary key. The server relies on `idempotency_key` to deduplicate requests, and on the actual database primary key (`id`) to store records. The mobile app uses `temp_id` only to map the server's response back to the correct optimistic UI element.

---

## 2. The Architecture: The "Double Key" System

| Identifier | Where it's generated | Used For | Server's Role |
|------------|----------------------|----------|---------------|
| `temp_id` | Mobile client (offline) | Optimistic UI linking, cascading deletes, temporary cache keys. | **IGNORED** (not stored in the database). |
| `idempotency_key` | Mobile client (offline) | Deduplicating API requests (preventing double submission). | Stored temporarily (24h) in a cache to prevent duplicate processing. |
| `id` (Server UUID) | Server (PostgreSQL) | Permanent primary key for the record. | Stored permanently and returned to the client. |

---

## 3. Step-by-Step System Behavior (When a Collision Happens)

### Step 3A: Device A Creates Period Offline

**Action:** User logs a period (start date June 10).

**Generation:**

- `temp_id = 'abc'` (generated by the fallback UUID generator, hypothetically).
- `idempotency_key = 'ik-1'` (different from Device B).

**Queue:** Operation is enqueued with `temp_id: 'abc'` and `idempotency_key: 'ik-1'`.

**UI:** The calendar shows a Dark Pink block for June 10, linked to `temp_id: 'abc'` in React Query's cache.

---

### Step 3B: Device B Creates Period Offline (The Collision)

**Action:** Another user (or the same user on another device) logs a period (start date June 12).

**Generation:**

- `temp_id = 'abc'` (collision!).
- `idempotency_key = 'ik-2'` (different).

**Queue:** Operation is enqueued with `temp_id: 'abc'` and `idempotency_key: 'ik-2'`.

**UI:** Device B shows a Dark Pink block for June 12, also linked to `temp_id: 'abc'`.

---

### Step 3C: Sync Engine Processes (The Safe Resolution)

**Device A Syncs (First):**

- `syncEngine` sends `POST /sync/batch` with Operation A.
- **Headers:** `Idempotency-Key: ik-1`.
- **Body:** `{ temp_id: 'abc', data: { period_start_date: '2025-06-10' } }`.
- **Server:** Checks `ik-1`. No record found. Creates a new cycle entry with `id = server-uuid-1`. Returns `{ temp_id: 'abc', status: 'created', server_id: 'server-uuid-1' }`.

**Device B Syncs (Later):**

- `syncEngine` sends Operation B.
- **Headers:** `Idempotency-Key: ik-2`.
- **Body:** `{ temp_id: 'abc', data: { period_start_date: '2025-06-12' } }`.
- **Server:** Checks `ik-2`. No record found. Creates a new cycle entry with `id = server-uuid-2`. Returns `{ temp_id: 'abc', status: 'created', server_id: 'server-uuid-2' }`.

---

### Step 3D: UI Resolution (React Query Cache)

**Device B (first to sync):**

- `onSuccess` handler receives `{ temp_id: 'abc', server_id: 'server-uuid-1' }`.
- It updates the React Query cache: replaces the entry with `temp_id: 'abc'` with the new `server-uuid-1` entry. The June 10 period appears correctly.

**Device B (second sync):**

- The app invalidates the cache (`invalidateQueries`).
- The `queryFn` re-fetches from SQLite. SQLite now contains both `server-uuid-1` (June 10) and `server-uuid-2` (June 12).

**Result:** The UI shows both periods correctly, even though both temporarily shared the same `temp_id` during the optimistic phase.

---

## 4. The Safeguard: Why `idempotency_key` Prevents Catastrophic Loss

The real danger isn't two different records colliding—it's the same device accidentally submitting the exact same request twice (e.g., due to a network timeout retry). The `idempotency_key` is designed for this exact scenario:

**Scenario:** Device A submits Operation A with `idempotency_key: ik-1`. The server processes it and returns 200. However, the mobile app crashes before it receives the response.

**Retry:** On the next launch, the sync engine retries the operation, sending the same `idempotency_key: ik-1`.

**Server Check:** The server checks its 24-hour cache for `ik-1`. Finds the existing record. Returns 200 with the existing `server-uuid-1`.

**Result:** No duplicate record is created. The operation is idempotent.

**Key Insight:** Since Device A and Device B have different `idempotency_keys` (`ik-1` vs `ik-2`), the server correctly identifies them as two distinct operations, regardless of the `temp_id` collision.

---

## 5. The Fallback Generator (The Real World Probability)

The plan acknowledges that `crypto.randomUUID()` is the primary generator, but there is a fallback for older JavaScript engines (Hermes on Android). The fallback uses a high-entropy random generator:

- `Math.random()` might be used, but it is wrapped in a high-resolution timestamp seed.
- Even in the absolute worst case (poor entropy), the chance of collision is still astronomically low (1 in 2^48 or less).

The plan explicitly accepts this risk, knowing that the `idempotency_key` (which is a separate UUID) acts as the ultimate safety net on the server side.

---

## 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Unique IDs prevent data overwriting. | 1. Force the app to use the fallback UUID generator (mock `crypto.randomUUID` to return a deterministic value).<br>2. Create a period offline on two different devices with the same `temp_id`.<br>3. Sync both.<br>4. The server should create two distinct entries, not overwrite one. | Proves the `temp_id` is not used as a primary key on the server. The server relies on the database's auto-generated UUIDs and the `idempotency_key` for deduplication. |
| ✅ Server dedup protects against edge-case collisions. | 1. Create an operation with `idempotency_key = 'ik-1'` on Device A.<br>2. Create a different operation on Device B with the SAME `temp_id = 'abc'` but a DIFFERENT `idempotency_key = 'ik-2'`.<br>3. Sync both.<br>4. Verify that the server processes both operations (returns two different `server_id`s). | Proves that `idempotency_key` is the true source of deduplication, not `temp_id`. |
| ✅ React Query handles cache updates gracefully. | After the sync, check the in-memory React Query cache. The two entries should have distinct `id` fields (the server UUIDs). The optimistic entry with `temp_id: 'abc'` should be replaced by the correct server data. | Proves that the client-side cache correctly resolves the mapping, even if two entries temporarily shared the same local ID. |

---

## 7. Why This Matters (The Business Logic)

| Without Proper ID Separation | With Proper ID Separation |
|------------------------------|---------------------------|
| Server sees `temp_id` and assumes it's a primary key. Device B overwrites Device A's data. | Server ignores `temp_id`. It uses `idempotency_key` for dedup. Both records are preserved. |
| User complains: "My period from June 10 disappeared!" | User sees both periods. No data loss. |
| Debugging becomes a nightmare of trying to trace "missing" records. | Sentry logs show duplicate `idempotency_key` attempts (if any), but operations are idempotent. |

---

## 8. Summary

This scenario proves that your offline-first architecture is resilient against the rarest of edge cases: a temporary ID collision. By strictly separating:

- `temp_id` (local UI state, never trusted by the server).
- `idempotency_key` (server-side deduplication, the ultimate safeguard).
- `id` (server-generated, the permanent source of truth).

The system guarantees that even if two devices generate the exact same `temp_id` at the exact same microsecond, no data is overwritten, no entries are lost, and the server processes both operations as distinct entities. This architectural separation is the hallmark of a robust, production-grade offline-first application. 🌸🛡️🔑

---

# Scenario 45: Full Disk Space Recovery — Detailed Explanation

This scenario validates the "Nuclear Fallback" of your offline-first architecture against the ultimate hardware limit: a completely full device storage. It simulates the moment a user's phone is critically low on free space (e.g., < 50 MB left), and the app attempts to write a large chunk of data (e.g., 5 MB of new historical records) to the SQLite database.

SQLite will throw a `SQLITE_FULL` error. The system must ensure that this error does not crash the app and, more importantly, the user's newly entered data is never lost—it must be safely preserved in the offline queue until the user frees up space.

---

## 1. The Problem: The "Zero Space" Wall

| Challenge | Description |
|-----------|-------------|
| SQLite Write Failure (`SQLITE_FULL`) | SQLite allocates new pages when inserting or updating data. If the device's storage is full, the OS prevents SQLite from allocating these pages, throwing a native `SQLITE_FULL` error. |
| The Data Loss Risk | If the app simply crashes on this error, the user loses the journal entry or period log they just wrote. If the app ignores the error and continues, the data is never persisted to disk and will vanish on app restart. |
| The Queue Size Risk | The offline queue (EncryptedStorage) is typically small (< 1 MB). However, if the disk is completely full, even writing 1 KB to the queue might fail. The system needs multiple fallback layers. |

**The Golden Rule:** Data created by the user must never be lost due to a storage constraint. If SQLite cannot write, the operation must remain in the "pending" state (EncryptedStorage) until the storage issue is resolved.

---

## 2. The Architecture: The "Queued Persistence" Safety Net

The system leverages the existing "No SQLite Write Before Server Confirmation" rule (Scenario 32) to protect against disk-full errors.

| Component | Role in this Scenario |
|-----------|----------------------|
| Optimistic UI (React Query Cache) | The UI updates instantly, so the user sees their new data immediately. |
| Offline Queue (EncryptedStorage) | The operation is enqueued before attempting the SQLite write. If SQLite fails, the queue acts as a "lifeboat" for the data. |
| SQLite (Permanent Cache) | Fails (throws `SQLITE_FULL`). This is expected and handled gracefully. |
| Service Layer (`BaseLocalService`) | Wraps the `db.insert()` or `db.upsert()` call in a try-catch to prevent the error from bubbling up to the UI. |

---

## 3. Step-by-Step System Behavior

### Step 3A: User Action & Optimistic UI

**User Action:** User logs a new period (start date July 20). The phone's storage has < 50 MB free.

- **Optimistic UI:** The calendar instantly shows Dark Pink for July 20 (React Query in-memory). The user thinks the action succeeded.

---

### Step 3B: The Write Pipeline (The Critical Order)

The mutation hook executes in a specific order:

1. **Enqueue to EncryptedStorage:** The mutation first writes the operation to `offlineStore.enqueue()` (Scenario 32 - Golden Rule). This operation is tiny (~200 bytes). It succeeds (or falls back to AsyncStorage if SecureStore fails).
2. **Attempt SQLite Write:** After queuing the operation, the mutation attempts to call `localDb.cycle.upsert()` to update the permanent SQLite cache.
3. **SQLite Failure:** The phone's storage is full. SQLite throws a native `SQLITE_FULL` error.

---

### Step 3C: The Service Layer Catch

The `BaseLocalService.upsert()` method wraps the SQLite operation:

```typescript
// src/services/localDb/BaseLocalService.ts
async upsert(record: T): Promise<void> {
  try {
    const db = getDb();
    await db.insert(this.table).values(record).onConflictDoUpdate({...});
  } catch (error) {
    // Check for SQLite disk full error (code 13 or message includes "database or disk is full")
    if (error.message?.includes('database or disk is full') || error.code === 13) {
      Sentry.captureException(error, {
        tags: { context: 'sqlite.disk_full' },
        extra: { table: this.tableName, record_id: record.id },
      });
      // Do NOT rethrow. Swallow the error.
    } else {
      // Log other errors.
      Sentry.captureException(error);
    }
    // Regardless of the error, we swallow it to prevent UI crash.
  }
}
```

---

### Step 3D: UI Feedback (The Toast)

The mutation hook's `onError` handler is not triggered because the SQLite error was swallowed. However, to inform the user of the degraded state, the `offlineStore` can track a flag or the app can monitor disk space.

**Recommended Enhancement:** Add a global disk-space monitor that triggers a warning banner on the Dashboard:

> "Device storage is full. Your data is saved locally but may not be fully available offline. Please free up space."

---

### Step 3E: The Recovery (The Resolution)

1. **User Action:** The user receives a "Storage Full" notification from the OS and frees up 1 GB of space (deletes old photos).
2. **App State:** The pending operation is still safely in EncryptedStorage.
3. **Sync Trigger:** The user opens the app (or the background sync runs).
4. **Sync Engine:** `syncEngine.pushOperations()` reads the queue and sends the operation to the server.
5. **Server Success:** The server returns 200 OK.
6. **SQLite Hydration:** `syncEngine.hydrateSqlite(server_data)` is called. This time, the disk has space. SQLite writes successfully.
7. **Queue Clear:** The operation is removed from EncryptedStorage.
8. **Final UI:** The React Query cache is invalidated, and the UI shows the period with a confirmed server ID.

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| EncryptedStorage is also full (cannot enqueue). | The `storage.ts` adapter falls back to AsyncStorage (Scenario 40). The queue persists. |
| AsyncStorage is also full (the absolute worst case). | The app cannot write the queue to disk. The operation remains only in the in-memory Zustand store. When the user force-quits the app, the operation is lost. **Mitigation:** If the app detects that both SecureStore and AsyncStorage are full, it should show a critical alert: "Storage full. Please free up space immediately to save your data." |
| The `SQLITE_FULL` error occurs mid-transaction (`upsertMany`). | SQLite rolls back the transaction. The database remains consistent. No partial writes. |
| User force-quits the app after the SQLite error but before the queue is synced. | The operation is safe in EncryptedStorage. On the next launch, it will be retried. |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ App does not crash on disk-full. | 1. Fill the device's storage to < 50 MB free (e.g., using a large file creation script).<br>2. Log a period.<br>3. The app should not crash. The UI should remain interactive. | Proves the try-catch in `BaseLocalService` is correctly swallowing the `SQLITE_FULL` error. |
| ✅ Data is preserved in the queue. | After logging the period (with disk full), check the `offlineStore` (EncryptedStorage). The pending operation should be present. | Proves the write order (enqueue before SQLite) is correct and the queue persists. |
| ✅ Sentry receives the error. | Check Sentry dashboard. An event should appear with the `sqlite.disk_full` tag and the table name. | Proves the team is alerted to systemic disk-full issues, allowing them to guide users proactively. |
| ✅ Recovery works. | 1. Free up disk space.<br>2. Trigger a sync (or reopen the app).<br>3. The period should appear in SQLite and the queue should be cleared. | Proves the end-to-end recovery loop works. |

---

## 6. Why This Matters (The Business Logic)

| Without Queue Protection (Crash or Data Loss) | With Queue Protection (Graceful Degradation) |
|-----------------------------------------------|----------------------------------------------|
| App crashes. User loses the period entry. They think the app is "broken." | App shows a warning toast. The period entry is safely queued. User sees their data optimistically. |
| User uninstalls the app in frustration, losing all offline history. | User frees up space. The app automatically recovers and syncs the data. No frustration. |
| Support tickets spike: "Why is my app crashing when I try to log a period?" | Sentry alerts the team proactively. The team can publish a help article on freeing space. |

---

## 7. Summary

This scenario proves that your app is bulletproof against the most common hardware failure—a full disk. By strictly adhering to the "Queue-First" write order (EncryptedStorage → SQLite), the system guarantees that even if the permanent cache fails, the user's data is safely stored in the offline queue.

When the user eventually frees up space, the sync engine seamlessly hydrates SQLite from the server, recovering the data without any user intervention. This is the hallmark of a truly resilient, offline-first health app. 🌸🛡️💾
