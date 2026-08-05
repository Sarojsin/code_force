# SheCare — Implementation Plan (v1.0)

> **Goal:** Fix critical UX bugs (keyboard, bottom bar, emoji stretch), establish architectural foundations (ScreenContainer, Text, transitions), and deliver measurable performance gains.
>
> **Strategy:** User Emotion order — Trust → Polish → Speed → Consistency → Memory.

---

## 🎯 Architectural Decisions (Locked)

| Area | Decision | Rationale |
|------|----------|-----------|
| **ScreenContainer** | Lean: `useBottomTabBarHeight()` padding + custom `useKeyboard` hook + optional `ScrollView` fallback | Single source of truth for safe area; fixes 9/10 screens at once |
| **Keyboard** | Custom `useKeyboard` hook → `Animated.View` bottom padding | Avoids nested ScrollView conflicts (FlatList inside KeyboardAwareScrollView breaks) |
| **Text Component** | Default `includeFontPadding={false}` + `lineHeight = fontSize * 1.2`; **no legacy variant** | Android's default padding is a bug; one rendering pipeline forever |
| **Pre-warm Storage** | Only: `user_preferences`, `onboarding_completed`, `draft_metadata`, `session_analytics_id` | 50KB JSON max; heavy logs loaded lazily via react-query/SQLite |
| **Transitions** | **Pure Fade + Scale (0.96)**, no slide. Push: 200ms, Pop: 150ms, Tab: 150ms cross-fade, Modal: slide-up | "Wellness" = calm/grounded; slide creates urgency |
| **Touchables** | Universal `<TouchableFeedback>` wrapper (Reanimated 0.96 scale) | Consistent micro-feedback everywhere |

---

## 📦 New Core Components (Build First)

### 1. `src/components/core/ScreenContainer.tsx`
```tsx
interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;          // wraps in ScrollView if true (keyboardDismissMode ignored)
  flatListKeyboardDismissMode?: 'none' | 'on-drag' | 'interactive';  // only applied if children are FlatList
  style?: ViewStyle;
}
```
**Responsibilities:**
- Consumes `useBottomTabBarHeight()` → applies `paddingBottom` to content
- Consumes `useKeyboard()` hook → applies animated `paddingBottom` for keyboard
- Optional: wraps children in `ScrollView` (if `scrollable=true`) OR forwards children directly (if they ARE a FlatList)
- Provides `SafeAreaView` with `edges={['top', 'horizontal']}` (bottom handled by tab bar)
- **keyboardDismissMode** prop: Only forwarded if children are a `FlatList`/`SectionList`. If wrapping in `ScrollView`, this prop is ignored (ScrollView has no native keyboardDismissMode).

### 2. `src/hooks/useKeyboard.ts`
```tsx
interface UseKeyboardResult {
  keyboardHeight: Animated.Value;    // 0 when hidden, height when visible
  isKeyboardVisible: boolean;
  dismiss: () => void;
}
```
**Implementation:**
- `Keyboard.addListener('keyboardWillShow' | 'keyboardWillHide' | 'keyboardWillChangeFrame')`
- Maps `endCoordinates.height` to `Animated.Value` with `withTiming(250, Easing.out(Easing.cubic))`
- Returns `dismiss()` → `Keyboard.dismiss()`
- **Note:** Scroll-based dismissal is handled by `ScreenContainer`'s `keyboardDismissMode` prop (maps to FlatList's native prop), NOT by this hook.

### 3. `src/components/core/Text.tsx` (Modified)
**Changes:**
- Default `includeFontPadding={false}` on underlying `RNText`
- New default `lineHeight = fontSize * 1.2` applied when `lineHeight` not explicitly set in variant
- **Remove** `emoji` variant (now covered by default behavior)
- Add `suppressAndroidPadding?: boolean` prop (defaults to `true`) for rare opt-out
- **Week 1 rollback plan**: If >3 screens break from Text migration, set default to `suppressAndroidPadding={true}` temporarily (restores legacy padding) and create tracking ticket for manual per-screen migration in Week 3.
- **Pre-flight check**: Before shipping Text migration, tap through Onboarding → Calendar → Journal → MoodPicker on Android. If buttons show "text floating high" (vertical alignment shift from `lineHeight` change), add `textAlignVertical: 'center'` to the Android-specific Text style block—usually resolves without needing rollback.

### 4. `src/components/core/TouchableFeedback.tsx`
```tsx
interface TouchableFeedbackProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  activeScale?: number;        // default 0.96
  activeOpacity?: number;      // default 0.8
  disabled?: boolean;
}
```
**Implementation:** Reanimated `useSharedValue` + `withSpring` for scale/opacity on `onPressIn`/`onPressOut`/`onPress`.

### 5. `src/navigation/TransitionPresets.ts`
```tsx
export const wellnessTransitions = {
  push: {
    animation: 'fade' as const,
    transitionSpec: { open: { animation: 'timing', config: { duration: 200, easing: Easing.out(Easing.cubic) } }, close: { ... } },
    cardStyleInterpolator: ({ current: { progress } }) => ({
      cardStyle: { opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] },
    }),
  },
  pop: { ... reverse ... },
  tab: { animation: 'fade', transitionSpec: { open: { duration: 150 }, close: { duration: 150 } } },
  modal: { presentation: 'modal', cardStyleInterpolator: CardStyleInterpolators.forModalPresentationIOS },
};
```

### 6. `src/providers/AppProvider.tsx`
**Pre-warm logic (runs before navigation mounts):**
```tsx
const prewarm = async () => {
  const [prefs, onboarding, draftMeta, analyticsId] = await Promise.all([
    EncryptedStorage.getItem('user_preferences'),
    EncryptedStorage.getItem('onboarding_completed'),
    EncryptedStorage.getItem('draft_metadata'), // { title, timestamp }
    EncryptedStorage.getItem('session_analytics_id'),
  ]);
  useAuthStore.setState({ preferences: prefs });
  useOnboardingStore.setState({ completed: onboarding });
  useJournalStore.setState({ draftMetadata: draftMeta });
  useAnalyticsStore.setState({ sessionId: analyticsId });
};
```

---

## 🗓️ Sprint Breakdown (4 Weeks)

### **Week 1: Trust & Polish** (4 days)

| Day | Task | Files | Acceptance Criteria |
|-----|------|-------|---------------------|
| 1-2 | **AppProvider Pre-warm (NEW ORDER)** | `src/providers/AppProvider.tsx`, `src/stores/*.ts`, `src/app.tsx` (wrap with Provider) | Pre-warm `user_preferences`, `onboarding_completed`, `draft_metadata`, `session_analytics_id` before navigation mounts; Zustand stores populated at startup |
| 3-4 | **ScreenContainer + Keyboard Hook + Text Migration** | `src/components/core/ScreenContainer.tsx`, `src/hooks/useKeyboard.ts`, `src/components/ui/Text.tsx` (default `includeFontPadding={false}`), `src/navigation/MainTabs.tsx` (tab screens auto-inherit), `src/screens/wellness/JournalEntryScreen.tsx` (ScreenContainer + strip mount effects + Text), `src/screens/calendar/CalendarScreen.tsx` (ScreenContainer + Text) | `JournalEntryScreen` and `CalendarScreen` show no bottom bar overlap; keyboard opens smoothly on Android; MoodPicker emojis render round (not stretched); **Rollback plan**: If >3 screens break from Text migration, revert Text defaults and create tracking ticket for manual migration (Sprint 3) |

**Week 1 Test Checkpoints:**
- [ ] `JournalEntryScreen`: "View Past Entries" fully visible above tab bar
- [ ] Android: Keyboard opens/closes without flicker or layout shift
- [ ] iOS: Keyboard behavior unchanged (still smooth)
- [ ] MoodPicker: 6 emojis perfectly round at 28px
- [ ] All existing Text screens migrated to ScreenContainer: no visual regression
- [ ] JournalEntryScreen: renders from Zustand (no mount effects); < 200ms TTI
- [ ] Visual snapshot tests pass on all migrated screens

---

### **Week 2: Speed & Performance** (5 days)

| Day | Task | Files | Acceptance Criteria |
|-----|------|-------|---------------------|
| 1-2 | **AppProvider Pre-warm** | `src/providers/AppProvider.tsx`, `src/stores/*.ts`, `src/app.tsx` (wrap with Provider) | JournalEntryScreen renders instantly (no skeleton → data flash); Splash screen shows pre-warmed data; Zustand stores populated with `user_preferences`, `onboarding_completed`, `draft_metadata`, `session_analytics_id` |
| 3   | **Migrate All Tab Screens to ScreenContainer** | `src/screens/home/HomeDashboardScreen.tsx`, `src/screens/calendar/CalendarScreen.tsx`, `src/screens/analytics/AnalyticsDashboardScreen.tsx`, `src/screens/wellness/WellnessHomeScreen.tsx`, `src/screens/profile/ProfileHomeScreen.tsx`, `src/screens/pregnancy/PregnancyHomeScreen.tsx`, `src/screens/safety/SafetyHomeScreen.tsx`, `src/screens/diary/*` | All 10 main tab screens use `<ScreenContainer>`; zero bottom bar overlap |
| 4-5 | **FlatList Performance (no Calendar)** | `src/screens/video/VideoLibraryScreen.tsx`, `src/screens/diary/DiaryTimelineScreen.tsx`, `src/screens/wellness/JournalListScreen.tsx`, `src/screens/wellness/MoodHistoryScreen.tsx`, `src/screens/chat/ChatRoomScreen.tsx`, `src/screens/ai/AIChatScreen.tsx` | All FlatLists have `windowSize={10}`, `maxToRenderPerBatch={10}`, `removeClippedSubviews={true}`, `initialNumToRender={7`, `getItemLayout` where height fixed; 60fps scroll on low-end device |

**Week 2 Test Checkpoints:**
- [ ] JournalEntryScreen: < 200ms TTI (Time to Interactive)
- [ ] All tab screens: no bottom bar overlap, keyboard works
- [ ] VideoLibrary/DiaryTimeline/JournalList/MoodHistory: 60fps scroll on Pixel 4a / iPhone SE
- [ ] No regressions in react-query cache behavior

---

### **Week 3: Consistency & Polish** (5 days)

| Day | Task | Files | Acceptance Criteria |
|-----|------|-------|---------------------|
| 1   | **Spacing Linter + Token Audit** | `.eslintrc.js` (add `no-magic-numbers` rule for spacing), all screen styles (replace 150+ hardcoded values with `theme.spacing.*`) | ESLint fails on raw numbers in styles; 100% theme token usage |
| 2   | **Global Transitions** | `src/navigation/FeatureStacks.tsx` (apply `wellnessTransitions`), `src/navigation/MainTabs.tsx` (tab cross-fade), `src/navigation/RootNavigator.tsx` | All stack pushes/pops use Fade+Scale; tab switches cross-fade; no slide animations |
| 3   | **TouchableFeedback Wrapper** | `src/components/core/TouchableFeedback.tsx`, replace all plain `Pressable`/`TouchableOpacity` in: `CalendarScreen`, `HomeDashboard`, `VideoLibrary`, `PregnancyCalendar`, `DiaryTimeline`, `ChatRoom`, `EmergencyContacts`, `MoodHistory`, `AnalyticsDashboard` | Every interactive element has 0.96 scale feedback; no plain Pressables remain |
| 4-5 | **Visual Polish** | `src/components/ui/MoodPicker.tsx` (chip sizing: `width: 90px` fixed, not `%`), `src/components/ui/Calendar.tsx` (day cell press feedback), `src/screens/onboarding/*` (symptom chips), `src/screens/wellness/WellnessHomeScreen` (recommendation cards) | MoodPicker chips equal width; calendar day cells have press scale; all onboarding chips consistent |

**Week 3 Test Checkpoints:**
- [ ] ESLint clean (no spacing violations)
- [ ] All transitions feel "wellness-calm" (user test)
- [ ] Every button/tappable has scale feedback
- [ ] Visual regression tests pass

---

### **Week 4: Memory & Edge Cases** (4 days)

| Day | Task | Files | Acceptance Criteria |
|-----|------|-------|---------------------|
| 1-2 | **AI Chat Memory Fix** | `src/screens/ai/AIChatScreen.tsx` (remove per-word `setTimeout`, use `requestAnimationFrame` chunk scheduler), `src/components/ui/StreamText.tsx` (new component with cleanup) | No memory leak after 50 messages; CPU < 5% during streaming; cleanup on unmount |

**Chunk scheduler implementation notes:**
- Use `requestAnimationFrame` (not `setTimeout`) for chunk timing — aligns with screen refresh rate and auto-cancels on unmount
- Chunk size: 5 words per frame (`renderChunkSize = 5`)
- Cleanup: cancel RAF on unmount via `useRef<number>` + `cancelAnimationFrame`
- Do NOT use `InteractionManager` — fires only once, doesn't support progressive streaming
| 3   | **Edge Cases & Cleanup** | `src/components/core/ScreenContainer.tsx` (add `keyboardDismissMode` prop that maps to FlatList's native prop), `src/screens/diary/*` (apply `keyboardDismissMode="on-drag"` on FlatList scroll) | Keyboard dismisses on list scroll via native prop (no hook-based dismissal); no stuck keyboards; no janky bounce effect |
| 4   | **Regression Suite & Release** | Full E2E (Maestro): Login → Onboarding → Calendar → Journal → Chat → Settings → Logout | Zero P0/P1 bugs; all E2E green; performance budgets met |

**Week 4 Test Checkpoints:**
- [ ] AI Chat: 50 messages, no leak, smooth streaming
- [ ] Keyboard dismiss on scroll works in Diary/Calendar/Chat
- [ ] Full E2E passes on iOS + Android
- [ ] Bundle size < 50MB (no regression)

---

## 📁 File Change Index (by Category)

### New Components
```
src/components/core/
  ├── ScreenContainer.tsx          # NEW
  ├── TouchableFeedback.tsx        # NEW
  ├── Text.tsx                     # MODIFIED (default includeFontPadding=false)
  └── index.ts                     # exports

src/hooks/
  ├── useKeyboard.ts               # NEW
  └── index.ts

src/providers/
  ├── AppProvider.tsx              # NEW (pre-warm logic)
  └── index.ts

src/navigation/
  ├── TransitionPresets.ts         # NEW
  ├── FeatureStacks.tsx            # MODIFIED (apply transitions)
  ├── MainTabs.tsx                 # MODIFIED (tab cross-fade)
  └── RootNavigator.tsx            # MODIFIED (ErrorBoundary at root)
```

### Screen Migrations (ScreenContainer + FlatList Perf)
```
src/screens/wellness/
  ├── JournalEntryScreen.tsx       # ScreenContainer, remove mount effects
  ├── JournalListScreen.tsx        # ScreenContainer
  ├── MoodHistoryScreen.tsx        # ScreenContainer + FlatList perf
  ├── WellnessHomeScreen.tsx       # ScreenContainer
  └── MoodPicker.tsx               # Text migration, chip sizing

src/screens/calendar/
  ├── CalendarScreen.tsx           # ScreenContainer + ScrollView perf props
  └── PregnancyCalendarScreen.tsx  # TouchableFeedback

src/screens/home/
  └── HomeDashboardScreen.tsx      # ScreenContainer

src/screens/analytics/
  └── AnalyticsDashboardScreen.tsx # ScreenContainer

src/screens/profile/
  └── ProfileHomeScreen.tsx        # ScreenContainer

src/screens/pregnancy/
  ├── PregnancyHomeScreen.tsx      # ScreenContainer
  └── PregnancyCalendarScreen.tsx  # TouchableFeedback

src/screens/safety/
  └── SafetyHomeScreen.tsx         # ScreenContainer

src/screens/diary/
  ├── DiaryTimelineScreen.tsx      # ScreenContainer + FlatList perf
  ├── DiaryLibraryScreen.tsx       # ScreenContainer
  ├── DiaryPageScreen.tsx
  └── components/                  # TouchableFeedback on all touchables

src/screens/video/
  └── VideoLibraryScreen.tsx       # FlatList perf (grid)

src/screens/ai/
  ├── AIChatScreen.tsx             # Memory fix + StreamText
  └── components/StreamText.tsx    # NEW (chunked render + cleanup)

src/screens/chat/
  ├── ChatRoomScreen.tsx           # TouchableFeedback
  └── AIChatScreen.tsx             # Memory fix

src/screens/emergency/
  └── EmergencyContactsScreen.tsx  # TouchableFeedback

src/screens/onboarding/
  ├── CurrentCycleScreen.tsx       # Text migration
  ├── PastCycleScreen.tsx          # Text migration
  └── CompleteScreen.tsx
```

### Core Infrastructure
```
src/components/ui/
  ├── Text.tsx                     # MODIFIED: default includeFontPadding=false, lineHeight default
  ├── Button.tsx                   # Uses TouchableFeedback internally
  ├── Card.tsx                     # Uses TouchableFeedback internally
  ├── Calendar.tsx                 # day cell press feedback
  ├── MoodPicker.tsx               # Text migration, chip sizing (90px fixed)
  ├── BottomSheet.tsx
  └── Modal.tsx

src/theme/
  └── tokens.ts                    # remove emoji variant, adjust defaults

src/navigation/
  ├── TransitionPresets.ts         # NEW
  ├── FeatureStacks.tsx            # apply wellnessTransitions
  ├── MainTabs.tsx                 # tab cross-fade
  └── RootNavigator.tsx            # ErrorBoundary at root

src/providers/
  └── AppProvider.tsx              # NEW

src/hooks/
  └── useKeyboard.ts               # NEW

.eslintrc.js                       # add no-magic-numbers for spacing
```

---

## ✅ Acceptance Gates (Per Week)

| Week | Gate | Metric |
|------|------|--------|
| 1    | Keyboard + Bottom Bar | 0 overlap screens; Android keyboard 0 flicker |
| 1    | Emoji + Text | MoodPicker emojis round; 0 Text visual regressions |
| 2    | TTI | JournalEntryScreen < 200ms TTI |
| 2    | Scroll | 60fps on Pixel 4a / iPhone SE for all lists |
| 3    | Lint | 0 spacing violations; 0 plain Pressables |
| 3    | Transitions | All stacks use Fade+Scale; tabs cross-fade |
| 4    | Memory | AI Chat: 50 messages, < 5% CPU, 0 leaks |
| 4    | E2E | Full flow (Login → Onboarding → Calendar → Journal → Chat → Settings) passes |

---

## 🚨 Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Text migration breaks unseen screens | Medium | High | **Rollback plan**: If >3 screens break, revert to `suppressAndroidPadding={true}` default; visual snapshot tests before merge; manual per-screen fix in Week 3 |
| ScreenContainer breaks nested scroll | Low | High | Test each screen with `scrollable={true/false}` explicitly; ScreenContainer auto-inherits to tab screens |
| Pre-warm race condition | Low | Medium | `Promise.all` with 500ms timeout; if timeout fires → log warning + render navigation with default Zustand states (no error); Splash screen will not hang |
| Transition jank on low-end | Medium | Medium | Test on Pixel 4a; reduce duration if needed (200→150ms); pure Fade+Scale (no slide) feels lighter |
| Keyboard bounce on scroll | Low | Medium | Use platform-native `keyboardDismissMode` prop on FlatList (not hook-based); ScreenContainer forwards prop |
| AI Chat RAF cleanup | Low | Medium | `useRef<number>` + `cancelAnimationFrame` on unmount; no setTimeout/intervals |

**Notes from pre-mortem review:**
- **Text migration:** No legacy compatibility variant — if it breaks, use rollback prop (`suppressAndroidPadding`) temporarily
- **FlashList for Calendar:** NOT used — Calendar has fixed 35-42 items; ScrollView with perf props is sufficient
- **Week 1 vs Week 2:** AppProvider (Day 1-2) BEFORE stripping JournalEntryScreen mount effects (Day 3-4) — eliminates regression window
- **AI Chat:** Use `requestAnimationFrame` chunk scheduler (not `InteractionManager` or `setTimeout`)
- **Keyboard dismiss:** Platform-native `keyboardDismissMode` prop, not hook-based

---

## 📝 Notes for Implementation Team

1. **Order matters:** Build `ScreenContainer` + `useKeyboard` + `Text` changes **before** migrating screens.
2. **Test on Android first** for keyboard/emoji fixes — iOS behavior is already correct.
3. **No FlashList for Calendar:** CalendarScreen has 35-42 fixed items; keep ScrollView with perf props.
4. **FlashList targets:** VideoLibrary, DiaryTimeline, JournalList, MoodHistory, ChatRoom, AIChat.
5. **TouchableFeedback:** Wrap existing `Button`/`Card` internally first, then replace plain `Pressable` in screens.
6. **Pre-warm timeout:** If storage reads > 500ms, log warning + render navigation with default Zustand states (no error).
7. **Transition config:** Apply at `FeatureStacks.tsx` level — all feature stacks inherit automatically.
8. **RAF cleanup:** AIChat `StreamText` uses `useRef<number>` + `cancelAnimationFrame` on unmount — no setTimeout.

---

## 🔍 Pre-Mortem Review Notes (Locked In)

| # | Observation | Decision |
|---|-------------|----------|
| 1 | Text migration (no legacy variant) risks breaking 15 complex screens with fixed-height parents | ✅ **Accepted** — Rollback plan: `suppressAndroidPadding` opt-out prop if >3 screens break |
| 2 | CalendarScreen (35-42 items) doesn't warrant FlashList | ✅ **Removed** — Keep ScrollView + perf props |
| 3 | Week 1 (strip mount effects) and Week 2 (AppProvider pre-warm) create 2-day regression gap | ✅ **Swapped** — AppProvider (Day 1-2) then strip effects (Day 3-4) |
| 4 | InteractionManager fires once — won't support progressive streaming | ✅ **Changed** — Use `requestAnimationFrame` chunk scheduler with `cancelAnimationFrame` cleanup |
| 5 | Hook-based keyboard dismissal causes jank with FlatList scroll | ✅ **Changed** — Platform-native `keyboardDismissMode` prop forwarded via ScreenContainer |

---

## 📌 Out of Scope (Future)

- Native module for keyboard (react-native-keyboard-controller)
- Hermes bytecode precompilation
- React 19 / RN 0.76 migration
- Offline-first sync architecture

---

*Plan v1.0 — Ready for team review and sprint planning.*