# Phase F (Deferred) — E2E Test Infrastructure & Suite

> **Status: SKIPPED FOR NOW** — plan only, not to be executed in the current pass.
> **Why deferred:** the existing suite `mobile/e2e/offline.test.ts` references testIDs that do not exist anywhere in `src/` (grep found **zero** `testID=` in app code), and no Detox/Maestro config was found in `mobile/`. Running E2E today is impossible without both repair work and a native build + emulator.
> **Source audit:** `current_condition_ofapp/08_017_2026.md` §2.14.

---

## F.1 Current state (verified)

1. **Only one E2E file:** `mobile/e2e/offline.test.ts` (73 lines).
2. It uses **Detox** API: `device.launchApp({ launchArgs: { E2E_TEST_OFFLINE } })`, `element(by.id('login-screen'))`, `waitToBeVisible`, `typeText`, `tap`.
3. It references these testIDs — **none exist** in the app: `login-screen`, `email-input`, `password-input`, `login-button`, `dashboard-screen`, `journal-tab`, `new-entry-button`, `journal-title`, `journal-content`, `save-entry-button`.
4. No Detox config (`.detoxrc.js` / `detox.config.js`) or Maestro YAML found in `mobile/` (audit noted Maestro/Detox for E2E in AGENTS.md §2.14, but nothing is configured).
5. Test relies on `E2E_TEST_OFFLINE` launch arg for network simulation — need to confirm the app reads that flag (grep `E2E_TEST_OFFLINE` in `src/`; audit found nothing — likely also missing).

## F.2 Decision needed before starting

Pick ONE framework (do not mix):
- **Option A — Detox** (matches existing file): requires Android emulator + iOS simulator, a native build step per run, and maintaining testIDs. Heaviest setup.
- **Option B — Maestro** (AGENTS.md §2.14 mentions it): YAML flows, no native build, runs against a dev/EXPO build. Lighter, faster to adopt; the existing `offline.test.ts` would be rewritten in YAML.

**Recommendation:** Maestro for speed; keep `e2e/offline.test.ts` as reference or delete it.

## F.3 Work items (whenever this phase is approved)

1. **Add the missing testIDs** to app code (must be done regardless of framework):
   - Auth: `login-screen`, `email-input`, `password-input`, `login-button` (check `src/screens/auth/` — the auth stack is Phone/Otp/Mfa/Login/Register; confirm the login screen shape).
   - Home: `dashboard-screen`, `journal-tab` (tab button `accessibilityLabel`/`testID` on `MainTabs.tsx`), `new-entry-button` (JournalList FAB), `journal-title`, `journal-content`, `save-entry-button` (JournalEntryScreen).
   - Guard: `grep -rn "E2E_TEST_OFFLINE" src/` — if absent, add the NetInfo-offline override hook so `launchOffline()` actually forces offline (currently it would do nothing).
2. **Set up the runner:**
   - Detox: `.detoxrc.js`, install `detox` dev dep, config iOS sim + Android emu, `build` script (`npx expo run:android`/`:ios` with `--variant debug`), `test` script.
   - Maestro: `mobile/.maestro/` flows + `maestro test` script; app runs via `npx expo start` on the emulator.
3. **Fix/rewrite `e2e/offline.test.ts`:**
   - Ensure login flow matches actual screen IDs (Phone/Otp flow, not just email/password — check `AuthStack`).
   - Keep the 3 core journeys per AGENTS.md §2.14: login → log period → trigger SOS.
   - Add offline-journal test (the file's current intent).
4. **CI wiring** (`.github/workflows/` or `mobile/eas.json`): run E2E on PR for both platforms (AGENTS.md §2.14: "CI runs both iOS and Android simulators"). Heavy — likely only Android in CI initially.

## F.4 Scope guardrails
- Do **not** block the P0–P2 production pass on this phase.
- E2E only needs the testID additions (small, safe) if/when this phase is started; keep them out of Phases A–E to avoid churn before the framework choice is made.

## F.5 Verification (when executed)
- `maestro test` (or `detox test`) passes green on: login → log period → SOS flow + offline journal queue test.
- CI job green on Android (and iOS if infra allows).

## Files touched (Phase F, when started)
- `mobile/e2e/offline.test.ts` (rewrite) or `mobile/.maestro/*.yaml` (new)
- `.detoxrc.js` or `mobile/.maestro/` config
- `mobile/package.json` (+ `detox` or `@maestro` devDeps)
- `mobile/src/screens/auth/*` (testIDs)
- `mobile/src/screens/home/HomeDashboardScreen.tsx` (dashboard-screen)
- `mobile/src/navigation/MainTabs.tsx` (tab testIDs)
- `mobile/src/screens/wellness/JournalListScreen.tsx` + `JournalEntryScreen.tsx` (journal testIDs)
- `mobile/src/services/sync/index.ts` or new hook (E2E_TEST_OFFLINE override)
- `mobile/.github/workflows/*` or `eas.json` (CI E2E job)
