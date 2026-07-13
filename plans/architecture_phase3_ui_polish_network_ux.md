# Architecture Phase 3: UI Polish & Network-Aware UX

**Priority:** Medium (1.5 days)
**Dependencies:** Phase 1 (offline queue wired, React Query persisted)
**Files touched:** 4 (1 component, 1 hook, 2 screen patterns)

---

## 1. Objective

Fix the misleading ConnectivityBanner message, implement stale-while-revalidate loading states, and add network-aware error boundaries so the user always sees a clear, honest picture of what's happening — whether online, offline, or syncing.

Three sub-tasks:

| Sub-task | Effort | Success Metric |
|----------|--------|----------------|
| 3a. Fix ConnectivityBanner to show real queue count | 1 hour | Banner reads "2 changes will sync" not "changes saved locally" |
| 3b. Implement stale-while-revalidate loading patterns | 1.5 hours | Offline: data from cache instantly. Online: background refresh. |
| 3c. Add network-aware error boundaries | 30 min | "Couldn't load" shown only if no cache AND offline |

---

## 2. Current State (Before)

### 2.1 ConnectivityBanner: Misleading Message

```typescript
// Current: says "changes saved locally" even when they are NOT
<Text>"You're offline — changes saved locally"</Text>
```

This is actively harmful: users may close the app thinking their mood/journals/period entries were saved when they were not — before Phase 1. After Phase 1 they ARE saved via the offline queue, but the banner still doesn't reflect queue state.

### 2.2 Loading States: Infinite Spinner Offline

Current pattern on many screens:
```typescript
if (isLoading) return <Skeleton />;
```

When offline and cache is empty (first launch), this shows a permanent skeleton — the user never sees an error state. After Phase 1b, most data will load from persisted cache instantly, but edge cases remain (first-ever launch offline).

### 2.3 No Offline Error State

If a query fails and there's no cached data, the user sees either:
- A permanent loading spinner
- A crash or blank screen
- No actionable guidance

---

## 3. Phase 3a: Fix ConnectivityBanner

### 3.1 Implementation

**File:** `src/components/ui/ConnectivityBanner.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from 'src/theme';
import { useNetworkStatus } from 'src/services/sync';
import { useOfflineStore } from 'src/stores/offlineStore';

export function ConnectivityBanner() {
  const { isConnected } = useNetworkStatus();
  const pendingCount = useOfflineStore((s) => s.operations.length);
  const theme = useTheme();

  if (isConnected) return null;

  const message = pendingCount > 0
    ? `You're offline — ${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} will sync when connected`
    : "You're offline — your data will sync when you reconnect";

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={[styles.banner, { backgroundColor: theme.colors.warning }]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Text style={[styles.text, { color: theme.colors.textInverse }]}>
        {message}
      </Text>
    </Animated.View>
  );
}
```

### 3.2 Behavior Matrix

| State | Banner Text |
|-------|-------------|
| Online | Hidden |
| Offline, 0 pending operations | "You're offline — your data will sync when you reconnect" |
| Offline, 1 pending operation | "You're offline — 1 change will sync when connected" |
| Offline, 5 pending operations | "You're offline — 5 changes will sync when connected" |

### 3.3 Smooth Transition on Reconnect

When the app transitions from offline → online, the ConnectivityBanner should not disappear instantly. A 500ms fade-out prevents a jarring "Offline → Syncing bar → Data" flicker:

```typescript
import React, { useEffect, useRef, useState } from 'react';

export function ConnectivityBanner() {
  const { isConnected } = useNetworkStatus();
  const pendingCount = useOfflineStore((s) => s.operations.length);
  const theme = useTheme();
  const [shouldHide, setShouldHide] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (isConnected) {
      const timer = setTimeout(() => setShouldHide(true), 500);
      wasOffline.current = true;
      return () => clearTimeout(timer);
    } else {
      setShouldHide(false);
      wasOffline.current = false;
    }
  }, [isConnected]);

  if (shouldHide) return null;

  // ... rest remains the same ...
}
```

### 3.4 Performance Note

`useOfflineStore` with selector `(s) => s.operations.length` uses Zustand's built-in shallow comparison — it only re-renders the banner when the `operations` array length changes, not on every keystroke or unrelated store update.

---

## 4. Phase 3b: Stale-While-Revalidate Loading Patterns

### 4.1 Standardized Loading State Pattern

Every screen that fetches data should use this exact pattern:

```typescript
function MyScreen() {
  const { isConnected } = useNetworkStatus();
  const { data, isLoading, isFetching, error, isStale, refetch } = useQuery({
    queryKey: myKeys.list,
    queryFn: fetchData,
    staleTime: 5 * 60 * 1000,    // 5 min — per data type
    networkMode: 'offlineFirst',  // Try cache before network
  });

  // 1. FIRST LOAD (no cache, no network): show error
  if (isLoading && !data && error) {
    return <ErrorState message="Couldn't load. Check your connection." onRetry={refetch} />;
  }

  // 2. FIRST LOAD (no cache, fetching): show skeleton
  if (isLoading && !data) {
    return <Skeleton />;
  }

  // 3. DATA AVAILABLE: show content + background refresh indicator
  return (
    <View>
      {/* Background refresh indicator */}
      {isFetching && !isLoading && (
        <View style={styles.syncingBar}>
          <ActivityIndicator size="small" />
          <Text>Syncing...</Text>
        </View>
      )}

      {/* Main content with pull-to-refresh (wired, not just text) */}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            enabled={isConnected}   // Disabled when offline to avoid frustrating the user
          />
        }
      >
        <Content data={data} />
      </ScrollView>

      {/* Stale indicator — ONLY show when online, never offline */}
      {isStale && !isFetching && isConnected && (
        <View style={styles.staleBar}>
          <Text>Data may be stale. Pull to refresh.</Text>
        </View>
      )}
    </View>
  );
}
```

#### 🔴 Critical: Never Show Impossible CTAs

The stale indicator must be gated on `isConnected`. Showing "Pull to refresh" while offline is a broken call-to-action:

```
❌ WRONG (current plan):
  {isStale && !isFetching && <Text>Pull to refresh</Text>}
  → User is offline → pulls to refresh → nothing happens → frustration

✅ CORRECT:
  {isStale && !isFetching && isConnected && <Text>Pull to refresh</Text>}
  → User is offline → no stale bar shown (they already see ConnectivityBanner)
  → User is online → stale bar visible → pull to refresh works
```

### 4.2 Reusable Hook: `useNetworkAwareQuery`

To avoid repeating this pattern on every screen, create a wrapper:

**File:** `src/services/queries/useNetworkAwareQuery.ts`

```typescript
import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useNetworkStatus } from 'src/services/sync';

interface NetworkAwareResult<T> {
  data: T | undefined;
  isLoading: boolean;     // True only on first load with no cache
  isFetching: boolean;    // True during any fetch (including background)
  isStale: boolean;       // Data is stale and no background fetch running
  error: Error | null;
  refetch: () => void;
  /** True when we have something to show (cache or fresh) */
  hasContent: boolean;
  /** True when offline AND the error is network-related (not server 500) */
  isOffline: boolean;
  /** True when there's an error but we ARE online (e.g. server 500) */
  isServerError: boolean;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError && !error.response) return true;
  if (error instanceof TypeError && error.message === 'Network request failed') return true;
  return false;
}

export function useNetworkAwareQuery<T>(
  options: UseQueryOptions<T, Error, T, QueryKey>,
): NetworkAwareResult<T> {
  const { isConnected } = useNetworkStatus();
  const query = useQuery({
    networkMode: 'offlineFirst',
    ...options,
  });

  const isNetworkErrorResult = query.error ? isNetworkError(query.error) : false;

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isStale: query.isStale,
    error: query.error as Error | null,
    refetch: () => query.refetch(),
    hasContent: !!query.data,
    isOffline: !isConnected && isNetworkErrorResult,
    isServerError: !!query.error && !isNetworkErrorResult,
  };
}
```

#### 🔴 Critical: Hook Must Compute `isOffline` Automatically

The screen should never have to call `useNetworkStatus()` separately to determine if it's offline:

```typescript
// ❌ WRONG — repetitive, error-prone, easy to forget
const { data, isLoading, error } = useNetworkAwareQuery(...);
const { isConnected } = useNetworkStatus();
<ErrorState isOffline={!isConnected} ... />

// ✅ CORRECT — hook handles classification automatically
const { data, isLoading, isOffline, error, refetch } = useNetworkAwareQuery(...);
if (error && !data) {
  <ErrorState isOffline={isOffline} ... />
}
```

### 4.3 Shared Error & Empty State Components

**File:** `src/components/ui/ErrorState.tsx`

```typescript
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  isOffline?: boolean;
}

export function ErrorState({ message, onRetry, isOffline }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Icon name={isOffline ? 'cloud-off-outline' : 'alert-circle-outline'} size={48} />
      <Text variant="h3" align="center">{isOffline ? "You're offline" : 'Something went wrong'}</Text>
      <Text variant="body" color="secondary" align="center">{message}</Text>
      {onRetry && <Button label="Try Again" onPress={onRetry} variant="outline" />}
    </View>
  );
}
```

Usage — called from any screen using `useNetworkAwareQuery`:

```typescript
const { data, isLoading, isOffline, error, hasContent, refetch } = useNetworkAwareQuery(...);

if (!hasContent && isLoading) return <Skeleton />;
if (error && !hasContent) {
  return (
    <ErrorState
      isOffline={isOffline}
      message={isOffline
        ? "You're offline. Data will appear when you reconnect."
        : 'Something went wrong. Try again.'}
      onRetry={refetch}
    />
  );
}
```

Note: The `ErrorState` does NOT need to call `useNetworkStatus()` — the classification is already done by `useNetworkAwareQuery`.

**File:** `src/components/ui/EmptyState.tsx`

```typescript
interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text variant="h3" align="center">{title}</Text>
      {subtitle && <Text variant="body" color="secondary" align="center">{subtitle}</Text>}
      {action && <Button label={action.label} onPress={action.onPress} variant="outline" />}
    </View>
  );
}
```

### 4.4 Screens to Update (Priority Order)

Apply the `useNetworkAwareQuery` pattern to these screens (most impactful first):

| Priority | Screen | Current Behavior | After |
|----------|--------|-----------------|-------|
| 1 | `CycleDashboardScreen` | Permanent Skeleton if offline + no cache | Shows ErrorState with retry |
| 2 | `CyclePredictionsScreen` | Permanent Skeleton | ErrorState with retry |
| 3 | `JournalListScreen` | Blank if fetch fails | ErrorState + cached data |
| 4 | `MoodHistoryScreen` | Blank if fetch fails | ErrorState + cached data |
| 5 | `BreathingListScreen` | Skeleton forever | ErrorState |
| 6 | `InsightsScreen` | Skeleton forever | ErrorState |
| 7 | `SOSActiveScreen` | "Loading..." forever | ErrorState + SMS fallback prompt |
| 8 | `EmergencyContactsScreen` | Blank if fails | ErrorState + retry |

---

## 5. Phase 3c: Network-Aware Error Boundaries

### 5.1 Global Error Boundary

**File:** `src/components/ui/ErrorBoundary.tsx`

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { Text, Button } from './';
import { useNetworkStatus } from 'src/services/sync';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultFallback error={this.state.error} onReset={() => this.setState({ hasError: false, error: null })} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { isConnected } = useNetworkStatus();

  const message = !isConnected
    ? 'You appear to be offline. Some features may not work.'
    : 'Something went wrong. Please try again.';

  return (
    <View style={styles.container}>
      <Text variant="h2">Unexpected Error</Text>
      <Text variant="body" color="secondary" align="center">{message}</Text>
      <Button label="Try Again" onPress={onReset} variant="primary" />
    </View>
  );
}
```

### 5.2 Placement in App Tree

**🔥 Critical: ErrorBoundary MUST wrap the navigator, NOT the entire provider tree.**

```typescript
// ✅ CORRECT — ErrorBoundary wraps only the navigator
// src/app/App.tsx
<AppProviders>
  <ConnectivityBanner />
  <ErrorBoundary fallback={<GlobalErrorFallback />}>
    <RootNavigator />
  </ErrorBoundary>
  <Toast />
</AppProviders>
```

```typescript
// ❌ WRONG — ErrorBoundary wraps AppProviders (resets ALL state on error)
<ErrorBoundary>
  <AppProviders>     ← If this remounts, React Query cache + Zustand stores re-hydrate
    <RootNavigator />
  </AppProviders>
</ErrorBoundary>
```

**Why this matters:**

When the ErrorBoundary catches a crash and the user taps "Try Again", it unmounts and remounts its children. If it wraps `AppProviders`, the entire provider tree remounts — forcing:
- React Query cache re-hydration (200-500ms of AsyncStorage reads)
- Zustand store re-hydration (another 200ms)
- Auth token re-validation (network call)
- A visible flash/glitch

By wrapping only `RootNavigator`, the stores remain intact. The user taps "Try Again", the navigator remounts, and data is immediately available from cache — no flicker, no re-hydration delay.

---

## 6. Testing Validation

### 6.1 Phase 3a: ConnectivityBanner

| # | Test | Expected |
|---|------|----------|
| 1 | Go offline with 0 pending ops | Banner: "Your data will sync when you reconnect" |
| 2 | Write journal entry offline | Banner updates: "1 change will sync" |
| 3 | Write 3 more entries offline | Banner: "4 changes will sync" |
| 4 | Come online, queue drains | Banner disappears |
| 5 | Go offline again (0 pending) | Generic message again |

### 6.2 Phase 3b: Loading States

| # | Test | Expected |
|---|------|----------|
| 1 | First launch (online) | Skeleton → data appears |
| 2 | First launch (offline, no cache) | ErrorState: "You're offline. Data will appear when you reconnect." |
| 3 | Second launch (offline, with cache) | Data loads instantly from cache |
| 4 | Online with cached data | Data shows immediately, background refresh updates it |
| 5 | Pull to refresh while offline | `RefreshControl` disabled — pull does nothing, no frustration |
| 6 | Stale data while online | "Data may be stale. Pull to refresh." bar visible |
| 7 | Stale data while offline | No stale bar (already see ConnectivityBanner). No broken CTA. |
| 8 | Server 500 error while online | ErrorState: "Something went wrong" + Retry button |
| 9 | Network error while offline | ErrorState: isOffline=true. "You're offline." message. |

### 6.3 Phase 3c: ErrorBoundary

| # | Test | Expected |
|---|------|----------|
| 1 | Render error in any screen | ErrorBoundary catches it, shows fallback with retry |
| 2 | Tap "Try Again" | Navigator remounts. Auth, stores, cache are preserved. No flash. |
| 3 | Offline + error boundary | Message: "You appear to be offline. Some features may not work." |
| 4 | Online + error boundary | Message: "Something went wrong" + Sentry report |
| 5 | Crash recovery while queue has pending ops | Offline queue items survive the error. They sync on reconnect. |

---

## 7. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| ConnectivityBanner re-renders on every store change | Use Zustand selector `(s) => s.operations.length` — shallow comparison |
| Multiple screens re-fetching on online transition | React Query's `networkMode: 'offlineFirst'` prevents redundant fetches |
| ErrorBoundary catches too broadly | Wrap only `RootNavigator`, NOT `AppProviders` — preserves state on recovery |
| Skeleton flash on cached data | `isLoading` is false when cache has data — skeleton never shows |
| Stale indicator shown offline | **Fixed:** gated on `isConnected` — never shown when offline |
| ErrorState `isOffline` forgotten by developer | **Fixed:** `useNetworkAwareQuery` computes it automatically from network + error type |
| Pull to Refresh disabled offline | `RefreshControl` `enabled={isConnected}` — pull is inert when offline |
| ConnectivityBanner flash on reconnect | 500ms fade-out delay prevents "Offline → Syncing → Data" flicker |

---

## 8. Deploy Gate

```bash
cd mobile
npx tsc --noEmit
npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
npx eslint src/components/ui/ConnectivityBanner.tsx src/components/ui/ErrorBoundary.tsx
```
