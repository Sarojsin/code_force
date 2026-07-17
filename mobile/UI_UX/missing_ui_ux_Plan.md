# Missing UI/UX Implementation Plan

> Based on comparison of `mobile/UI_UX/*.md` design files vs actual code in `mobile/src/`.
> Each item maps a spec requirement → current gap → fix.

---

## Phase 1: Theme & Design Tokens

### 1.1 Fix Phase Colors (Calendar, MenstrualPhases, PredictionDetailCard)
- **Spec**: Pastel palette — Menstrual `#FF6B8A`, Follicular `#FFDAB9`, Ovulation `#D4F0E0`, Luteal `#E8D5F5`
- **Current**: Bright Material colors `#FF5252`, `#FFD54F`, `#4CAF50`, `#42A5F5`
- **Files**: `theme/tokens.ts`, `CalendarScreen.tsx`, `MenstrualPhasesScreen.tsx`, `PredictionDetailCard.tsx`, `DashboardScreen.tsx`
- **Fix**: Update palette phase tokens + all inline phase color references

### 1.2 Fix Accent Color
- **Spec**: Mauve `#D4A5B5`
- **Current**: Purple `#9B7BFF`
- **Files**: `theme/tokens.ts`
- **Fix**: Update `accent500`

### 1.3 Add Font Family Config
- **Spec**: Playfair Display (headings), Inter (body), EB Garamond (decorative)
- **Current**: No `fontFamily` in typography tokens
- **Files**: `theme/tokens.ts`, `ThemeProvider.tsx`
- **Fix**: Add fontFamily to typography tokens, configure in metro.config.js

### 1.4 Add Gradient Tokens
- **Spec**: 4 named gradients (Aurora, Primary Action, SOS, Wellness Pulse)
- **Current**: Gradients inlined as SVG where used
- **Files**: `theme/tokens.ts` or new `theme/gradients.ts`
- **Fix**: Create gradient presets as SVG `<LinearGradient>` defs

### 1.5 Add Missing Shadow Tokens
- **Spec**: `shadow.soft`, `shadow.primary`, `shadow.secondary`, `shadow.sos`, `shadow.wellness`
- **Current**: Only `sm`, `md`, `lg`
- **Files**: `theme/tokens.ts`
- **Fix**: Add 5 semantic shadow presets

### 1.6 Add Missing Typography Tokens
- **Spec**: `display.logo` (28px), `display.countdown` (48px), `tab` (11px)
- **Current**: Missing these variants
- **Files**: `theme/tokens.ts`
- **Fix**: Add missing typography variants

---

## Phase 2: Missing Screens/Features

### 2.1 Analytics — Empty State
- **Spec**: "Patience is beautiful" illustration, "Log at least 3 cycles" CTA
- **Current**: No empty state
- **Files**: `screens/analytics/AnalyticsDashboardScreen.tsx`
- **Fix**: Add EmptyState component when no data

### 2.2 Analytics — Filter Dropdown
- **Spec**: Filter button in header (3mo, 6mo, 1yr, All)
- **Current**: No filter
- **Files**: `screens/analytics/AnalyticsDashboardScreen.tsx`
- **Fix**: Add filter button + bottom sheet

### 2.3 Predictions — History Table
- **Spec**: Month / Predicted / Actual comparison table, color-coded rows
- **Current**: Missing
- **Files**: `screens/cycle/CyclePredictionsScreen.tsx`
- **Fix**: Add prediction accuracy table

### 2.4 Predictions — Empty State
- **Spec**: Calendar book illustration, "Your cycle story begins here", CTA button
- **Current**: Plain text message
- **Files**: `screens/cycle/CyclePredictionsScreen.tsx`
- **Fix**: Add illustrated empty state with CTA

### 2.5 Video Library — Continue Watching Banner
- **Spec**: Warm Cream panel, progress bar, swipe to dismiss
- **Current**: Missing
- **Files**: `screens/home/VideoLibraryScreen.tsx`
- **Fix**: Add continue watching section with progress

### 2.6 Video Library — Offline State
- **Spec**: Previously watched active; online-only grayed with lock icon
- **Current**: Missing
- **Files**: `screens/home/VideoLibraryScreen.tsx`
- **Fix**: Add offline state handling

### 2.7 Mood Analysis — Trend Graph + AI Insight
- **Spec**: SVG line chart, weekly summary card, AI emotional insight card
- **Current**: Missing from MoodLogScreen
- **Files**: `screens/wellness/MoodLogScreen.tsx`
- **Fix**: Add trend section below the fold

### 2.8 Home Dashboard — Analytics Sparkline Card
- **Spec**: Mini sparkline chart in Analytics card
- **Current**: Analytics card replaced by Wellness Hub
- **Files**: `screens/home/HomeDashboardScreen.tsx`
- **Fix**: Add mini sparkline to card or restore Analytics card

### 2.9 Settings — Profile Summary Card
- **Spec**: Avatar (64px), name, email at top of Settings
- **Current**: Missing
- **Files**: `screens/profile/SettingsScreen.tsx`
- **Fix**: Add profile summary card at top

### 2.10 Settings — Logout Button
- **Spec**: Ghost outline button at bottom, confirmation modal
- **Current**: Missing
- **Files**: `screens/profile/SettingsScreen.tsx`
- **Fix**: Add logout button with confirmation

---

## Phase 3: Animation & Interaction Fixes

### 3.1 Calendar — Bottom Sheet with Drag + Snap Points
- **Spec**: Draggable with 3 snap points (30%, 65%, 90%), drag handle
- **Current**: Custom animated view, no drag gestures
- **Files**: `screens/calendar/CalendarScreen.tsx`
- **Fix**: Replace with gesture-driven `BottomSheet` component

### 3.2 Calendar — Staggered Loading Skeleton
- **Spec**: 28 shimmering circles
- **Current**: No calendar loading skeleton
- **Files**: `screens/calendar/CalendarScreen.tsx`
- **Fix**: Add shimmer skeleton matching day cells

### 3.3 Mood Analysis — Neumorphic Shadows
- **Spec**: Inset shadow on mood buttons (pressed state), raised shadow (idle)
- **Current**: Standard border + background
- **Files**: `screens/wellness/MoodLogScreen.tsx`
- **Fix**: Add neumorphic shadow styles

### 3.4 Mood Analysis — Haptic Feedback
- **Spec**: Light vibration on emoji selection
- **Current**: Missing
- **Files**: `screens/wellness/MoodLogScreen.tsx`
- **Fix**: Add `expo-haptics` impact on mood selection

### 3.5 Menstrual Phases — Parallax Effect
- **Spec**: Background 30% slower than text on swipe
- **Current**: No parallax
- **Files**: `screens/cycle/MenstrualPhasesScreen.tsx`
- **Fix**: Add parallax Animated scroll handler

### 3.6 AI Chat — Streaming Text Animation
- **Spec**: Incremental words slide in (+2px Y) while typing
- **Current**: Responses appear all at once after 1500ms
- **Files**: `screens/chat/AIChatScreen.tsx`
- **Fix**: Implement word-by-word reveal animation

### 3.7 AI Chat — Voice Recording Animation
- **Spec**: Pulsating red ring on mic button while recording
- **Current**: Static icon
- **Files**: `screens/chat/AIChatScreen.tsx`
- **Fix**: Add recording state with pulse animation

### 3.8 Tab Bar — Glassmorphic Floating
- **Spec**: Glassmorphism with backdrop blur, floating above content
- **Current**: Solid bar with top border
- **Files**: `navigation/MainTabs.tsx`
- **Fix**: Apply glassmorphism style to tab bar

### 3.9 Header Bell — Rotation Animation
- **Spec**: 15-degree rotation shake on notification bell press
- **Current**: No animation
- **Files**: `screens/home/HomeDashboardScreen.tsx`
- **Fix**: Add rotation shake spring animation

---

## Phase 4: Error & Loading States

### 4.1 Home Dashboard — Error State with Retry
- **Spec**: "Could not reload dashboard" alert + retry button
- **Current**: `console.warn` only
- **Files**: `screens/home/HomeDashboardScreen.tsx`
- **Fix**: Add error state UI with retry CTA

### 4.2 Calendar — Error State
- **Spec**: Offline data shown with stale-while-revalidate, toast on error
- **Current**: Silently fails
- **Files**: `screens/calendar/CalendarScreen.tsx`
- **Fix**: Add error toast + offline data display

### 4.3 Analytics — Loading State
- **Spec**: Staggered shimmer placeholders
- **Current**: No loading state
- **Files**: `screens/analytics/AnalyticsDashboardScreen.tsx`
- **Fix**: Add skeleton shimmer per card

### 4.4 AI Chat — Error + Offline States
- **Spec**: Error bubble with retry; Offline banner + queued message
- **Current**: No error/offline handling
- **Files**: `screens/chat/AIChatScreen.tsx`
- **Fix**: Add error bubble component + offline banner

### 4.5 Prediction Screen — Error State
- **Spec**: Local data shown with "Tap to refresh" warning bar
- **Current**: Not implemented
- **Files**: `screens/cycle/CyclePredictionsScreen.tsx`
- **Fix**: Add error state with cached data fallback

---

## Phase 5: Remaining Small Fixes

### 5.1 Home Dashboard — Greeting with User Name
- **Spec**: "Good morning, [Name]" with user's name
- **Current**: "Good morning" without name
- **Files**: `screens/home/HomeDashboardScreen.tsx`
- **Fix**: Read user name from auth store

### 5.2 Home Dashboard — Next Period Gradient Card
- **Spec**: Primary gradient card (not solid color)
- **Current**: Solid `theme.colors.primary` background
- **Files**: `screens/home/HomeDashboardScreen.tsx`
- **Fix**: Apply gradient background to Next Period card

### 5.3 Calendar — Phase Legend Colors
- **Spec**: Pastel phase colors in legend
- **Current**: Bright Material colors
- **Files**: `screens/calendar/CalendarScreen.tsx`
- **Fix**: Update `PHASE_COLORS` to match spec palette

### 5.4 Settings — Confirmation on Delete Account
- **Spec**: Password re-auth + "This action cannot be undone" modal
- **Current**: `onPress={() => {}}` empty handler
- **Files**: `screens/profile/SettingsScreen.tsx`
- **Fix**: Add confirmation modal with text input

### 5.5 Settings — Icons on Rows
- **Spec**: Outlined stroke Mauve icons on each setting row
- **Current**: No row icons
- **Files**: `screens/profile/SettingsScreen.tsx`
- **Fix**: Add Mauve outline icons per row

### 5.6 Setting Dividers Color
- **Spec**: Mauve `#D4A5B5` at 0.25 opacity
- **Current**: Gray at 100% opacity
- **Files**: `screens/profile/SettingsScreen.tsx`
- **Fix**: Update divider color

### 5.7 AI Chat — Disclaimer Placement
- **Spec**: Below first AI message of each day, not every message
- **Current**: Appended to every AI response
- **Files**: `screens/chat/AIChatScreen.tsx`
- **Fix**: Track disclaimer shown per session; show once

### 5.8 Video Search — Focus Glow + Recent Searches
- **Spec**: Soft Blush border on focus, recent searches list below
- **Current**: No focus glow, no recent searches
- **Files**: `screens/home/VideoLibraryScreen.tsx`
- **Fix**: Add focus styling + recent search storage

---

## How to Use This Plan

Each phase is ordered by priority. Items within a phase are independent.
To implement, pick any item and:
1. Read the spec section in the matching `mobile/UI_UX/*.md` file
2. Read the current implementation
3. Apply the fix
4. Verify with `npx tsc --noEmit --skipLibCheck`

Key: `theme/tokens.ts` is the single source of truth. Change it once, and all screens using theme tokens will automatically pick up the new values.
