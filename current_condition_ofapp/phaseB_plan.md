# Phase B — P0: Startup Time & First Paint

> **Source audit:** `current_condition_ofapp/08_017_2026.md` §4.3, §4.5, §7.1
> **Scope:** TTI, lazy loading of heavy screens, React Query pre-warming, cached image thumbnails.
> **Gate:** `npm run typecheck && npm run lint && npm run test` must stay green.

---

## B.1 Enable `LazyScreen` for heavy stacks

**File:** `mobile/src/components/ui/LazyScreen.tsx` — helper exists (`lazyScreen<T>`), **imported nowhere** (verified).

**Files to change:**
- `mobile/src/navigation/FeatureStacks.tsx` — statically imports all Wellness/Cycle/Pregnancy/Safety/Profile screens at `:5-43`.
- `mobile/src/navigation/AnalyticsStack.tsx` — statically imports `AnalyticsDashboardScreen` at `:5`.
- `mobile/src/navigation/HomeStack.tsx` — statically imports 23 screens at `:5-27`.

**Approach (keep it safe):** Only lazy-load the *heavy leaf* screens, not the tab roots:
- Analytics: `AnalyticsDashboardScreen` (SVG chart-heavy, `useCycleEntries` 12mo).
- Diary (7): `DiaryLibraryScreen`, `DiaryScreen`, `DiaryPageScreen`, `DiaryEditorScreen`, `DiaryTimelineScreen`, `DiarySearchScreen`, `DiaryAssetInstallScreen`.
- Journal/Wellness leafs: `JournalListScreen`, `JournalEntryScreen`, `InsightsScreen`, `VideoLibraryScreen`, `ContentDetailScreen`, `MoodLogScreen`, `MoodHistoryScreen`, `BreathingListScreen`, `CyclePredictionsScreen`, `CycleAnalyticsScreen`.
- Keep **tab root** screens (`WellnessHomeScreen`, `CycleDashboardScreen`, `HomeDashboardScreen`, `AnalyticsDashboardScreen` is the analytics root — lazy it too, it's the whole tab) eager so the tab bar never shows a loading spinner on first render.
  - Note: `AnalyticsDashboardScreen` IS the analytics tab root; lazy it with the `Suspense` fallback. That's acceptable — Analytics is a rarely-visited tab.

**Implementation:**
```ts
import { lazyScreen } from 'src/components/ui/LazyScreen';

const JournalListScreen = lazyScreen(() => import('src/screens/wellness/JournalListScreen'), 'JournalListScreen');
```
- **Problem:** `FeatureStacks.tsx` imports both the `HomeStack`/`WellnessStack`/etc. **and** `RootNavigator` type names. React Navigation needs a stable `component` reference — `lazyScreen` returns a stable memoized `Wrapped` per module, so this is fine. But lazy-loading the **same** screen from two navigators (e.g. `DiaryLibraryScreen` appears in both `HomeStack` and `WellnessStack`) creates **two module instances** → duplicate screen state. **Must export a singleton** from `LazyScreen` via a `Map<string, T>` cache keyed by module specifier so both navigators share one lazy component.
  - **Update `LazyScreen.tsx`:** add a module-level `const cache = new Map<string, any>()`; `lazyScreen(importFn, exportName, cacheKey)` reuses the wrapped component when `cacheKey` matches. Default `cacheKey = exportName ?? importFn.toString()`.
- Add `Suspense` fallback already provided by `LazyScreen` (`ActivityIndicator` centered). For tab-root lazy screens, prefer a themed `Skeleton` screen — optional, keep the default for Phase B.

**Files touched:** `components/ui/LazyScreen.tsx` (singleton cache), `navigation/FeatureStacks.tsx`, `navigation/AnalyticsStack.tsx`, `navigation/HomeStack.tsx`.

**Risks:**
- React Navigation 7 `getComponent` re-renders: using `component={LazyComponent}` is supported; navigation will call the Suspense boundary. Confirm no "Cannot update during render" warnings by testing tab switch.
- `onBeforeRemove`/gesture pop in `DiaryEditor` (headerShown:false) — confirm it still works after lazy load.

**Acceptance:** starting the app does not parse/evaluate Diary/Analytics/Journal modules until navigated to. Metro bundles one chunk per lazy screen.

---

## B.2 React Query pre-warming (first Home paint)

**Files:**
- `mobile/src/app/providers.tsx` — `queryClient` singleton (`:19-36`). Currently no pre-fetch anywhere (verified: zero `prefetchQuery`/`initialData`/`placeholderData` in `src/`).
- `mobile/src/providers/AppProvider.tsx` — already pre-warms 4 `EncryptedStorage` keys (`:6-11`) before showing `children`.

**Approach:** Add a `prefetch` module used by `AppProvider` once auth is known:
1. Create `mobile/src/services/queries/prefetch.ts`:
   ```ts
   import { queryClient } from 'src/app/providers';
   export async function prefetchAppData(userId: string | null): Promise<void> {
     const keys = getCycleKeys(userId);
     await Promise.allSettled([
       queryClient.prefetchQuery({ queryKey: [...keys.calendar, 3, 3], queryFn: () => cycleService.getCalendar(3, 3, toLocalDateStr(new Date())), staleTime: 10 * 60_000 }),
       queryClient.prefetchQuery({ queryKey: [...keys.predictions], queryFn: () => cycleService.getPredictions(), staleTime: 10 * 60_000 }),
       queryClient.prefetchQuery({ queryKey: nurseContentKeys.list, queryFn: () => nurseContentService.getContents({ limit: 50 }), staleTime: 5 * 60_000 }),
     ]);
   }
   ```
   Reuse the existing `queryFn` factories from `services/queries/cycle.ts` / `nurse_content.ts` where possible (extract pure functions to avoid hook context).
2. Wire into `AppProvider` after the key pre-warm: read `shecare.user` result → `useAuthStore.getState().user?.id` or the parsed user → call `prefetchAppData(userId)` **fire-and-forget** (`.catch(() => {})`), so the first `HomeDashboardScreen` mount finds warm cache entries → `networkMode: 'offlineFirst'` serves them instantly.
3. Do **not** block `setReady(true)` on prefetch — keep it behind the existing `Promise.race` timeout so TTI is not delayed.

**Files touched:** `app/providers.tsx` (export helpers if needed), `providers/AppProvider.tsx`, new `services/queries/prefetch.ts`.

**Acceptance:** after first launch warm-up, re-login / Home mount shows cached cycle calendar with zero loading skeletons. Confirm `HomeDashboardScreen` loading branch (`:179-184`) rarely flashes.

---

## B.3 Add `staleTime` to content queries

**File:** `mobile/src/services/queries/nurse_content.ts`
- `useContents` (`:19-24`) — no `staleTime` → refetch per mount/focus.
- **Fix:** `staleTime: 5 * 60_000` on `useContents`; `staleTime: 5 * 60_000` on `useContentDetail` (`:26-31`).

**Files touched:** `services/queries/nurse_content.ts`.

---

## B.4 `expo-image` cached thumbnails (`cachePolicy="memory-disk"`)

`expo-image` is installed (`package.json:48`) and registered as a plugin (`app.json:57`) but **imported nowhere** (verified). Replace RN `Image` where thumbnails appear in lists (keeps repeated scroll from re-reading disk/network):

**Files to change (RN `Image` → `Image` from `expo-image` with `cachePolicy="memory-disk"`):**
1. `mobile/src/screens/wellness/VideoLibraryScreen.tsx` — `:284` (RecommendedCard thumb), `:338` (ContentCard thumb). Add `contentFit="cover"`, `transition={200}`.
2. `mobile/src/screens/wellness/ContentDetailScreen.tsx` — `:77` media image.
3. `mobile/src/screens/diary/DiaryPageScreen.tsx` — `:113` page media.
4. `mobile/src/screens/diary/components/PolaroidFrame.tsx` — `:17` photo.
5. `mobile/src/screens/diary/components/DraggableObject.tsx` — `:81` object/photo.
6. `mobile/src/screens/companion/...LunaSprite.tsx` — `:2,25,36` — **local PNG asset; `expo-image` also works but local require doesn't need caching. Keep RN `Image` for local requires** (no network fetch to cache). Only remote URIs get `expo-image`.

**Convention:** only swap **remote-URI** images; local `require(...)` images stay on RN `Image`.

**Risks:**
- `expo-image` on a 2-column FlatList (`DiaryPageScreen`) inside `DraggableObject` — `DraggableObject` may be inside a gesture container; confirm `expo-image` plays fine with GestureHandler (it does; it's a plain View-backed component).
- Keep `resizeMode` → `contentFit` mapping: `cover`→`cover`, `contain`→`contain`.

**Acceptance:** scrolling VideoLibrary thumbnails does not re-download; image memory cache active.

---

## Verification for Phase B
1. `npm run typecheck && npm run lint && npm run test`.
2. Manual: cold-launch → note first tab render; switch to Analytics/Diary/Journal and confirm lazy chunk loads (dev menu → bundle inspector, or observe no static import in startup graph).
3. `npx expo export --platform android` (or bundle) — confirm chunk files emitted for lazy screens.

## Files touched (Phase B)
- `components/ui/LazyScreen.tsx`
- `navigation/FeatureStacks.tsx`
- `navigation/AnalyticsStack.tsx`
- `navigation/HomeStack.tsx`
- `app/providers.tsx`
- `providers/AppProvider.tsx`
- `services/queries/prefetch.ts` (new)
- `services/queries/nurse_content.ts`
- `screens/wellness/VideoLibraryScreen.tsx`
- `screens/wellness/ContentDetailScreen.tsx`
- `screens/diary/DiaryPageScreen.tsx`
- `screens/diary/components/PolaroidFrame.tsx`
- `screens/diary/components/DraggableObject.tsx`
