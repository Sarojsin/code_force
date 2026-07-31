 You are a senior React Native + Expo SDK + React Navigation + SQLite + FastAPI engineer.

I have a React Native (Expo) application that has multiple runtime issues during development. Your task is to fully investigate the project, identify the root causes (not just symptoms), explain why each issue occurs, and fix them following React Native and Expo best practices.

## Current Issues

1. Keyboard appears and immediately disappears while typing.
2. App feels laggy and slow when running with `npx expo run:android` on a physical device.
3. Frequent unnecessary re-renders.
4. Navigation errors.
5. SQLite errors.
6. Slow screen transitions.
7. Some screens freeze for a moment when opening.
8. Performance is poor even on a real device connected via USB.

---

## I want a COMPLETE investigation.

Do NOT guess.

Trace the execution flow and explain exactly why each issue happens.

For every issue provide:

- Root cause
- Files involved
- Code responsible
- Why it happens
- Correct fix
- Better architecture if necessary

---

# Files to inspect

## Navigation

Check every navigation file including:

- App.tsx
- index.tsx
- RootNavigator.tsx
- AuthNavigator.tsx
- MainNavigator.tsx
- BottomTabNavigator.tsx
- WellnessNavigator.tsx
- Any nested navigators
- navigation types
...and others also
Verify:

- Missing screens
- Wrong route names
- Nested navigation
- Duplicate NavigationContainer
- Screen mounting
- Lazy loading
- Navigation loops
...and others also
---

## Keyboard

Inspect every screen containing TextInput.

Examples:

- LoginScreen
- RegisterScreen
- Journal screens
- Diary screens
- Profile screens
...and others also
Check for:

- autoFocus
- KeyboardAvoidingView
- ScrollView
- FlatList
- Modal
- BottomSheet
- keyboardShouldPersistTaps
- windowSoftInputMode
- TextInput keys
- Parent component remounting
- Lost focus
- State resets
- Form reset
- Controlled vs uncontrolled inputs
...and others also
Find exactly why the keyboard dismisses.

---

## Performance

Inspect:

- Heavy useEffect
- useFocusEffect
- useLayoutEffect
- Infinite loops
- Large renders
- Expensive calculations
- Missing memoization
- Missing useCallback
- Missing useMemo
- Inline functions
- Inline objects
- Context updates
- Zustand/Redux updates
- React Query updates
- Re-render chains
...and others also
Explain every unnecessary render.

---

## React Components

Check:

- React.memo usage
- Component tree
- Parent-child renders
- State lifting
- Prop drilling
- Duplicate state
- Conditional rendering
- Dynamic keys
- Random keys
- Date.now()
- Math.random()
...and others also
---

## SQLite

Inspect:

- Database initialization
- Migration files
- Schema creation
- CREATE TABLE
- ALTER TABLE
- BaseLocalService
- DiaryPageLocalService
- AssetLocalService
- prepareSync()
- Transactions
- Queries
...and others also
Investigate errors like:

ERR_INTERNAL_SQLITE_ERROR

no such table

no such column

prepareSync rejected

Find the exact failing SQL statement.

---

## Offline Sync

Inspect:

- SyncEngine
- Sync Queue
- Repository layer
- Local database
- Push operations
- Pull operations
...and others also
Check:

- Duplicate sync
- Infinite retries
- Blocking UI
- Database locks
...and others also
---

## API

Inspect:

- Axios
- API client
- Interceptors
- Retry logic
- Timeouts
- Authentication
- Token refresh
...and others also
Make sure API calls do not block UI rendering.

---

## Expo

Inspect:

- app.json
- app.config.ts
- expo plugins
- package.json
- expo doctor
- SDK compatibility
...and others also
Check:

- Version mismatches
- Native module compatibility
- Hermes compatibility
- expo-av
- expo-sqlite
- onnxruntime
- react-native versions
...and others also
---

## Android

Inspect:

AndroidManifest.xml

Check:

windowSoftInputMode

Permissions

Network security

Activity configuration
...and others also
---

## Build

Inspect:

Gradle

Native dependencies

Expo prebuild

Hermes

JSI

TurboModules

---

## Logs

Search for:

Warnings

Console errors

Unhandled promises

Memory leaks

Duplicate listeners

Event subscriptions

---

## Code Quality

Find:

Dead code

Duplicate logic

Race conditions

Memory leaks

Missing cleanup

Improper async usage

Blocking synchronous code

---

## Deliverables

For every issue provide:

1. Root cause
2. Exact file
3. Exact function
4. Exact line(s)
5. Why it happens
6. Recommended fix
7. Replacement code
8. Performance impact
9. Best practice

Finally provide:

- Critical issues
- High priority issues
- Medium priority issues
- Low priority issues

Then generate a prioritized action plan from highest impact to lowest impact so the application becomes stable, smooth, and production-ready.