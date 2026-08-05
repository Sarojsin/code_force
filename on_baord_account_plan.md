# Onboarding Gate Fix — Scope `shecare.onboarding` to the User

> Golden rule (from `plans/signin_signout_flow_logic.md`): every new user MUST complete
> onboarding after account creation; a fresh registration must never land directly on the
> dashboard.

## Root Cause

`RootNavigator` trusts a **global** persisted flag (`shecare.onboarding`, zustand `persist`).
When a sibling registers after User A completed onboarding and then closed the app **without
logging out**, `sessionReset` never runs, so the stale `{ isCompleted: true }` object stays in
AsyncStorage. `RootNavigator` mounts, reads that global key, and skips onboarding → dashboard.

The backend is already correct:
- Register returns `onboarding_completed: false` for a new user
  (`backend/app/modules/auth/routes.py:79` — no `UserOnboarding` row → `get_status()` → `False`).

This is purely client-side global state — the same class of bug as the React Query cycle-cache
leak, but on zustand persistence. Fix = **structural isolation** (scope the flag by `userId`),
not just runtime deletion.

## Key Design Principle: Zustand is the single source of truth (hydration-safe)

Do **NOT** manually `AsyncStorage.getItem` + `useState` inside the Navigator. Zustand's
`persist` middleware rehydrates **asynchronously** after mount; manual parsing would read a
stale/null value and cause a flash between Onboarding and Main when hydration completes.

Instead:
- Add `userId` + an `isHydrated` flag to the onboarding **store** (set via
  `onRehydrateStorage`).
- `RootNavigator` reads only from the store, never from AsyncStorage directly.
- A `useEffect` acts as a **garbage collector**: if it finds a stored `userId` belonging to a
  *different* user, it calls `setCompleted(false)` — which deletes `userId` + `isCompleted`
  from in-memory and AsyncStorage in one move.
- A `useMemo` derives the final decision from store state + server flag.

## Changes

### 1. New: `mobile/src/utils/onboardingDecision.ts` (pure, unit-testable)

```ts
export interface StoredOnboardingFlag {
  isCompleted: boolean;
  userId: string | null;
}

// Decision: should we show the onboarding stack?
// - No current user            -> false (auth stack handles it outside this helper)
// - Stored flag belongs to user -> use its isCompleted
// - Different/null user flag    -> trust server; default to show onboarding on unknown
export function shouldShowOnboarding(
  storedFlag: StoredOnboardingFlag | null,
  currentUserId: string | null,
  serverFlag: boolean | null,
): boolean {
  if (!currentUserId) return false;
  if (storedFlag?.userId === currentUserId) return !storedFlag.isCompleted;
  return serverFlag !== true;
}
```

Export from `mobile/src/utils/index.ts`.

### 2. `mobile/src/stores/onboardingStore.ts`

- Add `userId: string | null` to state (`initialState` = `null`).
- Add `isHydrated: boolean` (transient — **not** persisted), set to `true` via
  `onRehydrateStorage` when AsyncStorage rehydration completes. This prevents the Onboarding →
  Main flash.
- `setCompleted(v)`:
  - `true` → capture `useAuthStore.getState().user?.id ?? null`
  - `false` → clear `userId`
  - Direct `import { useAuthStore } from './authStore'` — no cycle (authStore does not import onboarding).
- `reset()` → clears `isCompleted`, `userId`.
- **Strict `partialize` whitelist** (~200 bytes, never persists transient flags):

```ts
partialize: (state) => ({ isCompleted: state.isCompleted, userId: state.userId }),
```

### 3. `mobile/src/types/onboarding.ts`

- Add `userId: string | null` and `isHydrated: boolean` to `OnboardingState`.

### 4. `mobile/src/navigation/RootNavigator.tsx`

Replace the three effects + `storageCompleted` / `serverChecked` / `serverRetry` juggling with a
single deterministic, hydration-safe flow:

```tsx
const user = useAuthStore((s) => s.user);
const authIsHydrated = useAuthStore((s) => s.isHydrated);
const isCompleted = useOnboardingStore((s) => s.isCompleted);
const storedUserId = useOnboardingStore((s) => s.userId);
const onboardingIsHydrated = useOnboardingStore((s) => s.isHydrated);
const setCompleted = useOnboardingStore((s) => s.setCompleted);

// Garbage collector: delete a foreign user's flag the moment we notice it.
useEffect(() => {
  if (user && storedUserId && storedUserId !== user.id) {
    setCompleted(false);
  }
}, [user?.id, storedUserId, setCompleted]);

const showOnboarding = useMemo(() => {
  if (!user) return false;
  return shouldShowOnboarding(
    { isCompleted, userId: storedUserId },
    user.id,
    user.onboarding_completed ?? null,
  );
}, [user, isCompleted, storedUserId]);

// Splash until auth AND onboarding hydration settle (no flash).
if (showSplash || !authIsHydrated || !onboardingIsHydrated) {
  return <SplashScreen onFinish={() => setShowSplash(false)} />;
}

// Render: user ? (showOnboarding ? Onboarding : Main) : Auth
// ...
```

- **Select fields individually** (not `s => ({ whole object })`) to avoid new-object-every-render
  re-render loops.
- **Remove** the `serverRetry` / `serverChecked` / `onboardingService.getStatus()` fallback and the
  Retry UI (dead path — `user.onboarding_completed` is always present post-`/me`).

### 5. Tests

- New `mobile/src/utils/__tests__/onboardingDecision.test.ts` — all branches:
  - matching user, `isCompleted: true` → false
  - matching user, `isCompleted: false` → true
  - different user, server `true` → false
  - different user, server `false` → true
  - different user, server `null` → true (safety default)
  - no current user → false
  - legacy persisted value without `userId` → server fallback (no forced re-onboarding when
    `serverFlag === true`)
- Update `mobile/src/__tests__/sessionReset.test.ts:134` persisted shape
  (`{ state: { isCompleted, userId } }`); add assertion that `setCompleted(true)` records `userId`
  after setting a user in authStore.

## Backward Compatibility

Old persisted values have no `userId` (store hydrates `userId: null`). A returning user who truly
completed onboarding gets `serverFlag === true` from `/me` → `shouldShowOnboarding` returns
`false` → Main. No forced re-onboarding, no data migration.

## Verification

1. `npx tsc --noEmit`
2. Full jest suite (`npx jest`)
3. Manual 2-account repro: complete onboarding as user A, close app (no logout), register user B
   → B must land on the Onboarding stack, not the dashboard.