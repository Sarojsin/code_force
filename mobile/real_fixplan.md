# Real Fix Plan — Issues Found & Solutions

## Issue 1: "+ New Entry" Button Hidden by Tab Bar

**File**: `mobile/src/screens/wellness/JournalListScreen.tsx`

**Root Cause**: The FAB (`.fab` with `padding: 16`) sits at the bottom of `SafeAreaView`, but the bottom tab bar is absolutely positioned (`position: absolute`, `height: 60`, `bottom: 12`, `elevation: 8`) and floats on top of content. The `FlatList` lacks `flex: 1`, so it doesn't fill available space predictably.

**Fix**:
- Add `edges={['top']}` to `SafeAreaView` so bottom safe area is managed by us
- Add `flex: 1` to the `FlatList` via `style`
- Use `useBottomTabBarHeight()` to get exact tab bar height and apply as `paddingBottom` on the FAB container

---

## Issue 2: "Good Morning" Hardcoded — Should Be Time-Aware

**File**: `mobile/src/screens/home/HomeDashboardScreen.tsx` (line 154)

**Root Cause**: String `"Good morning"` is unconditionally hardcoded. No `Date().getHours()` check exists.

**Fix**: Create a utility function `getTimeGreeting()`:
- 05:00–11:59 → `"Good morning"`
- 12:00–16:59 → `"Good afternoon"`
- 17:00–04:59 → `"Good evening"`

Replace hardcoded string with function call.

---

## Issue 3: Next Period Card Shows "--" Instead of Prediction

**Files**: `backend/app/modules/cycle/services.py` (primary), `mobile/src/screens/home/HomeDashboardScreen.tsx` (secondary)

**Root Cause**: `get_calendar()` queries `PredictedCycle` table. When no prediction exists (new user with no logged periods), `next_period_in_days` is `null` → frontend shows `"--"`. The `compute_initial_prediction()` method exists at services.py:450 but is never called by `get_calendar()`.

**Fix (Backend)**:
- In `get_calendar()`, if no predictions found, call `compute_initial_prediction()` to auto-create a default prediction (28-day cycle from today).
- This gives every new user a prediction immediately.

**Fix (Frontend)**:
- If `next_period_in_days` is still null (edge case), show a friendly CTA: "Log your period to see predictions" with a button navigating to cycle logging.

---

## Issue 4: Analytics Screen Shows Random Mock Data

**File**: `mobile/src/screens/analytics/AnalyticsDashboardScreen.tsx`

**Root Cause**: 100% mock data (`MOCK_STATS`, `MOCK_CYCLE_DATA`, `MOCK_SYMPTOMS`). The real API (`cycleService.getAnalytics()`) and TanStack Query hook (`useCycleAnalytics()`) exist but are never called by this screen.

**Fix**:
1. Replace all `MOCK_*` constants with TanStack Query hook `useCycleAnalytics()` + `useCycleEntries()` calls
2. Connect real data to each visual component:
   - **Avg cycle length** → `analytics.average_cycle_length_days`
   - **Symptoms** → `analytics.common_symptoms` (convert count to percentage)
   - **Moods** → `analytics.common_moods`
   - **Line chart** → compute cycle lengths from entries chronologically
   - **Prediction accuracy** → fetch from predictions endpoint confidence score
   - **Sleep/stress** → hide until data source is available (or keep as placeholder with `--`)
3. Remove fake loading timer (`setTimeout(() => setLoading(false), 800)`) — use query's `isLoading` instead
4. Remove unused filter chips (no backend filtering logic exists)
