SheCare — Engineering Rules for High Performance, Data Integrity & Privacy
"If we don't create these rules properly, we will face lag, data leaks, and other critical failures."
This document captures the non‑negotiable architectural decisions derived from our past planning sessions. Every developer must follow these rules.

1. Data Fetching & Caching (React Query)
1.1 Always scope query keys by userId
❌ Wrong: ['cycle', 'calendar', 3, 3]

✅ Correct: ['cycle', userId, 'calendar', 3, 3]

Why: Prevents cross‑user data leakage. Structural isolation > runtime deletion.

1.2 Invalidate the all prefix on mutations
When a mutation changes data, invalidate the entire user‑scoped key prefix.

✅ Example: queryClient.invalidateQueries({ queryKey: getCycleKeys(userId).all })

Why: Ensures all dependent queries (calendar, predictions, analytics) refresh together.

1.3 Set staleTime wisely
Static masters (symptoms, medications, breathing exercises): staleTime: 30 * 60 * 1000

User‑generated data (moods, journals, cycles): staleTime: 5 * 60 * 1000

Never use staleTime: Infinity for mutable user data.

1.4 Prefetch only what is visible
Do not pre‑fetch the entire journal history on mount. Use cursor‑based / windowed pagination.

Pre‑warm only: user_preferences, onboarding_completed, draft_metadata, session_analytics_id.

2. Offline‑First & Sync
2.1 Write‑through bridge for cross‑module data
When one module creates data that another module needs (e.g., cycle_days → mood_logs), use the event bus.

The source module emits an event; the target module subscribes and handles the write idempotently.

❌ Never import one module's service directly into another.

2.2 Hard limits on local storage
Store	Limit
companion_memory	1000 rows max, 60‑day TTL
offline_action_queue	500 pending mutations max
cycle_days (local)	Last 90 days only (prune on sync)
2.3 Offline queue – always re‑play in order
Offline writes are queued and re‑played in FIFO order on reconnect.

Each queued mutation carries an idempotency_key to avoid duplicate processing.

Use react-native-encrypted-storage for sensitive queue payloads.

2.4 Session isolation – clear EVERYTHING on logout
On logout, before navigation reset:

Reset all Zustand stores (including isCompleted: false).
Clear all EncryptedStorage keys (not just tokens).
Clear all AsyncStorage keys (onboarding flag, pregnancy mode, etc.).
Purge the SQLite database (deleteDatabaseAsync → fallback DELETE FROM all tables).
Clear React Query cache.
Checklist: See plans/signin_signout_flow_logic.md.

3. UI Performance & Native Responsiveness
3.1 Always use FlatList with performance props
Required props for any list > 20 items:

tsx
<FlatList
  windowSize={10}
  maxToRenderPerBatch={10}
  removeClippedSubviews={true}
  initialNumToRender={7}
  getItemLayout={height ? () => ({ length: height, offset: index * height, index }) : undefined}
/>
3.2 Use FlashList only for truly long lists (>100 items)
Do NOT use FlashList for the Calendar (max 42 items) – ScrollView + removeClippedSubviews is enough.

3.3 Avoid inline functions and objects in render
Define callbacks with useCallback, styles with useMemo or StyleSheet.create.

❌ Wrong: <Button onPress={() => doSomething()} />

✅ Correct: <Button onPress={handlePress} /> (with useCallback)

3.4 Keyboard handling – use a custom hook, not KeyboardAvoidingView
KeyboardAvoidingView on Android is unreliable.

Use useKeyboard hook with Animated.View for bottom padding.

For scroll‑dismiss, use keyboardDismissMode="on-drag" on FlatList (native prop).

3.5 ScreenContainer – mandatory for every tab screen
All tab screens must be wrapped in <ScreenContainer>.

It handles safe area, bottom tab bar padding, and keyboard padding automatically.

4. Animations & Transitions
4.1 Navigation transitions – Fade + Scale, never slide
Use wellnessTransitions (Fade 200ms + Scale 0.96) for all stack pushes/pops.

Tab switches: Cross‑fade 150ms.

Why: Slide feels abrupt; fade+scale feels calm and grounded (brand alignment).

4.2 Use Reanimated for micro‑interactions
Touch feedback: <TouchableFeedback> wrapper with 0.96 scale.

Breathing animations: use useSharedValue + withTiming; clean up on unmount.

Never use the old Animated API for new work.

5. State Management (Zustand)
5.1 persist middleware – strict partialize whitelist
Only persist fields needed for navigation/identity.

✅ Example: partialize: (state) => ({ isCompleted: state.isCompleted, userId: state.userId })

❌ Never persist transient flags (isLoading, error, isHydrated).

5.2 Reset all stores on logout – synchronous before navigation
Call store.reset() for every store before clearing storage.

The reset must clear in‑memory state and remove persisted keys.

5.3 Store hydration – guard with isHydrated
RootNavigator must wait for both authStore.isHydrated and onboardingStore.isHydrated before rendering the decision.

Prevents splash‑to‑Main flash.

6. Backend API & Security
6.1 Row‑level security – never trust user_id from body
Always derive user_id from current_user.id (JWT).

All queries must filter by user_id.

6.2 JSONB columns – cap size to prevent bloat
Column	Cap
mood_trend.samples	30 entries
achievements	100 entries
habit_patterns	100 keys
preferences	50 keys
top_log_types	20 entries
Validate on input → HTTP 422 on oversize.

6.3 Rate limit all public endpoints
Use @rate_limit(limit=..., window=60) from dependencies.py.

Return Retry-After header on 429.

6.4 Event bus – idempotent subscribers
Every event subscriber must be idempotent (guard with business key or processed_events table).

Prevent double‑counting (e.g., duplicate day_logged events).

7. Encryption & Privacy
7.1 Encrypt all user‑generated free‑text (notes, journal.content) at the service layer
Use the existing encryption_service (per‑user salt).

Never store plaintext in the database.

Encryption happens before write; decryption after read.

7.2 Sync – aggregate state only
Cross‑device sync must send only aggregated, non‑identifying data:

✅ XP, level, coins, relationship level, mood summaries, preferences, habit patterns.

❌ Journal content, dialogue history, raw health metrics, raw symptoms.

Privacy boundary enforced at the API contract and service layer.

7.3 react-native-encrypted-storage for sensitive local state
Use for: auth_token, refresh_token, user_id, draft_metadata, offline.queue.

All other local state can use AsyncStorage (no sensitive values).

8. Testing Mandates
8.1 Unit test every utility / pure function
readinessScore, filterRecommendations, moodInsight, shouldShowOnboarding.

Must cover edge cases (empty data, null values, invalid inputs).

8.2 Integration test every event bus flow
day_logged → wellness upsert → cache invalidation → UI refresh.

Offline queue → replay → server state updated.

8.3 E2E tests for critical user flows
Login → Onboarding → Calendar → Log Period → Mood Log → Logout → Sister sign‑up.

Ensure zero data leakage (SQLite wiped, stores reset, caches cleared).

9. Code Architecture – Module Boundaries
9.1 Modules own their tables and services
cycle owns cycle_entries, cycle_days, cycle_predictions.

wellness owns mood_logs, journal_entries.

luna owns luna_state, companion_metadata.

Never write directly to another module's table from a different module.

9.2 Cross‑module communication via event bus only
Cycle module emits day_logged; wellness subscriber writes to mood_logs.

Luna subscriber writes to mood_trend.

This keeps modules decoupled and testable.

9.3 Dependency injection for cross‑module reads
If DialogueEngine needs cycle phase, inject a getCyclePhase accessor – never import the cycle store directly.

This keeps the companion module independent of cycle's internal state.

10. Performance Budgets & Monitoring
Metric	Target
App startup (cold)	< 2s on mid‑range Android
Time‑to‑interactive (JournalEntry)	< 200ms
Scroll framerate	≥ 60fps on Pixel 4a / iPhone SE
AI Chat (50 messages)	CPU < 5%, no memory leaks
SQLite purge on logout	< 200ms
Bundle size (base)	< 50MB
11. Rule Enforcement
Code review checklist – every PR must verify these rules.

CI pipeline – tsc, ESLint (with no‑magic‑numbers rule for spacing), Jest coverage ≥ 80%.

Performance regression tests – run on every release candidate.

These rules are not optional. They are the foundation of SheCare's reliability, speed, and user trust.

