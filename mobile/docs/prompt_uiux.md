# SheCare — UI/UX Design Prompt

> Use this document to design the complete mobile UI/UX for SheCare, a women's wellness app built with React Native + Expo. It covers every screen, component, state, animation, and interaction present in the codebase.

---

## 1. Project Overview

**SheCare** is a women's wellness companion app focused on cycle tracking, pregnancy, mental health, safety, and an on-device AI companion named Luna. The app works fully offline (SQLite + encrypted storage) and syncs when online. It targets iOS and Android with a warm, trustworthy, feminine aesthetic.

**Key features:**
- Cycle & fertility tracking with ML predictions
- Pregnancy mode with weekly milestones and recommendations
- Wellness: journaling, mood logging, breathing exercises, insights
- Safety: SOS alerts, emergency contacts
- Family linking
- Nurse-verified educational content
- AI chat companion
- Voice journaling
- Luna desktop companion with XP, achievements, and local assets
- Offline-first sync with conflict resolution

**Design references from code:**
- Primary: `#FF6B8A` Soft Blush
- Primary light: `#FFB3C6` Blush Light
- Primary lighter: `#F7C5CC` Rose Quartz
- Accent: `#D4A5B5` Mauve
- Accent light: `#E8D5F5` Lavender
- Wellness/Success: `#D4F0E0` Mint
- Background: `#FFF8F0` Warm Cream
- Typography: Playfair Display (headings) + Inter (body)
- 4-px spacing grid, radius values: sm=8, md=12, lg=16, xl=24, pill=999
- Shadows: soft (blush tint), primary (blush stronger), SOS red glow
- Bottom tab bar: floating, glassmorphism, rounded 20px, active pink
- Theme supports light + dark mode via `useColorScheme`

---

## 2. Design Principles

- **Warmth over clinical**: Soft pastels, rounded corners, gentle shadows. The app feels like a caring friend, not a medical dashboard.
- **Offline-first clarity**: Always show sync state, network status, and local-only data clearly.
- **Privacy-first density**: Sensitive screens (journal, SOS, profile) should feel secure and private—avoid data leakage in screenshots.
- **Gentle urgency**: SOS is the only red-glowing element. Use soft greens for success, ambers for warnings.
- **Luna as a friend**: The companion is playful, not clinical. Achievements, sounds, and animations should feel rewarding but optional.

---

## 3. Typography

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display` | 32 | 700 | 38 | Hero numbers, countdown timers |
| `h1` | 24 | 700 | 30 | Screen titles |
| `h2` | 20 | 600 | 26 | Card titles, section headers |
| `h3` | 18 | 600 | 24 | Subsection headers |
| `body` | 16 | 400 | 22 | Body text, form labels |
| `bodySmall` | 14 | 400 | 20 | Secondary text, captions |
| `caption` | 12 | 400 | 16 | Helper text, timestamps |
| `button` | 16 | 600 | 20 | Button labels |
| `displayLogo` | 28 | 700 | 34 | Splash / brand wordmark |
| `displayCountdown` | 48 | 700 | 52 | Days-until-period countdown |
| `tab` | 11 | 500 | 14 | Bottom tab labels |

Fonts:
- **Headings**: Playfair Display (serif, elegant, trustworthy)
- **Body**: Inter (sans-serif, highly legible)
- **Mono**: SF Mono (for code-like data, e.g. model versions)

---

## 4. Color Palette

### Light Mode
| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#FFF8F0` | Page background (Warm Cream) |
| `surface` | `#FFFFFF` | Card backgrounds, modals, sheets |
| `textPrimary` | `#1A1D26` | Headlines, primary text |
| `textSecondary` | `#3B4151` | Body text |
| `textMuted` | `#7B8194` | Timestamps, helper text |
| `textInverse` | `#FFFFFF` | Text on colored buttons |
| `border` | `#EEF0F4` | Dividers, input borders |
| `primary` | `#FF6B8A` | Primary actions, active tabs, accents (Soft Blush) |
| `primaryMuted` | `#FFB3C6` | Soft backgrounds, hover states (Blush Light) |
| `primaryLighter` | `#F7C5CC` | Subtle highlights (Rose Quartz) |
| `accent` | `#D4A5B5` | Secondary actions, highlights (Mauve) |
| `accentMuted` | `#E8D5F5` | Soft accent backgrounds (Lavender) |
| `success` | `#4CAF50` | Positive states |
| `warning` | `#F4A93C` | Caution states |
| `danger` | `#D63B3B` | SOS, destructive actions |
| `info` | `#3B82F6` | Informational elements |

### Cycle Phase Colors
| Phase | Hex |
|-------|-----|
| Menstrual | `#FF6B8A` |
| Follicular | `#FFB3C6` |
| Ovulation | `#D4F0E0` |
| Luteal | `#E8D5F5` |

### Dark Mode
| Token | Hex |
|-------|-----|
| `background` | `#1A1D26` |
| `surface` | `#2A2D38` |
| `textPrimary` | `#FFFFFF` |
| `textSecondary` | `#EEF0F4` |
| `textMuted` | `#C7CCD6` |
| `border` | `#3A3D48` |
| `primary` | `#FFB3C6` (lighter for contrast) |
| `primaryMuted` | `#D6336B` |
| `accent` | `#C4B5FD` |
| `accentMuted` | `#7E5BEF` |
| `success` | `#4FB7B3` |
| `warning` | `#F4A93C` |
| `danger` | `#D63B3B` |
| `info` | `#3B82F6` |

---

## 5. Spacing & Layout

- **Grid**: 4-px base unit
- **Scale**: xs=4, sm=8, md=12, lg=16, xl=24, xxl=32, xxxl=48
- **Cards**: padding `lg` (16px), internal gaps `md` (12px)
- **Screen padding**: horizontal `xl` (24px), vertical `lg` (16px)
- **Touch targets**: minimum 44×44pt (Apple HIG)
- **Tab bar height**: 60pt, floating with 12pt margin from bottom, 16pt horizontal margin, `borderRadius: 20`
- **Cards**: `borderRadius: lg` (16px) standard, `xl` (24px) for feature cards

---

## 6. Component Specifications

### 6.1 Atoms

**Button**
- Variants: `primary` (filled #FF6B8A), `outline` (border), `ghost` (text only), `danger` (filled #D63B3B for SOS)
- Height: 48pt minimum, `borderRadius: pill` (fully rounded) or `md` (12px)
- Press state: scale to 0.96 with spring animation
- Disabled: opacity 0.5
- Loading: inline spinner replaces label

**Card**
- `borderRadius: lg` (16px)
- Shadow: `sm` for flat cards, `md` for elevated cards
- Padding: `lg` (16px)
- Variants: `elevated` (shadow), `flat` (no shadow), `glass` (blur + transparency for floating elements)
- Interactive cards: press scale 0.96

**Text**
- Variants: display, h1, h2, h3, body, bodySmall, caption, button, tab
- Color props: primary, secondary, muted, inverse, success, warning, danger, info
- Never hardcode colors; always use semantic color from theme

**Skeleton**
- Shimmer effect (animated gradient)
- Used for all async content placeholders
- Shapes: circle (avatar), rectangle (card), line (text)

### 6.2 Molecules

**FormField**
- Label above input (bodySmall, secondary color)
- Input: height 48pt, `borderRadius: sm` (8px), border `gray100`
- Focus: border `primary` (#FF6B8A), 2px width
- Error: border `danger`, error text below (caption)
- Helper text: caption, muted, below input

**BottomSheet**
- Rounded top corners (`borderRadius: xl` = 24px)
- Drag handle at top center
- Backdrop: semi-transparent black blur
- Max height: 80% of screen
- Swipe down to dismiss with snap points

**Modal**
- Centered dialog
- Backdrop: semi-transparent black
- Content: `borderRadius: xl` (24px), max width 400px
- Actions: stacked or horizontal at bottom

**Calendar**
- Monthly grid, 7 columns
- Period days: filled `primary` (#FF6B8A) circle
- Predicted period: outlined `primary` circle
- Fertile window: `accentMuted` (#E8D5F5) background tint
- Ovulation day: bright `accent` (#D4A5B5) circle with icon
- Today: ring border
- Selected day: solid `primary` circle
- Tappable days show `MarkEndDateModal` if period is active

**MoodPicker**
- Grid of emoji-style mood options (5-7 moods)
- Selected: scale up + ring
- Layout: 4 columns, gap `md`

**SymptomGrid**
- Grid of symptom chips/toggles
- Selected: filled `primaryMuted` (#FFB3C6) background
- Multi-select, max 8 selections
- Search/filter above grid if > 20 symptoms

**PickerField**
- Native picker wrapper with theme styling
- Label, selected value display, chevron icon
- `PickerField.web.tsx`: web-specific dropdown implementation

**ProgressBar / ProgressDots**
- Linear bar: rounded ends, `primary` (#FF6B8A) fill, `gray100` track
- Dots: active `primary`, inactive `gray300`
- Used in onboarding, breathing exercises, downloads

**StreakBadge**
- Small pill showing streak count
- Gradient background: `primary` → `accent`
- Icon: fire or flame

**HealthMetricCard**
- Icon + metric name + value + unit
- Compact card for Luna Health Hub
- Color-coded by metric type

**PredictionDetailCard**
- Shows predicted period dates, fertile window, confidence
- Confidence label: text + color (Excellent=green, Good=teal, Fair=amber, Uncertain=gray)
- Model version shown in caption

**EndDatePromptCard**
- Appears when period is logged but end date not set
- Date display + "Mark as ended" button
- Dismissible with snooze

**MarkEndDateModal**
- Bottom sheet with date picker
- Confirms end date for current period
- Saves and triggers prediction recompute

**KeyboardAvoidingWrapper**
- ScrollView with `KeyboardAvoidingView`
- Used on forms (login, register, log period, edit profile)

**ErrorBoundary**
- Full-screen fallback with app icon
- "Something went wrong" message
- "Restart" button
- Friendly tone, no stack traces

**ErrorState**
- Inline error within screen
- Icon + message + retry button
- Used in lists and detail screens

**ConnectivityBanner**
- Fixed top banner, `danger` background
- "You're offline" text
- Slides in/out with animation
- Shows on all screens via `App.tsx`

**Loader**
- Full-screen spinner with optional message
- Used during migrations, initial sync
- Brand-colored spinner

**CelebrationAnimation**
- Lottie animation for milestones (period logged, level up, achievement)
- Plays once, auto-dismisses
- Overlay with semi-transparent backdrop

**AchievementBadge / AchievementPopup**
- Badge: small icon + label, shown in Health Hub
- Popup: animated overlay when achievement unlocked
- Dismissible, auto-dismiss after 5s

**BackfillCard**
- Shows sync backfill status
- Used in offline dashboard

**ScreenLayout**
- Wraps screen content with safe area + standard padding
- Optional header slot, scroll support

### 6.3 Organisms

** LunaOverlay**
- Draggable cat sprite on Home dashboard
- States: idle, bounce, sleep, celebrate (driven by EventEngine)
- Long press: opens Health Hub
- Tap: plays sound, shows dialogue bubble
- Bubble: rounded, `primaryMuted` background, tail pointing to Luna
- Position: bottom-right, above tab bar, z-index high
- Accessibility: `accessibilityLabel="Luna the cat"`, `accessibilityHint="Tap to pet, long press for Health Hub"`

**AchievementPopup**
- Animated popup card
- Appears when Luna unlocks achievement
- Title: "Achievement Unlocked!", badge icon, description
- "Close" button + auto-dismiss timer
- Z-index above Luna overlay

---

## 7. Screen Specifications

### 7.1 Splash Screen
- Full-screen brand experience
- Background: gradient from `primary50` to Warm Cream
- Center: Luna logo/icon + "SheCare" wordmark (`displayLogo` typography)
- Bottom: "Preparing your data..." with loader if migrations/sync in progress
- Transitions: fade out → RootNavigator
- Duration: minimum 1.5s, or until `isHydrated` + migrations complete

### 7.2 Auth Stack

**LoginScreen**
- Clean form centered vertically
- Logo + "Welcome back" heading
- Email input (icon + clear button)
- Password input (icon + show/hide toggle)
- "Sign in" button (primary, full width)
- "Forgot password?" text link
- Divider: "or"
- Phone sign-in button (outline, phone icon)
- Register link at bottom
- Error message: red text below button
- Loading state: button shows spinner

**RegisterScreen**
- Similar layout to login
- Fields: display name, email, password, confirm password
- Real-time validation (password match, email format)
- "Create account" button
- Link to login

**PhoneScreen**
- Phone number input with country code picker
- "Continue" button
- OTP auto-focus hint

**OtpScreen**
- 6-digit OTP input in boxes
- Auto-advance on fill (if platform supports)
- Resend timer: "Resend in 60s"
- "Verify" button
- Support for SMS autofill

### 7.3 Onboarding Stack (6 screens)

**WelcomeScreen**
- Illustrations: friendly woman silhouette or abstract shapes
- "Welcome to SheCare" (h1)
- "Your personal wellness companion" (body, secondary)
- Features: period tracking, pregnancy support, journaling, Luna AI
- "Get Started" button (primary, full width)

**PersonalInfoScreen**
- Stepper indicator (1 of 6)
- Fields: age, height (cm), weight (kg), display name
- Date of birth picker (native)
- Avatar preview (optional)
- "Next" button

**CurrentCycleScreen**
- Stepper (2 of 6)
- "When did your last period start?" date picker
- "Average cycle length" number input (days, 20-45 range)
- "Average period length" number input (days, 2-10 range)
- Visual cycle diagram showing average length
- "Next" button

**PastCycleScreen**
- Stepper (3 of 6)
- "Add past cycles for better predictions"
- List of date pairs (start, end) with add/remove
- Minimum 3 cycles shown, up to 12
- Calendar-style date pickers
- "Skip" + "Next" buttons

**LifestyleScreen**
- Stepper (4 of 6)
- Fields: sleep hours (slider 4-12), exercise frequency (picker: low/medium/high), diet (picker: balanced/normal/junk), stress level (picker: low/medium/high)
- Visual icons for each category
- "Next" button

**CompleteScreen**
- Stepper (5 of 6, last)
- "You're all set!" with celebration animation
- Summary of entered data
- "Start using SheCare" button
- Triggers `onboarding_completed` event, navigates to Main

### 7.4 Home Stack

**HomeDashboardScreen**
- **Header**: Time-based greeting ("Good morning, [Name]") + notification bell icon
- **Luna Overlay**: draggable cat sprite in bottom-right corner, floating above content
- **Quick Actions Row**: 4-5 circular icons (Log Period, Log Mood, Journal, Breathing, SOS)
- **Prediction Card**: days until next period, confidence label, model version. Tappable → CyclePredictionsScreen
- **Calendar Strip**: horizontal scroll of 7 days with dots for period/fertile/ovulation
- **Health Tips Carousel**: 3 cards rotating tips (sleep, water, exercise). Tappable → full tips
- **Continue Watching**: horizontal video cards with progress bars
- **Bottom spacing**: extra padding for floating tab bar
- States: loading (skeleton), error (retry), empty (encouraging message)

**CyclePredictionsScreen**
- Large countdown number: "X days until your period"
- Prediction detail card: predicted start, predicted end, fertile window start/end
- Confidence meter: progress bar + label (Excellent/Good/Fair/Uncertain)
- Model info: "Model: rule_based_v2 | Training data: 12 entries"
- "Log Correction" button if prediction seems wrong
- Calendar mini-view highlighting prediction window
- History list: past predictions vs actual dates

**CycleAnalyticsScreen**
- Stats row: Average cycle length (days), Cycle range (min-max)
- Line chart: cycle length over last N months (smooth curve, gradient fill under line)
- Bar chart: top 5 symptoms (horizontal bars, color-coded)
- Bar chart: top 5 moods (horizontal bars, color-coded)
- Empty state: "Log at least 1 cycle to unlock insights" with illustration

**CycleHistoryScreen**
- List of cycle entries, newest first
- Each entry: date range, flow intensity dot, symptoms chips, mood tags
- Swipe actions: edit, delete (with confirmation)
- Pull to refresh
- "Log Period" FAB

**LogPeriodScreen**
- Form with validation:
  - Period start date (date picker, required)
  - Period end date (date picker, optional) + "Still ongoing?" toggle
  - Flow intensity: 4-option segmented control (light/medium/heavy/spotting)
  - Symptoms: grid selector (search + multi-select)
  - Mood tags: horizontal scroll chips
  - Energy level: 1-5 star rating or slider
  - Notes: textarea
  - Cycle type: dropdown (menstrual, anovulatory, etc.)
- Save button (primary)
- Loading skeleton on submit

**MenstrualPhasesScreen**
- Educational content
- 4 phase cards: Menstrual, Follicular, Ovulation, Luteal
- Each card: icon, title, date range estimate, description, typical symptoms
- Visual timeline at top showing current position in cycle
- Colors match phase palette

**CalendarScreen**
- Monthly calendar grid
- Period days: filled pink circles
- Predicted period: outlined pink circles
- Fertile window: green-tinted background cells
- Ovulation day: purple dot or icon
- Today: blue ring
- Selected day: solid pink circle
- Month navigation arrows
- Legend at bottom
- Tap day → show entry summary or log form

**BreathingListScreen**
- List of exercises: 4-7-8 Breathing, Box Breathing, Calm Breathing, etc.
- Each card: name, duration, description, technique tag
- "Start" button on each
- Completed exercises show checkmark + "Done" badge

**BreathingComplete** (modal/sheet)
- Exercise name + "Session Complete"
- Stats: duration, date
- "Done" button

**MoodLogScreen**
- Mood grid: 5-7 mood options (Happy, Calm, Neutral, Sad, Anxious, Energetic, Tired)
- Visual emoji-style icons
- Intensity slider: 1-10
- Notes: optional text field
- "Save" button
- Calendar strip showing past 7 days with mood dots

**MoodHistoryScreen**
- Date range selector (7d, 30d, 90d)
- Mood trend chart: line or bar chart showing mood intensity over time
- List of recent mood logs with date, mood, intensity, notes

**JournalListScreen**
- List of journal entries, newest first
- Each card: title, date preview, mood tag, sentiment label
- Empty state: "Start journaling to track your thoughts"
- FAB: "+" to create new entry

**JournalEntryScreen**
- Title input
- Content textarea (auto-save draft every 30s, show "Draft saved" toast)
- Mood selector (MoodPicker)
- Date picker (defaults to today)
- "Save" button
- On-device sentiment analysis runs in background, shows result after save
- Offline: queued for sync, toast "Saved offline"

**InsightsScreen**
- Weekly wellness summary
- Stats: total journals, total mood logs, average mood intensity, most common mood
- Recommendation card (AI-generated or static)
- "View Details" link to AnalyticsDashboard

**HealthHubScreen** (Companion)
- Luna sprite (larger, interactive)
- Daily metrics grid: sleep, water, food, exercise, medication
- Streak counter + XP bar
- Achievement badges row
- "Check-in" button for daily metrics
- Dialogue bubble from Luna

**VideoLibraryScreen**
- Search bar with recent searches
- Category chips: All, Yoga, Nutrition, PCOS, Mental Health, Exercise, Sleep, Pregnancy
- 2-column video grid
- Each card: thumbnail placeholder (colored), duration badge, title, channel, views
- "Continue Watching" horizontal section with progress bars
- Empty state: "No videos found"
- Offline indicator: dimmed opacity for online-only videos

### 7.5 Analytics Stack

**AnalyticsDashboardScreen**
- Header: "Analytics" + subtitle "Your cycle patterns at a glance"
- Stats cards: Avg cycle length, Cycle range
- Line chart: cycle length over last 12 months
- Top Symptoms: horizontal bar chart (top 5)
- Top Moods: horizontal bar chart (top 5)
- Loading: skeleton placeholders
- Empty: "Patience is beautiful" illustration + "Log at least 1 cycle"
- Cross-module: data from cycle + wellness

### 7.6 AI Chat Stack

**AIChatScreen**
- Full-screen chat interface
- Message list: user messages right (pink bubble), AI messages left (gray bubble)
- AI avatar: Luna or generic bot icon
- Input bar: text input + send button + attachment icon (future)
- Typing indicator: 3 bouncing dots
- Timestamps on messages
- Empty state: "Ask me anything about your wellness"
- Online-only: disabled when offline with banner message

**ChatHomeScreen**
- List of chat rooms
- Each room: name, participant count, last message preview, timestamp, unread badge
- FAB: "New Chat"
- Pull to refresh
- Empty: "No conversations yet"

**ChatRoomScreen**
- Chat header: room name, participant avatars, info icon
- Message list (same as AIChat)
- Input bar

### 7.7 Safety Stack

**SafetyHomeScreen**
- Large SOS button at top (danger red, pulsing glow animation, `shadow.sos`)
- "Press and hold to alert" or "Tap to trigger"
- Quick action: "Call emergency contact" (phone)
- Emergency contacts summary: list with primary indicator
- "Add Contact" button
- Active SOS banner: red, "Alert in progress" with cancel/resolve buttons

**SOSActiveScreen**
- Full-screen red-tinted overlay (subtle)
- Pulsing SOS indicator
- Map placeholder or GPS coordinates display
- "Cancel Alert" button (outline, white)
- "I'm Safe" button (primary, green)
- Timer: "Active for X minutes"
- Contacts notified count

**SosHistoryScreen**
- List of past SOS alerts
- Each card: date, status (resolved/cancelled/false alarm), location, contacts notified
- Color-coded status badges

**EmergencyContactsScreen**
- List of contacts with: name, phone, relationship, primary badge
- Swipe to edit/delete
- FAB: "+" to add contact
- Empty state: "No contacts yet. Add your first emergency contact."

**EmergencyContactEditScreen**
- Form: name (required), phone (required), relationship (optional), is_primary toggle
- Save/delete buttons
- Validation: phone format

### 7.8 Family Stack

**FamilyHomeScreen**
- List of linked family members
- Each card: avatar, name, relationship, phone, permission badges (view cycle, view SOS, receive alerts)
- "Link New Member" button
- Empty state: "No family members linked"

**InviteFamilyScreen**
- Generated invite link (shareable)
- QR code placeholder
- "Copy Link" button
- "Share via..." native share sheet
- Link expiry info
- Permissions selector before generating: checkboxes for view_cycle, view_sos, view_journal, receive_alerts

### 7.9 Profile Stack

**ProfileHomeScreen**
- Avatar + display name + email/phone
- Stats row: streak, entries logged, days active
- Quick links grid: Edit Profile, Linked Family, Settings, Help & Support
- Luna section: install status, "Download Luna" or "Open Settings"
- Version info at bottom

**EditProfileScreen**
- Form: display name, email (readonly), phone (readonly), DOB (picker), blood group (picker), medical notes (textarea)
- Save button
- Avatar upload button (returns presigned URL)

**ChangePasswordScreen**
- Current password input
- New password input
- Confirm new password input
- "Update Password" button
- Warning: "This will log you out of all devices"

**LinkedFamilyScreen**
- List of linked members with permissions
- Each: name, relationship, permissions badges
- "Link New Member" button
- Empty state

**SettingsScreen**
- Sections:
  - **Luna**: install/uninstall toggle, hide/show toggle, reduce animations toggle, mute sounds toggle
  - **Notifications**: toggle types (period reminders, SOS alerts, check-ins)
  - **Privacy**: biometric lock toggle, clear data button
  - **Account**: export data, delete account (danger zone)
- Toggle switches with labels
- Danger actions: red text, confirmation dialog

### 7.10 Pregnancy Stack

**PregnancyHomeScreen**
- Header: "You're X weeks pregnant" (large, `display` typography)
- Trimester badge (1st/2nd/3rd)
- Due date countdown: "Due in X days" (`displayCountdown`)
- Quick actions: Log Daily, Milestones, Recommendations
- Fetal development illustration placeholder
- Today's tip card

**PregnancyProfileScreen**
- Profile card: due date, LMP, weeks pregnant, trimester, baby name
- Edit button → update form
- Blood type, allergies display
- "Archive Profile" button (after delivery)

**PregnancyDailyLogScreen**
- Date picker (defaults today)
- Symptoms: grid selector
- Mood: MoodPicker
- Cravings: text input
- Weight: number input (kg)
- Blood pressure: systolic/diastolic inputs
- Notes: textarea
- Save button

**PregnancyMilestonesScreen**
- Timeline view by week
- Current week highlighted
- Cards: week number, title, description, category (fetal development, symptoms, tips)
- Completed badge if marked done
- "Mark Complete" button per milestone

**PregnancyRecommendationsScreen**
- Cards grouped by trimester
- Each: category icon, title, description, priority badge (high/medium/low)
- Filter by category: diet, exercise, rest, warning signs
- Static content, no ML

### 7.11 Admin Stack

**AdminDashboardScreen**
- Stats grid: Total Users, Active Today, SOS Alerts (7d), Avg Session
- Each stat: value, label, change percentage, color-coded background
- Recent Activity list: action, user, timestamp
- Mock data currently; real API integration pending

**UserManagementScreen**
- Filter chips: All, User, Nurse, Family, Admin
- User cards: avatar initial, name, role badge, status dot (active/inactive), phone, joined date
- Press to view details / edit role
- Empty: "No users found"

### 7.12 Voice Stack

**VoiceJournalScreen**
- Large record button (center, circular, pulse animation when recording)
- waveform visualization placeholder
- Timer: "00:00"
- "Tap to record" instruction
- Processing state: "Analyzing..." with loader
- Save to journal entry after transcription + sentiment
- Offline: queued locally, sync later

**VoiceHistoryScreen**
- List of voice entries
- Each: date, transcription preview, mood detected, duration
- Play button for audio playback
- Delete option

### 7.13 Companion / Luna

**LunaInstallScreen**
- Feature list with icons: Daily Companion, Celebrates Wins, XP & Levels, Customizable, Sound Effects, 100% Private
- "Download Luna (~4.5 MB)" button
- Progress bar during download
- "Uninstall Luna" option with confirmation
- Status: Not installed / Downloading / Ready
- Storage space check before download

**LunaOverlay**
- Draggable sprite (cat image/animation)
- Bottom-right corner, above tab bar
- States: idle (breathing animation), bounce (interactive), sleep (eyes closed), celebrate (party hat)
- Dialogue bubble: rounded rectangle, tail pointer, max width 200px, auto-dismiss 4s
- Sound effects: meow, purr, yawn, celebration (optional, mute toggle respected)
- Achievement popup appears above Luna

### 7.14 Dev Stack

**OfflineDashboardScreen**
- Real-time sync metrics
- Queue size, operations pending, retry counts
- Last sync timestamp, duration, ops pushed/pulled
- Error log list
- "Force Sync Now" button
- "Clear Queue" button (dev only)

---

## 8. Navigation Structure

```
RootNavigator
├── SplashScreen
└── NavigationContainer
    └── Root Stack (no header)
        ├── AuthStack
        │   ├── Login
        │   ├── Register
        │   ├── Phone
        │   └── Otp
        ├── OnboardingStack
        │   ├── Welcome
        │   ├── PersonalInfo
        │   ├── CurrentCycle
        │   ├── PastCycle
        │   ├── Lifestyle
        │   └── Complete
        └── MainTabs
            ├── HomeStack
            │   ├── HomeDashboard
            │   ├── MoodLog
            │   ├── MoodHistory
            │   ├── CyclePredictions
            │   ├── Videos
            │   ├── AIChat
            │   ├── JournalList
            │   ├── JournalEntry
            │   ├── BreathingList
            │   ├── Insights
            │   └── HealthHub
            ├── CalendarStack
            │   └── Calendar
            ├── AnalyticsStack
            │   └── AnalyticsDashboard
            ├── AIChatStack
            │   └── AIChat
            └── ProfileStack
                ├── ProfileHome
                ├── EditProfile
                ├── ChangePassword
                ├── LinkedFamily
                ├── Settings
                └── CompanionInstall (LunaInstall)
```

**Tab order:** Home → Calendar → Analytics → AI Chat → Profile

**Deep linking:**
- Notification `checkin` → Main → Calendar → CycleDashboard
- Notification `mark-end-date` → Main → Calendar → CycleDashboard with `markEndDate: true`

---

## 9. States & Interactions

### 9.1 Loading States
- **Initial load**: Splash screen with brand
- **Screen load**: Skeleton placeholders matching card layouts
- **Action loading**: Button spinner, disabled state
- **Sync loading**: Connectivity banner + progress indicator

### 9.2 Empty States
- Friendly illustrations or icons
- Encouraging copy (no error language)
- Clear call-to-action button
- Examples: "No cycles logged yet", "No family members linked", "Start your first journal entry"

### 9.3 Error States
- Inline errors: red text below form fields
- Screen errors: ErrorState component with retry
- Global errors: ErrorBoundary with "Restart" button
- Network errors: ConnectivityBanner + toast "Saved offline — will sync when online"

### 9.4 Offline Behavior
- All mutations queue to `offlineStore` when network fails
- Toast: "Saved offline — will sync when online"
- Optimistic UI: temp IDs, `_optimistic: true` flag, pending indicators
- Background sync on reconnect, foreground, and every 15 min
- Manual sync trigger in dev screen

### 9.5 Animations
- **Press feedback**: scale 0.96 with spring (all pressable elements)
- **Screen transitions**: default React Navigation card transitions
- **Luna animations**: Reanimated shared values (idle breathing, bounce on tap, celebrate on achievement)
- **Achievement popup**: fade + scale spring entrance, auto-dismiss after 5s
- **SOS button**: pulsing red glow (`shadow.sos` with opacity animation)
- **Calendar transitions**: month fade/slide
- **Charts**: grow from zero on load
- **Staggered list entrance**: `withDelay` per item on Home dashboard cards

### 9.6 Dark Mode
- All colors use semantic tokens from `useTheme()`
- Background switches to dark gray, surfaces to lighter gray
- Primary pink lightens for contrast
- Test all screens in both modes

---

## 10. Accessibility

- All interactive elements: `accessibilityRole` (button, toggle, link)
- All images/icons: `accessibilityLabel`
- All actions: `accessibilityHint` where needed
- Dynamic type: use `react-native-size-matters` for font scaling
- Touch targets: minimum 44×44pt
- Color contrast: ≥ 4.5:1 normal, 3:1 large
- `accessibilityLiveRegion` for SOS alerts, sync status changes
- Screen reader labels for charts (alt text descriptions)

---

## 11. Feature Flags

The app uses feature flags to conditionally show features:

| Flag | Default | Impact |
|------|---------|--------|
| `voiceJournal` | false | Shows/hides voice journal screens |
| `pregnancyMode` | true | Shows/hides pregnancy stack |
| `aiSentiment` | true | Shows/hides journal sentiment analysis |
| `familyLinking` | true | Shows/hides family invite/link features |
| `lunaEnabled` | true | Shows/hides Luna overlay, install screen, health hub |

Design all screens to gracefully handle feature-flagged visibility (hide tabs/screens when off, no broken routes).

---

## 12. Backend-Driven UI Notes

- **Feature flags** are fetched from backend on launch (`/api/v1/features`). Mobile respects them immediately.
- **Model versions** for cycle predictions and wellness classifier are server-configurable. UI shows current version in settings or about screens.
- **Health tips** are server-fetched with local JSON fallback. Design the tips UI to handle 0–3 tips gracefully.
- **Nurse content** is server-moderated. Public content list is accessible without auth.
- **Luna assets** are downloaded from CDN based on `/features/luna/metadata`. Design the download UI to show version, size, checksum status.

---

## 13. Do Not Design

- **No hardcoded colors**: always reference theme tokens
- **No inline styles**: use `StyleSheet.create` or styled-components
- **No plain AsyncStorage for sensitive data**: use encrypted storage
- **No Zustand for server state**: use TanStack Query
- **No `ScrollView` for long lists**: use `FlatList` with `getItemLayout` where possible
- **No legacy `Animated` API**: use Reanimated 3 for complex animations
- **No inline functions in render**: memoize hot components

---

## 14. Key User Flows to Validate

1. **New user**: Splash → Onboarding (6 screens) → Home dashboard
2. **Log period**: Home → Log Period → Form → Save → Calendar updates → Prediction recomputes
3. **SOS flow**: Safety tab → Trigger SOS → Active screen → Cancel/Resolve → History
4. **Offline journal**: Turn off network → Create journal → Toast "Saved offline" → Turn on network → Auto sync → Toast/conflict resolution
5. **Luna install**: Profile → Settings → Download Luna → Progress → Ready → Overlay appears on Home
6. **Family invite**: Family tab → Generate invite → Share → Accept on other device → Linked members appear
7. **Pregnancy setup**: Pregnancy tab → Create profile → Add daily log → View milestones → Get recommendations

---

## 15. Deliverables Expected

- **Style guide**: colors, typography, spacing, icons
- **Component library**: all atoms and molecules in Figma
- **Screen designs**: every screen listed above, with all states (loading, error, empty, success)
- **Dark mode variants** for all screens
- **Interactive prototype**: navigation flow, tab switching, modals, bottom sheets
- **Animation spec**: Luna states, SOS pulse, achievement popup, press feedback
- **Accessibility audit**: labels, roles, contrast, touch targets
- **Offline state mockups**: connectivity banner, sync indicators, optimistic UI
