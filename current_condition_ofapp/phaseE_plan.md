# Phase E — P2: Dead-Code Cleanup, Bundle Size, Timer & Correctness Fixes

> **Source audit:** `current_condition_ofapp/08_017_2026.md` §6.1, §6.2, §6.3, §7.1, §10, §11 (P2)
> **Scope:** remove orphaned code/deps, guard timers, Luna lifecycle fixes, functional stub fixes.
> **Gate:** `npm run typecheck && npm run lint && npm run test` must stay green after deletions.

---

## E.1 Delete orphaned files (verified dead)

| Path | Evidence | Action |
|---|---|---|
| `mobile/src/screens/chat/ChatHomeScreen.tsx` | no navigator mounts it; only type refs | delete |
| `mobile/src/screens/chat/ChatRoomScreen.tsx` | same | delete |
| `mobile/src/screens/dev/OfflineDashboardScreen.tsx` | only self-def | delete |
| `mobile/src/components/ui/dayDetail/MetricStepper.tsx` | exported via barrels, never imported | delete + remove from barrels |
| `mobile/src/hooks/useTodayDayData.ts` | only a comment ref (already handled Phase A) | delete (done in A.5) |
| `mobile/src/assets/companion/luna_assets_v1.1.0.zip` | runtime uses server-downloaded `luna_assets_v2.zip` (`assetDownloader.ts:16`) | delete |
| `mobile/src/assets/companion/spritesheet.json` | only a runtime path constant `assetPaths.ts:5` (filesystem copy, not bundled) | delete |

**Barrel cleanup:**
- `mobile/src/components/ui/dayDetail/index.ts:7` and `mobile/src/components/ui/index.ts:10` — remove the `MetricStepper` export.
- `mobile/src/services/queries/index.ts:8` exports `./chat` — `chat.ts` queries target the deleted chat screens. **Verify** `chat.ts` isn't used by any remaining screen before removing the export; if used by nothing, delete `services/queries/chat.ts` too and drop the export line.

**Dead type entries in `mobile/src/navigation/types.ts`:**
- `:35` `CycleStackParamList.PhaseDetail` — never registered in `CycleStack` (`FeatureStacks.tsx:87-99`). Remove.
- `:66-68` `ChatStackParamList` + `:137` `RootStackParamList.Chat` — orphaned chat screens. Remove.
- `:87` `HomeStackParamList.WellnessHub` — never registered in `HomeStack` (`HomeStack.tsx:33-68`). Remove.

**Also verify (audit §10.1 #8)** `MetricStepper` has no snapshot test referencing it (`src/__tests__` grep before deletion).

---

## E.2 Uninstall dead native dependency: `lottie-react-native`

**Package:** `mobile/package.json:61` (`lottie-react-native ^7.1.0`), 0 usages in `src/` (verified).
- **Action:** `npm uninstall lottie-react-native` (updates `package.json` + `package-lock.json`). Do **not** touch `expo-image` (wired up in Phase B).
- Note: AGENTS.md §2.6 mentions Lottie for breathing visual/pregnancy milestones — those screens currently use non-Lottie implementations (BreathingListScreen, PregnancyMilestonesScreen use RN/Reanimated), so removal is safe. If any future screen needs Lottie, it can be re-added.
- **Check:** `app.json` plugins — `lottie-react-native` isn't a plugin, so no plugin entry to remove.

**Files touched:** `package.json`, `package-lock.json`.

---

## E.3 Guard un-cleaned timers

### E.3.1 `SOSActiveScreen.tsx:149,157` — goBack timeout after unmount
- Two `setTimeout(() => navigation.goBack(), 1500)` in `handleImSafe` (success + catch paths) are not stored/cleared; can fire after unmount and pop the wrong route.
- **Fix:** store the timer id in a `useRef`; `clearTimeout` it in the unmount effect (`useEffect(() => () => clearTimeout(ref.current), [])`) and before any new goBack.

### E.3.2 `BreathingExerciseCard.tsx:87-108` — per-phase inner `setTimeout`
- Inner timeouts queued inside the phase `setInterval` are not tracked; can `setPhase` on an unmounted component.
- **Fix:** track a ref-array of timer ids (or use a generation counter ref) and clear them in the unmount effect / when a new phase starts. Prefer a `cancelledRef` guard around `setPhase`.

### E.3.3 `CalendarScreen.tsx:160` — 300 ms sheet-open timeout
- `openDaySheetFromPhase` (`:158-165`) sets `setTimeout` that fires after sheet close (sets `selectedDate`/`showDaySheet`).
- **Fix:** store in a `useRef`, clear on unmount and when the sheet closes.

### E.3.4 `App.tsx:131-138` — debounced sync timer
- `syncTimerRef.current` is cleared in the NetInfo/AppState effect cleanup (`:178`) — verify this covers all paths; if not, add the same clear in the top-level unmount. (Minor; app-root component.)

### E.3.5 `AppProvider.tsx:39` — post-pre-warm timer
- `setTimeout(() => setReady(true), 150)` not stored/cleared (minor; fires after component unmount → guarded by `cancelled` flag at `:38`). Convert to the same ref-clear pattern for consistency.

---

## E.4 Luna idle loop — AppState pause + animation cancel

**File:** `mobile/src/screens/companion/LunaOverlay.tsx` (findings verified at `:150-161`, `:217-272`, `:292-301`)

Findings:
- `floatAnim` runs an infinite `withRepeat(withSequence(withTiming(-3), withTiming(0)), -1, true)` (`:159`). It's only mounted when Home is focused (`HomeDashboardScreen.tsx:380`), so tab-switch unmount stops it — but when the app is **backgrounded** while Home is focused, the loop keeps running (no AppState-based pause inside the overlay).
- The AppState listener (`:292-301`) only stops `voiceService` and resets a timer; it does not cancel the float animation or the 4 s `idleTimer`.

**Fix:**
1. Add a `paused` shared-value (or gate the `useAnimatedStyle` on an AppState `isActive` boolean that's a shared value) so `floatAnim` returns `{}` (or `cancelAnimation`) when the app is backgrounded.
2. In the AppState `background` handler: `cancelAnimation(floatAnim)` (via `useSharedValue` guard or `cancelAnimation` on the animated style's value) and `clearInterval(idleTimer)`; on `active`, restart `startIdleCycle()` and restore float.
3. Add `useReducedMotion`/`reduceAnimations` handling already present (`:3,86`) — keep.
4. Also `cancelAnimation` the float in the unmount cleanup for safety.

**Files touched:** `screens/companion/LunaOverlay.tsx`.

---

## E.5 Functional stub fixes (from Settings + Profile audit §9.2)

| Bug | File | Fix |
|---|---|---|
| Delete Account submit is a stub (just closes modal + toast) | `SettingsScreen.tsx:263-268` | wire to `authService.deleteAccount` (backend endpoint `/auth/me` DELETE or similar per API contract) with password; on success `resetAppForLogout()`; keep stub clearly marked if endpoint doesn't exist yet (check `services/api/auth.ts`). |
| Edit Profile submit is a stub | `EditProfileScreen.tsx:39-46` | wire to `authService.updateProfile` (`PUT /auth/me` per contract); refetch user in `authStore`. |
| Change Password submit is a stub | `ChangePasswordScreen.tsx:40-47` | wire to `authService.changePassword` (`POST /auth/change-password`); on success toast + `goBack`. |
| Hero hardcoded name/email | `SettingsScreen.tsx:290-291` | (Phase C.1 #6) use `authStore`. |
| `pushNotifications` shared key / inert dark mode / no-op rows | `SettingsScreen` | (Phase C.1 #4,#5,#8). |

**Files touched:** `screens/profile/SettingsScreen.tsx`, `screens/profile/EditProfileScreen.tsx`, `screens/profile/ChangePasswordScreen.tsx`, `services/api/auth.ts` (verify endpoints), `stores/authStore.ts` (updateProfile action if missing).

**Backend note:** confirm which auth endpoints exist in `backend/app/modules/auth/routes.py` before wiring — if a delete/update endpoint is missing, add it (Phase E backend scope) and document in `plans/30-mobile-api-contract.md`.

---

## E.6 Remove redundant bundle-size bloat checks

- Verify `react-native-svg` remains (used, ~20 files) — no change.
- Verify no `import * as` from `lucide-react-native` (audit §7.3 — PASS, no action).
- Confirm `expo-av` (4 files) stays — it's used; AGENTS.md §6.2 fix already in place.

---

## Verification for Phase E
1. `npm run typecheck && npm run lint && npm run test` — especially after deletions (watch for dangling imports).
2. Grep sweep: `rg "ChatHomeScreen|ChatRoomScreen|OfflineDashboard|MetricStepper|useTodayDayData|lottie" src/` → only expected refs (docs/barrels).
3. Manual: trigger SOS → "I'm Safe" → verify goBack fires exactly once even if user navigates away quickly; background Home → verify Luna float stops (CPU drop in dev); breathing exercise → navigate away mid-phase → no setState-on-unmounted warning.

## Files touched (Phase E)
- `screens/chat/ChatHomeScreen.tsx`, `screens/chat/ChatRoomScreen.tsx` (delete)
- `screens/dev/OfflineDashboardScreen.tsx` (delete)
- `components/ui/dayDetail/MetricStepper.tsx` + barrels (delete)
- `services/queries/chat.ts` (+ barrel export) (delete if unused)
- `assets/companion/luna_assets_v1.1.0.zip`, `assets/companion/spritesheet.json` (delete)
- `navigation/types.ts`
- `package.json`, `package-lock.json` (lottie uninstall)
- `screens/safety/SOSActiveScreen.tsx`
- `screens/wellness/.../BreathingExerciseCard.tsx`
- `screens/calendar/CalendarScreen.tsx`
- `screens/companion/LunaOverlay.tsx`
- `screens/profile/EditProfileScreen.tsx`, `ChangePasswordScreen.tsx`
- `services/api/auth.ts`, `stores/authStore.ts`
- `backend/app/modules/auth/routes.py` (if endpoint missing)
- `plans/30-mobile-api-contract.md`
