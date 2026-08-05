# Sign-In / Sign-Out Flow Logic & Complete Session Isolation

> **Status:** Locked spec — ready for implementation tickets.
> **Product scenario (the "Sister" test):**
> User A logs out → app clears every trace of User A. A sibling opens the app,
> sees **Login/Signup** (never Home, never Onboarding), creates a new account,
> is routed through full **Onboarding** because the backend reports her as not
> onboarded, and only then reaches Home with **her own** data.
>
> **Golden rule:** In a sensitive health app, anything that could be tied to a
> user must be cleared. **Zero exceptions.** If a new store / storage key /
> SQLite table is ever added, it MUST be added to the reset logic in the same PR.

---

## 1. Desired User Experience

| Actor            | Action                                        | Expected outcome                                |
|------------------|-----------------------------------------------|-------------------------------------------------|
| User A           | Logs out                                       | App clears all local state; no trace of User A  |
| Sister           | Opens app                                      | Sees Login/Signup screen (not Home, not Onboarding) |
| Sister           | Creates account → backend `onboarding_completed == false` | Full Onboarding (Personal Info → Cycle History → Complete) |
| Sister           | Finishes onboarding                            | Home screen populated with her data              |

**Result:** Complete isolation. No data leakage, no confusing stale UI.

---

## 2. Phase 1 — The Logout Action (critical, blocking)

When the user taps **Logout**, the app must run these steps **before** navigating
away. Order matters — clear in-memory first to avoid a 1-frame flash of User A's
data.

| Step | Action | Why |
|------|--------|-----|
| 1 | **Reset Zustand stores** | `reset()` for every store. Prevents old-user data flashing for 1 frame before navigation. |
| 2 | **Clear EncryptedStorage keys** | Remove `shecare.accessToken`, `shecare.refreshToken`, `shecare.user`, `user_preferences`, `shecare.session_analytics_id`, `draft_metadata`, `shecare.offline.queue`, `local_correction_delta`, sentry consent. *Do NOT rely on `EncryptedStorage.clear()` — it is a no-op on native (expo-secure-store).* |
| 3 | **Clear AsyncStorage keys** | `shecare.onboarding`, `shecare_pregnancy_mode`, `REACT_QUERY_OFFLINE_CACHE`, `shecare.last_known_location`. |
| 4 | **Purge local SQLite DB** | `closeDb()` + `deleteDatabaseAsync('shecare.db')`, fallback to `DELETE FROM` per table. Prevents sister from seeing User A's period dates / moods / diary pages. |
| 5 | **Clear React Query cache** | `queryClient.clear()`. Server-state must not be served to the next user. |
| 6 | **Reset navigation** | `user → null` drives RootNavigator to **Auth** declaratively. |

---

## 3. Phase 2 — The New Login (Sister)

On sign-up, the backend returns a fresh `auth_token` + user profile.

1. `AppProvider` (pre-warm) reads the token.
2. `authStore.hydrate()` → `authService.getMe()` fetches the **new** user's profile.
3. Backend `onboarding_completed == false` for a brand-new user.
4. RootNavigator: token exists **but** onboarding not completed → redirects to
   **OnboardingStack** (not Home).

**Critical rule:** rely on the **backend** `onboarding_completed` flag, never the
local/EncryptedStorage flag, when deciding navigation after a fresh login.

---

## 4. The Critical Gotcha (what breaks this flow)

- Any stale `isCompleted` persisted in `shecare.onboarding` (AsyncStorage) routes
  the next user **straight to Main**, skipping onboarding and showing stale data.
- `RootNavigator` currently reads `shecare.onboarding` into `storageCompleted`
  **once on mount** and keeps `serverChecked` as a module-level ref — both persist
  across logout→login within the same process.

---

## 5. Audit findings — current gaps (pre-existing)

| # | Gap | Location | Severity |
|---|-----|----------|----------|
| 1 | SQLite (`shecare.db`) never purged — 26 tables survive logout | `src/db/` | 🔴 CRITICAL |
| 2 | Onboarding flag survives logout: `reset()` preserves `isCompleted`; `RootNavigator` caches it once on mount | `src/stores/onboardingStore.ts:53`, `src/navigation/RootNavigator.tsx:49-62` | 🔴 CRITICAL |
| 3 | `EncryptedStorage.clear()` is a no-op on native; only tokens + `shecare.user` removed explicitly | `src/services/storage.ts:48-49`, `src/stores/authStore.ts` | 🔴 HIGH |
| 4 | Offline action queue (`shecare.offline.queue`) not cleared | `src/stores/offlineStore.ts` | 🔴 HIGH |
| 5 | Other stores not reset (cycle/safety/pregnancy/endDate/healthMetrics/achievement/companion/diaryAsset/download/syncMetrics) | `src/stores/` | 🟠 MEDIUM |
| 6 | React Query cache not cleared on the real logout path (`useLogout()` is unused) | `src/screens/profile/ProfileHomeScreen.tsx`, `src/services/queries/auth.ts` | 🟠 MEDIUM |
| 7 | AsyncStorage leftovers survive (`REACT_QUERY_OFFLINE_CACHE`, `shecare.last_known_location`) | `src/app/App.tsx`, `src/stores/pregnancyModeStore.ts` | 🟠 MEDIUM |

---

## 6. Locked design decisions

### 6.1 SQLite purge strategy — **Option B: Delete-and-recreate the file**

Chosen over `DELETE FROM` all tables because:

| Criterion | `DELETE FROM` (A) | `deleteDatabaseAsync` (B) |
|-----------|-------------------|----------------------------|
| Maintenance | Must maintain 26-table list forever | Zero maintenance, wipes everything |
| Foreign keys | Needs `PRAGMA foreign_keys=OFF` + careful ordering | Automatic (file gone) |
| Sequences / auto-increment | `sqlite_sequence` retains stale IDs | Resets perfectly |
| Migrations | Old `sqlite_master` metadata persists | Fresh schema on next migration |
| Performance | 100s of ms deleting 26+ tables | ~50 ms atomic OS call |
| Risk of omission | Missed table ⇒ data leak | Zero |

**Technical nuances:**
- Use `deleteDatabaseAsync` from `expo-sqlite` (async API).
- Call `db.closeAsync()` **first** to release file locks on Android.
- If `deleteDatabaseAsync` fails (rare permission errors), **fall back** to
   `DELETE FROM` per table as a safety net.

```ts
// src/services/sessionReset.ts (design sketch)
import * as SQLite from 'expo-sqlite';
import { closeDb } from 'src/db/connection';

const ALL_TABLES = [
  'user_profiles', 'onboarding_data', 'cycle_entries', 'journal_entries',
  'mood_logs', 'emergency_contacts', 'sos_alerts', 'pregnancy_profiles',
  'pregnancy_daily_logs', 'pregnancy_milestones', 'pregnancy_recommendations',
  'family_links', 'chat_rooms', 'nurse_contents', 'feature_flags',
  'health_insights', 'predictions', 'snooze_events', 'sync_log',
  'companion_metadata', 'health_metrics', 'diaries', 'diary_pages',
  'diary_page_objects', 'diary_media', 'diary_assets',
];

async function purgeSQLite() {
  closeDb(); // releases the handle used by the app
  try {
    await SQLite.deleteDatabaseAsync('shecare.db');
  } catch {
    const db = SQLite.openDatabaseSync('shecare.db');
    await db.execAsync(`
      PRAGMA foreign_keys = OFF;
      ${ALL_TABLES.map((t) => `DELETE FROM ${t};`).join('\n')}
      PRAGMA foreign_keys = ON;
    `);
    db.closeSync();
  }
}
```

> **Note:** the 26-table fallback list is locked in the **implementation** of
> `sessionReset.ts`. New tables must be added there. This doc is the source of
> truth for the intent; the code comment enumerates the list.

### 6.2 Store resets — **reset EVERYTHING, no exceptions**

| Store | Why it MUST reset |
|-------|-------------------|
| `syncMetricsStore` | Stale sync timestamps / pending-upload counts could make Sister skip syncing her own data. |
| `achievementStore` | Per-user cycle achievements would show a "visual lie" on Home. |
| `companionStore` | Luna dialogue state / mood / emotional progression is per-user. |
| `downloadStore` | Stale "downloaded" badges for assets she hasn't downloaded. |
| `safetyStore` | Per-user active SOS; stale "SOS Active" banner must not show. |
| `pregnancyModeStore` | `shecare_pregnancy_mode` is per-user; Sister must not land on pregnancy screens. |

### 6.3 RootNavigator fix — key onboarding state off `user`

Do NOT add complex epochs. Move the onboarding check into an effect that depends
on `user`. When `user` is null, reset `storageCompleted` to false so a fresh
login always re-evaluates.

```ts
useEffect(() => {
  if (user) {
    checkOnboardingStatus(user.id); // sets storageCompleted
  } else {
    setStorageCompleted(false);
  }
}, [user]);
```

### 6.4 Clear everything, listed explicitly

EncryptedStorage keys to remove:
- `shecare.accessToken`
- `shecare.refreshToken`
- `shecare.user`
- `user_preferences`
- `shecare.session_analytics_id`
- `draft_metadata`
- `shecare.offline.queue`
- `local_correction_delta`
- sentry-consent key

AsyncStorage keys to remove:
- `shecare.onboarding`
- `shecare_pregnancy_mode`
- `REACT_QUERY_OFFLINE_CACHE`
- `shecare.last_known_location`

---

## 7. Implementation plan

### 7.1 New file — `src/services/sessionReset.ts`
Single orchestrator `resetAppForLogout()`:
1. Reset all Zustand stores in a `Promise.all` list (with a comment listing them so
   future devs must add any new store).
2. Explicitly `removeItem` every EncryptedStorage key (cannot rely on `clear()`).
3. Remove AsyncStorage keys.
4. `purgeSQLite()` (Option B with fallback).
5. `queryClient.clear()`.

### 7.2 `src/stores/onboardingStore.ts:53`
```diff
- reset: () => set({ ...initialState, isCompleted: get().isCompleted }),
+ reset: () => set({ ...initialState, isCompleted: false }),
```

### 7.3 `src/navigation/RootNavigator.tsx`
Reset `storageCompleted` / `serverChecked` when `user` becomes null, so a fresh
login re-evaluates onboarding against the backend flag.

### 7.4 Wire the orchestrator
- `ProfileHomeScreen.performLogout` (the real logout path).
- Fix the **SettingsScreen logout stub**.
- `client.ts:triggerSessionExpired` (auto-logout on kill-switch / replay).

### 7.5 Update tests
- Invert `test_system_test8_scenarios.test.ts:384` ("SQLite is untouched on logout").
- Add coverage for: store reset, key removal, offline queue clear, SQLite purge,
  onboarding flag reset.

---

## 8. Acceptance criteria

- [ ] `resetAppForLogout()` resets **every** store — new stores must be added.
- [ ] EncryptedStorage + AsyncStorage keys all removed (manual verification on
      device that `localStorage`/secure items are gone).
- [ ] `shecare.db` recreated empty; no User A rows remain after logout+relaunch.
- [ ] React Query cache cleared on the real logout path.
- [ ] After logout, app shows **Login/Signup**, not Home/Onboarding.
- [ ] Fresh signup → **Onboarding flow** shown (backend flag decides, not local).
- [ ] Offline action queue empty after logout.
- [ ] All affected tests pass.

---

## 9. Out of scope

- Server-side revocation beyond the existing `POST /auth/logout` + token invalidation.
- Multi-device / family-link logout propagation.
- Biometric-unlock re-establishment after logout (follow-up if needed).