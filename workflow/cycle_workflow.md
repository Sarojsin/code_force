# Cycle Workflow — SheCare

> **Codebase version:** 0.1.0  
> **Last updated:** 2026-07-10  
> **Scope:** Complete menstrual cycle module — dashboard, calendar, predictions, corrections, sync, analytics, notifications.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Folder Structure](#2-folder-structure)
3. [Navigation Flow](#3-navigation-flow)
4. [Dashboard](#4-dashboard)
   - 4.1 [CycleDashboardScreen](#41-cycledashboardscreen)
   - 4.2 [Calendar Integration](#42-calendar-integration)
   - 4.3 [PredictionDetailCard](#43-predictiondetailcard)
   - 4.4 [StickyCard (Correction Window)](#44-stickycard-correction-window)
    - 4.5 [Adjust Period Date BottomSheet](#45-adjust-period-date-bottomsheet)
    - 4.6 [EndDatePromptCard (Mark End Date)](#46-enddatepromptcard-mark-end-date)
5. [Cycle Predictions Screen](#5-cycle-predictions-screen)
6. [Cycle History Screen](#6-cycle-history-screen)
7. [Log Period Screen](#7-log-period-screen)
8. [Cycle Analytics Screen](#8-cycle-analytics-screen)
9. [Calendar Screen](#9-calendar-screen)
10. [Predictions Engine](#10-predictions-engine)
    - 10.1 [ONNX Model Pipeline](#101-onnx-model-pipeline)
    - 10.2 [Global Model Architecture](#102-global-model-architecture)
    - 10.3 [Fallback Heuristics](#103-fallback-heuristics)
    - 10.4 [Prediction Service (Backend)](#104-prediction-service-backend)
    - 10.5 [Correction Logic](#105-correction-logic)
    - 10.6 [Snooze Logic](#106-snooze-logic)
11. [Notifications](#11-notifications)
    - 11.1 [Check-in Push Notification](#111-check-in-push-notification)
    - 11.2 [Local Notification Flow](#112-local-notification-flow)
    - 11.3 [FCM Background Flow](#113-fcm-background-flow)
12. [Database Schema](#12-database-schema)
13. [Offline Behavior](#13-offline-behavior)
14. [Synchronization](#14-synchronization)
15. [API Reference](#15-api-reference)
16. [Error Handling](#16-error-handling)

---

## 1. Architecture Overview

### 1.1 High-Level Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        MOBILE APP                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                    CYCLE MODULE                       │       │
│  │                                                      │       │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │       │
│  │  │CalendarScreen │  │CycleDashboard│  │Predictions│  │       │
│  │  │ - Month grid  │  │ - Calendar   │  │ - Countdown│  │       │
│  │  │ - Phase color │  │ - StickyCard │  │ - Detail   │  │       │
│  │  │ - Day details │  │ - Override   │  │ - Override │  │       │
│  │  │ - Override    │  │ - Analytics  │  └───────────┘  │       │
│  │  └──────────────┘  └──────────────┘                  │       │
│  │                                                      │       │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │       │
│  │  │ LogPeriod    │  │ CycleHistory │  │ Analytics │  │       │
│  │  │ - Date range │  │ - List view  │  │ - Charts  │  │       │
│  │  │ - Flow       │  │ - Pagination │  │ - Stats   │  │       │
│  │  │ - Symptoms   │  └──────────────┘  └───────────┘  │       │
│  │  └──────────────┘                                    │       │
│  └──────────────────────────────────────────────────────┘       │
│                         │                                        │
│  ┌──────────────────────┴─────────────────────────────────────┐  │
│  │                  TANSTACK QUERY                             │  │
│  │  useCycleCalendar | useCyclePredictions | useCycleEntries  │  │
│  │  useLogCorrection | useLogSnooze | useCycleAnalytics       │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────┴─────────────────────────────────────┐  │
│  │                  API CLIENT (cycleService)                  │  │
│  │  getCalendar | getPredictions | getEntries | getAnalytics  │  │
│  │  logCorrection | logSnooze | createEntry                   │  │
│  │  getModelStatus | downloadModel                            │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────┴─────────────────────────────────────┐  │
│  │               PREDICTION ENGINE (MOBILE)                    │  │
│  │  globalModel → linear regression + JSON scaler              │  │
│  │  modelUpdater → downloads .onnx wellness classifier         │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────┼────────────────────────────────────────┐
│                    BACKEND (FastAPI)                              │
│                         │                                        │
│  ┌──────────────────────┴─────────────────────────────────────┐  │
│  │                   CYCLE MODULE                              │  │
│  │                                                             │  │
│  │  Routes:                                                    │  │
│  │  POST /cycle/entries         → Log period entry             │  │
│  │  GET  /cycle/entries         → List entries (paginated)     │  │
│  │  GET  /cycle/entries/{id}    → Get single entry             │  │
│  │  PUT  /cycle/entries/{id}    → Update entry                 │  │
│  │  DEL  /cycle/entries/{id}    → Soft-delete entry            │  │
│  │  GET  /cycle/predictions     → Next prediction              │  │
│  │  GET  /cycle/predictions/history → Past predictions vs actual│  │
│  │  GET  /cycle/analytics       → Cycle statistics             │  │
│  │  POST /cycle/corrections     → Log correction               │  │
│  │  POST /cycle/snooze          → Log "Not yet"                │  │
│  │  GET  /cycle/calendar        → Calendar (encoded days)      │  │
│  │  GET  /cycle/models/status   → Global model version         │  │
│  │  GET  /cycle/models/download → Download model file          │  │
│  │                                                             │  │
│  │  Services: PredictionService, CorrectionService,            │  │
│  │           CycleService, CalendarService, AnalyticsService   │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────┴─────────────────────────────────────┐  │
│  │  INTEGRATIONS                                              │  │
│  │  prediction_engine.py → GlobalModel + Fallback             │  │
│  │  huggingface_client.py → Sentiment analysis                │  │
│  │  fcm_client.py → Push notifications (check-in reminders)   │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────┴─────────────────────────────────────┐  │
│  │  CELERY TASKS                                              │  │
│  │  cycle/tasks.py → compute_initial_prediction               │  │
│  │ tasks/checkin.py → checkin_push_notification (daily at P-3)│  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────┴─────────────────────────────────────┐  │
│  │  PostgreSQL │ Redis │ JSON Model Storage                   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Module Structure (Backend)

```
app/modules/cycle/
├── __init__.py
├── routes.py              # 11 endpoints
├── services.py            # PredictionService, CyclService, CalendarService, etc.
├── models.py              # CycleEntry, PredictedCycle, SnoozeEvent, SystemConfig
├── schemas.py             # EntryCreate/Response, PredictionResponse, CorrectionCreate, etc.
├── dependencies.py        # CycleServiceDep
├── exceptions.py          # CycleNotFoundError, PredictionNotFoundError
├── phase_utils.py         # calculate_cycle_phases, compute_period_length
├── tasks.py               # compute_initial_prediction (Celery)
└── plans/
    └── cycle_rule_plan.md # Correction window spec (P-3 to P+6)

app/integrations/
└── prediction_engine.py   # GlobalModel + fallback prediction logic
```

### 1.3 Module Structure (Mobile)

```
mobile/src/
├── screens/cycle/
│   ├── CycleDashboardScreen.tsx      # Main cycle dashboard
│   ├── CyclePredictionsScreen.tsx    # Prediction detail + countdown
│   ├── CycleHistoryScreen.tsx        # Historical cycle list
│   ├── LogPeriodScreen.tsx           # Log period entry form
│   └── CycleAnalyticsScreen.tsx      # Analytics + charts
├── screens/calendar/
│   └── CalendarScreen.tsx            # Month calendar grid
├── services/api/
│   └── cycle.ts                      # cycleService: all cycle API calls
├── services/queries/
│   └── cycle.ts                      # React Query hooks
├── components/ui/
│   ├── Calendar.tsx                  # Month grid component
│   ├── DatePickerField.tsx           # Date picker for react-hook-form
│   ├── PredictionDetailCard.tsx      # Prediction display card
│   └── StickyCard.tsx                # Correction sticky card
├── services/ml/
│   ├── globalModel.ts                # Global model client (linear regression)
│   ├── modelUpdater.ts               # Model update check + download
│   ├── heuristicScorer.ts            # Fallback heuristic predictions
│   └── index.ts                      # ML service barrel export
```

---

## 2. Navigation Flow

### 2.1 Cycle Screen Hierarchy

```
Calendar Tab (bottom tab)
│
├── CalendarMain (CalendarScreen)
│   ├── Month grid with phase color coding
│   ├── Day selection → bottom sheet with details
│   ├── "Cycle Dashboard" button → CycleDashboard
│   └── "Adjust Period Date" button → override BottomSheet
│
├── CycleDashboard (CycleDashboardScreen)
│   ├── Calendar component
│   ├── PredictionDetailCard
│   ├── StickyCard (P-3 to P+6 correction window)
│   ├── Action buttons: Log Period, Predictions, History, Analytics
│   └── "Adjust Period Date" → override BottomSheet
│
├── LogPeriod → LogPeriodScreen
├── CyclePredictions → CyclePredictionsScreen
├── CycleHistory → CycleHistoryScreen
├── CycleAnalytics → CycleAnalyticsScreen
└── PhaseDetail → MenstrualPhasesScreen

Home Tab → HomeDashboardScreen
│
└── "AI Prediction" card → CyclePredictions (HomeStack context)
```

### 2.2 Stack Configuration

```typescript
// CalendarStack.tsx
type CalendarStackParamList = {
  CalendarMain: undefined;
  PhaseDetail: { phase: string };
  CycleDashboard: undefined;
  LogPeriod: undefined;
  CycleHistory: undefined;
  CyclePredictions: undefined;
  CycleAnalytics: undefined;
};

// HomeStack.tsx (separate CyclePredictions registration)
type HomeStackParamList = {
  HomeDashboard: undefined;
  CyclePredictions: undefined;  // Different instance from CalendarStack's
  // ... other home screens
};
```

### 2.3 Complete Navigation Flow Diagram

```
User taps Calendar tab
│
├── CalendarScreen renders
│   ├── Fetches cycle calendar data (3 months back, 3 months forward)
│   │   └── GET /api/v1/cycle/calendar?months_back=3&months_forward=3
│   ├── Renders month grid with phase colors
│   │   ├── Menstrual → red (#FF5252)
│   │   ├── Follicular → yellow (#FFD54F)
│   │   ├── Ovulation → green (#4CAF50)
│   │   └── Luteal → blue (#42A5F5)
│   ├── Tap day → SelectedDaySheet bottom sheet
│   │   ├── Date header
│   │   ├── Phase badge
│   │   ├── Quick mood chips
│   │   ├── Symptom chips
│   │   ├── "Log Period" button  
│   │   └── "View [Phase] Details" → PhaseDetail screen  
│   └── Bottom buttons:
│       ├── "Cycle Dashboard" → CycleDashboardScreen (same stack)
│       └── "Adjust Period Date" → override BottomSheet
│
├── CycleDashboardScreen
│   ├── Fetches calendar + predictions
│   ├── Title: "Your Cycle"
│   ├── PredictionDetailCard (if prediction exists)
│   ├── StickyCard (only visible during P-3 to P+6 window)
│   │   ├── "Did your period start?" prompt
│   │   ├── "Yes, it started" → logCorrection
│   │   ├── "Not yet" → logSnooze (snooze for 1 day)
│   │   └── "Adjust date" → inline date input
│   ├── "Next period in X days" stat card
│   ├── Calendar component (read-only, shows phases)
│   ├── Action buttons:
│   │   ├── "Log Period" → LogPeriodScreen
│   │   ├── "Predictions" → CyclePredictionsScreen
│   │   ├── "History" → CycleHistoryScreen
│   │   └── "Analytics" → CycleAnalyticsScreen
│   └── "Adjust Period Date" → override BottomSheet
│
├── CyclePredictionsScreen
│   ├── Fetches prediction
│   ├── Countdown card ("X days until next period")
│   ├── PredictionDetailCard (single prediction)
│   │   ├── Predicted start date
│   │   ├── Predicted end date
│   │   ├── Fertile window (if available)
│   │   ├── Confidence score + label
│   │   ├── Model type (global_model / fallback)
│   │   └── Training data points
│   └── "Adjust Period Date" → override BottomSheet
│
├── CycleHistoryScreen
│   ├── Fetches entries (paginated, offset-based)
│   ├── List of past cycles
│   │   ├── Period start → end
│   │   ├── Flow intensity
│   │   ├── Symptoms
│   │   └── Mood tags
│   └── Load more (pagination)
│
├── LogPeriodScreen
│   ├── Date range picker (period start → end)
│   ├── Flow intensity selector (light/medium/heavy)
│   ├── Symptoms multi-select
│   ├── Mood tags
│   ├── Notes
│   └── "Save" → POST /cycle/entries
│
└── CycleAnalyticsScreen
    ├── Fetches analytics
    ├── Average cycle length
    ├── Shortest/longest cycle
    ├── Common symptoms chart
    ├── Common moods chart
    └── Total entries count
```

---

## 3. Dashboard

### 3.1 CycleDashboardScreen

#### 3.1.1 Purpose

The main cycle dashboard view showing the user's current cycle status, prediction, calendar, and quick actions.

#### 3.1.2 Data Fetching

```typescript
// On mount:
const { data: calData, isLoading } = useCycleCalendar(3, 3);
// GET /api/v1/cycle/calendar?months_back=3&months_forward=3
const logCorrection = useLogCorrection();
const logSnooze = useLogSnooze();
const updateEntry = useUpdateCycleEntry();  // For EndDatePromptCard updates
const endDateStore = useEndDateStore();

// Check if navigated from MarkEndDate notification:
useEffect(() => {
  if (route.params?.markEndDate && endDateStore.periodStartDate) {
    setShowEndDateModal(true);
  }
}, [route.params?.markEndDate, endDateStore.periodStartDate]);

// Also loads ML model:
useEffect(() => {
  globalModelClient.ensureLatest().catch(() => null);
}, []);

// Background model update check:
useEffect(() => {
  if (isConnected) {
    modelUpdater.checkForUpdate().then((result) => {
      if (result.wellness || result.minilm) {
        Toast.show({ type: 'success', text1: 'Wellness model updated — predictions improved' });
      }
    }).catch(() => {});
  }
}, [isConnected]);
```

#### 3.1.3 Response Type

```typescript
interface CalendarResponse {
  days: Record<string, string>;      // "2026-07-10": "P" | "F" | "O" | "L"
  predictions?: PredictionDetail | null;
  next_period_in_days?: number | null;
  needs_checkin: bool;               // True if in P-3 window and no checkin sent yet
}

interface PredictionDetail {
  id: string;
  predicted_next_period_start: string;
  predicted_period_end?: string | null;
  predicted_fertile_window_start?: string | null;
  predicted_fertile_window_end?: string | null;
  model_type: string;
  confidence_score?: number | null;
  confidence_label?: string | null;
  training_data_points: number;
  prediction_window_days?: number | null;
}
```

#### 3.1.4 Day Encoding

The calendar returns days as a dictionary mapping date strings to 11 possible type codes:

| Code | Label | Color | When Assigned |
|------|-------|-------|---------------|
| `P` | Period | #F48FB1 | Confirmed cycle entry day (has end_date) |
| `p` | Predicted Period | #FCE4EC | Predicted period day from active prediction |
| `u` | Unconfirmed | #FFB3C1 | Cycle entry without end_date (partial, only start known) |
| `c` | Cancelled | #E0E0E0 | Prediction whose `actual_cycle_entry_id` is set |
| `F` | Fertile | #CE93D8 | Fertile window from confirmed entry |
| `f` | Predicted Fertile | #F3E5F5 | Fertile window from active prediction |
| `O` | Ovulation | #81C784 | Ovulation day from confirmed entry |
| `o` | Predicted Ovulation | #E8F5E9 | Ovulation day from active prediction |
| `L` | Luteal | #90CAF9 | Luteal phase from confirmed entry |
| `l` | Predicted Luteal | #E3F2FD | Luteal phase from active prediction |
| `T` | Today | #42A5F5 | Always set to current day, overrides other codes |

#### 3.1.5 Loading State

```tsx
if (isLoading) {
  return (
    <SafeAreaView>
      <ScrollView>
        <Skeleton height={120} />
        <Skeleton height={300} />
        <Skeleton height={80} />
      </ScrollView>
    </SafeAreaView>
  );
}
```

#### 3.1.6 UI Layout

```
┌─────────────────────────────────────┐
│  Your Cycle                          │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │  PredictionDetailCard         │  │
│  │  - Next period: Jul 15       │  │
│  │  - Confidence: Good (85%)    │  │
│  │  - 4 cycles of data          │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌─── StickyCard (P-3 to P+6) ───┐  │
│  │  Period Check-in               │  │
│  │  "We expected your period      │  │
│  │   around Jul 15. Did it arrive?"│  │
│  │  [Yes, on Jul 15]              │  │
│  │  [No, adjust date] [Not yet]   │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌───────────────────────────────┐  │
│  │  EndDatePromptCard (if open   │  │
│  │  entry exists from a prior    │  │
│  │  log without end date)        │  │
│  │  [Mark End Date] [Skip]       │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌───────────────────────────────┐  │
│  │  Next period in 5 days        │  │
│  │  around July 15               │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌─── Calendar ─────────────────┐   │
│  │  Su Mo Tu We Th Fr Sa        │   │
│  │  (11 day-type codes with     │   │
│  │   phase-based coloring)      │   │
│  └──────────────────────────────┘  │
│                                      │
│  [Log Period]  [Predictions]        │
│  [History]     [Analytics]          │
│                                      │
│  [Adjust Period Date]                │
└─────────────────────────────────────┘
```

### 3.2 Calendar Integration

#### 3.2.1 Calendar Component

The `Calendar` UI component (`src/components/ui/Calendar.tsx`) renders an interactive month grid with phase color coding, month navigation arrows, and configurable bounds:

```tsx
interface CalendarProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  markedDates?: Date[];
  minDate?: Date;
  maxDate?: Date;
  encodedDays?: Record<string, string>;
  animatingDates?: Set<string>;
}
```

Supporting features: disabled date cells outside month, animated cells with Reanimated `withSpring`, strikethrough style for cancelled days (`c`), dashed border for unconfirmed days (`u`), and dot markers for `markedDates` without a day type.

#### 3.2.2 Phase Color Mapping

The backend returns 11 day-type codes (not just 4 phases). The mobile maps them to distinct colors:

```typescript
const DAY_TYPE_COLORS: Record<string, { bg: string; text: string; strike?: boolean; dashed?: boolean }> = {
  P: { bg: '#F48FB1', text: '#FFFFFF' },        // Confirmed Period day
  p: { bg: '#FCE4EC', text: '#C62828' },         // Predicted Period day
  u: { bg: '#FFB3C1', text: '#CC3355', dashed: true },  // Unconfirmed pending
  c: { bg: '#E0E0E0', text: '#9E9E9E', strike: true }, // Cancelled (prediction with actual entry)
  F: { bg: '#CE93D8', text: '#FFFFFF' },         // Confirmed Fertile day
  f: { bg: '#F3E5F5', text: '#7B1FA2' },         // Predicted Fertile day
  O: { bg: '#81C784', text: '#FFFFFF' },         // Ovulation day
  o: { bg: '#E8F5E9', text: '#2E7D32' },         // Predicted Ovulation day
  L: { bg: '#90CAF9', text: '#FFFFFF' },         // Confirmed Luteal day
  l: { bg: '#E3F2FD', text: '#1565C0' },         // Predicted Luteal day
  T: { bg: '#42A5F5', text: '#FFFFFF' },          // Today marker
};

const LEGEND_KEYS = ['P', 'p', 'u', 'F', 'O', 'L'];
```

| Code | Label | Color | Notes |
|------|-------|-------|-------|
| `P` | Period | Pink (#F48FB1) | Confirmed logged period day |
| `p` | Predicted Period | Light pink (#FCE4EC) | Predicted period day |
| `u` | Unconfirmed | Coral (#FFB3C1) | Partial entry (no end date yet); dashed border |
| `c` | Cancelled | Grey (#E0E0E0) | Prediction superseded; strikethrough |
| `F` | Fertile | Purple (#CE93D8) | Confirmed fertile window |
| `f` | Predicted Fertile | Lavender (#F3E5F5) | Predicted fertile window |
| `O` | Ovulation | Green (#81C784) | Ovulation day |
| `o` | Predicted Ovulation | Light green (#E8F5E9) | Predicted ovulation day |
| `L` | Luteal | Blue (#90CAF9) | Confirmed luteal phase |
| `l` | Predicted Luteal | Light blue (#E3F2FD) | Predicted luteal phase |
| `T` | Today | Blue (#42A5F5) | Current day — always stamped |

#### 3.2.3 Calendar Data Flow

```
CycleDashboardScreen mount
│
├── useCycleCalendar(3, 3)
│   └── cycleService.getCalendar(3, 3)
│       └── GET /api/v1/cycle/calendar?months_back=3&months_forward=3
│
├── Response:
│   {
│     "days": {
│       "2026-07-01": "L",
│       "2026-07-02": "L",
│       "2026-07-03": "P",
│       "2026-07-04": "P",
│       ...
│     },
│     "next_period_in_days": 5,
│     "needs_checkin": true,
│     "predictions": { ... }
│   }
│
├── Calendar component renders month grid
│   ├── Weekday headers: Su Mo Tu We Th Fr Sa
│   ├── Day cells: background color based on day type, strikethrough for cancelled, dash for unconfirmed
│   ├── Today button jumps to current month with primary color highlight
│   └── Animated skeleton loading state (Reanimated withSpring)
│
└── "Next period in X days" stat card uses next_period_in_days
```

### 3.3 PredictionDetailCard

#### 3.3.1 Component

```tsx
interface PredictionDetailCardProps {
  prediction: PredictionDetail;
}
```

#### 3.3.2 Displayed Information

```
┌─────────────────────────────────────┐
│  🔮 Next Period Prediction          │
│                                     │
│  📅 Predicted Start: July 15, 2026  │
│  📅 Predicted End:   July 20, 2026  │
│                                     │
│  🌸 Fertile Window:                 │
│     Jul 25 - Jul 30                 │
│                                     │
│  ⭐ Confidence: Good (85%)          │
│  📊 Based on 4 logged cycles        │
│  🤖 Model: Global Model v3          │
└─────────────────────────────────────┘
```

### 3.4 StickyCard (Correction Window)

#### 3.4.1 Purpose

Display a "Period Check-in" prompt during the P-3 to P+6 window, asking the user whether their period arrived. The check-in window is computed server-side and returned as the `needs_checkin` boolean in the calendar response.

#### 3.4.2 Visibility Logic

```typescript
const showStickyCard = (() => {
  if (!prediction) return false;
  if (!calData?.needs_checkin) return false;  // Server-computed P-3 to P+6 window

  // Snoozed today?
  if (snoozeState) {
    const snoozedAt = new Date(snoozeState.snoozedAt);
    const snoozedDay = toDateStr(snoozedAt);
    const todayStr = toDateStr(today);
    if (snoozedDay === todayStr) return false;

    // Still within snooze period?
    const snoozeEnd = addDays(snoozedAt, snoozeState.dayOffset);
    if (today <= snoozeEnd) return false;
  }

  return true;
})();
```

#### 3.4.3 StickyCard Component

The card displays "Period Check-in" with the predicted date and three actions:

```tsx
<StickyCard
  predictedDate={prediction.predicted_next_period_start}
  predictionId={prediction.id}
  visible={showStickyCard}
  loading={logCorrection.isPending || logSnooze.isPending}
  onConfirm={handleConfirm}    // "Yes, on [date]" → logCorrection
  onAdjust={handleAdjust}      // "No, adjust date" → inline BottomSheet picker
  onSnooze={handleSnooze}      // "Not yet" → logSnooze
/>
```

The card uses Card with `elevated` prop, `primaryMuted` background, and a `primary` border. The adjust date button opens a nested BottomSheet with a DatePickerField (max date = today).

#### 3.4.4 Confirm Action

The confirm action sends only the start date (no end_date; the backend defaults or auto-closes):

```typescript
const handleConfirm = useCallback(
  (predictionId: string, confirmedDate: string) => {
    logCorrection.mutate({
      period_start_date: confirmedDate,
      corrected_prediction_id: predictionId,
      // period_end_date omitted — backend computes it
    }, { onSuccess: () => persistSnooze(null) });
  },
  [logCorrection, persistSnooze],
);
```

#### 3.4.5 Snooze Action

```typescript
const handleSnooze = useCallback(
  (predictionId: string, _dayOffset: number) => {
    const currentOffset = snoozeState?.predictionId === predictionId
      ? snoozeState.dayOffset + 1  // Increment snooze
      : 1;                          // First snooze
    logSnooze.mutate(
      { predictedCycleId: predictionId, dayOffset: currentOffset },
      { onSuccess: () =>
          persistSnooze({
            predictionId,
            dayOffset: currentOffset,
            snoozedAt: toDateStr(today),
          })
      },
    );
  },
  [logSnooze, persistSnooze, snoozeState, today],
);
```

#### 3.4.6 Snooze Persistence

```typescript
const SNOOZE_KEY = 'shecare.sticky_snooze';

interface SnoozeState {
  predictionId: string;
  dayOffset: number;
  snoozedAt: string;  // ISO date
}

// Load on mount:
useEffect(() => {
  AsyncStorage.getItem(SNOOZE_KEY).then((raw) => {
    if (raw) setSnoozeState(JSON.parse(raw) as SnoozeState);
  });
}, []);

// Persist on change:
const persistSnooze = useCallback((state: SnoozeState | null) => {
  setSnoozeState(state);
  if (state) {
    AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(state));
  } else {
    AsyncStorage.removeItem(SNOOZE_KEY);
  }
}, []);
```

### 3.5 Adjust Period Date BottomSheet

#### 3.5.1 Flow

Available from both CalendarScreen and CycleDashboardScreen. The calendar version sends a 5-day end_date guess but no prediction link; the dashboard version sends the prediction ID when available.

```
User taps "Adjust Period Date"
│
├── setShowOverride(true)
│
├── BottomSheet animates in
│
├── DatePickerField renders:
│   ├── Label: "When did your period start?"
│   ├── Native date picker
│   ├── Controlled via react-hook-form useForm
│   └── Pre-filled with today's date
│
├── User selects date
│
├── User taps "Save & Recalculate" (CalendarScreen) or "Confirm" (Dashboard)
│   ├── overrideForm.handleSubmit() validates
│   ├── handlePermanentOverride fires
│   │   ├── POST /api/v1/cycle/corrections
│   │   │   CalendarScreen sends:
│   │   │   {
│   │   │     "period_start_date": "2026-07-05",
│   │   │     "period_end_date": "2026-07-10",
│   │   │     "corrected_prediction_id": null
│   │   │   }
│   │   │   Dashboard sends (no end_date):
│   │   │   {
│   │   │     "period_start_date": "2026-07-05",
│   │   │     "corrected_prediction_id": "prediction-uuid-or-null"
│   │   │   }
│   │   ├── On success → setShowOverride(false)
│   │   │              → React Query invalidates cycle queries
│   │   │              → Dashboard refreshes with new prediction
│   │   └── On error → toast message
│   └── On invalid → inline error "Please select a date"
│
├── User taps backdrop or swipes down
│   └── setShowOverride(false) → sheet animates out
```

#### 3.5.2 Form Implementation

```tsx
const overrideSchema = z.object({
  overrideDate: z.string().min(1, 'Please select a date'),
});

type OverrideForm = z.infer<typeof overrideSchema>;

// In CalendarScreen — sends end_date, no prediction link:
const overrideForm = useForm<OverrideForm>({
  resolver: zodResolver(overrideSchema),
  defaultValues: { overrideDate: toDateStr(new Date()) },
});

const handlePermanentOverride = overrideForm.handleSubmit((data) => {
  const endDate = addDays(new Date(data.overrideDate), 5);
  logCorrection.mutate(
    {
      period_start_date: data.overrideDate,
      period_end_date: toDateStr(endDate),
      corrected_prediction_id: null,
    },
    { onSuccess: () => { setShowOverride(false); reset(); } },
  );
});
```

---

### 3.6 EndDatePromptCard (Mark End Date)

#### 3.6.1 Purpose

When a user logs a period without an end date (partial entry), the backend creates it with `period_end_date = None`. The calendar encodes those days as `u` (Unconfirmed) with a dashed border. The DashboardScreen shows an `EndDatePromptCard` reminding the user to supply the end date.

#### 3.6.2 Flow

```
Cycle entry logged without end_date
│
├── Backend: period_end_date = NULL, days encoded as "u" on calendar
├── Dashboard: EndDatePromptCard visible (checks endDateStore.periodStartDate)
│   ├── Shows "Period started X days ago — when did it end?"
│   ├── [Mark End Date] → opens MarkEndDateModal
│   │   ├── DatePickerField + Confirm button
│   │   ├── On confirm → PUT /api/v1/cycle/entries/{id} (via useUpdateCycleEntry)
│   │   │   { "period_end_date": "2026-07-10" }
│   │   ├── Cancels any local end-date notification
│   │   └── Clears endDateStore state
│   └── [Skip] → dismisses card, cancels notification
│
└── MarkEndDateModal also reachable via deep link from end-date push notification
```

#### 3.6.3 State Store

```typescript
// src/stores/endDateStore.ts
interface EndDateState {
  periodStartDate: string | null;
  entryId: string | null;
  notificationId: string | null;
  setPending: (data: { periodStartDate: string; entryId: string; notificationId?: string }) => void;
  clearPending: () => void;
}
```

---

## 4. Cycle Predictions Screen

### 4.1 Purpose

Show the single next prediction with countdown and detail card, plus optional override.

### 4.2 Data Fetching

```typescript
// useCyclePredictions hook
const { data, isLoading, error } = useQuery({
  queryKey: ['cycle', 'predictions'],
  queryFn: () => cycleService.getPredictions(),
  staleTime: 5 * 60 * 1000,  // 5 min
});

// Response shape:
interface PredictionListResponse {
  prediction: PredictionDetail | null;
  days_until: number | null;
  model_used: string;
  data_quality: string;
}
```

### 4.3 UI Layout

```
┌─────────────────────────────────────┐
│  Period Predictions                 │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │   ⏰ 5 days until your next   │  │
│  │     period                    │  │
│  │                               │  │
│  │   📅 Predicted Start: Jul 15 │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌─── PredictionDetailCard ───────┐  │
│  │  📅 Start: July 15, 2026       │  │
│  │  📅 End:   July 20, 2026       │  │
│  │  🌸 Fertile: Jul 25 - Jul 30   │  │
│  │  ⭐ Confidence: Good (85%)     │  │
│  │  🤖 Model: Global Model v3     │  │
│  │  📊 Data: 4 cycles             │  │
│  └────────────────────────────────┘  │
│                                      │
│  [Adjust Period Date]                │
│                                      │
│  --- Override BottomSheet ---        │
│  (same as Dashboard's)              │
└─────────────────────────────────────┘
```

### 4.4 Empty State (No Prediction)

```tsx
if (!data?.prediction) {
  return (
    <View>
      <Text variant="h1">Period Predictions</Text>
      <Text>
        Log your first period to get predictions.
      </Text>
      <Button label="Log Period" onPress={() => navigate('LogPeriod')} />
    </View>
  );
}
```

---

## 5. Cycle History Screen

### 5.1 Purpose

Display a paginated list of the user's logged cycle entries.

### 5.2 Data Fetching

```typescript
// Backend: GET /api/v1/cycle/entries?limit=20&offset=0
// Returns: CycleEntry[]

interface CycleEntry {
  id: string;
  user_id: string;
  period_start_date: string;
  period_end_date?: string | null;
  flow_intensity?: string | null;
  symptoms?: string[];
  mood_tags?: string[];
  energy_level?: number | null;
  notes?: string | null;
  created_at: string;
}
```

### 5.3 UI Layout

```
┌─────────────────────────────────────┐
│  Cycle History                      │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │  Jun 28 - Jul 2               │  │
│  │  Flow: Medium                 │  │
│  │  Symptoms: Cramps, Bloating   │  │
│  │  Mood: 😊 Happy               │  │
│  ├───────────────────────────────┤  │
│  │  May 31 - Jun 4               │  │
│  │  Flow: Heavy                  │  │
│  │  Symptoms: Headache, Fatigue  │  │
│  │  Mood: 😴 Tired               │  │
│  ├───────────────────────────────┤  │
│  │  May 3 - May 6                │  │
│  │  Flow: Light                  │  │
│  │  Symptoms: Cramps             │  │
│  │  Mood: 😰 Anxious             │  │
│  └───────────────────────────────┘  │
│                                      │
│  [Load More]                         │
│    or                                │
│  [Log New Period] (if empty)         │
└─────────────────────────────────────┘
```

### 5.4 Pagination

```typescript
const [page, setPage] = useState(0);
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['cycle', 'entries'],
  queryFn: ({ pageParam = 0 }) =>
    cycleService.getEntries({ limit: 20, offset: pageParam * 20 }),
  getNextPageParam: (lastPage, allPages) =>
    lastPage.length === 20 ? allPages.length : undefined,
});
```

---

## 6. Log Period Screen

### 6.1 Purpose

Record a new period entry with optional details.

### 6.2 Form Fields

```typescript
interface CycleEntryCreate {
  period_start_date: string;        // Required, ISO date
  period_end_date?: string;          // Optional, ISO date
  flow_intensity?: 'light' | 'medium' | 'heavy';
  symptoms?: string[];               // Multi-select
  mood_tags?: string[];              // Multi-select
  energy_level?: number;             // 1-5
  notes?: string;
}
```

### 6.3 Form Validation (zod)

```typescript
const entrySchema = z.object({
  period_start_date: z.string().min(1, 'Start date is required'),
  period_end_date: z.string().optional(),
  flow_intensity: z.enum(['light', 'medium', 'heavy']).optional(),
  symptoms: z.array(z.string()).optional(),
  mood_tags: z.array(z.string()).optional(),
  energy_level: z.number().min(1).max(5).optional(),
  notes: z.string().max(500).optional(),
});
```

### 6.4 Submission Flow

```
User fills form, taps "Save"
│
├── Validate → inline errors if invalid
│
├── POST /api/v1/cycle/entries
│   └── Body: { period_start_date, period_end_date, flow_intensity, symptoms, mood_tags, energy_level, notes }
│
├── On success (201):
│   ├── Toast: "Period logged"
│   ├── Invalidate cycle queries:
│   │   ├── queryClient.invalidateQueries({ queryKey: ['cycle'] })
│   │   └── → Dashboard, Calendar, Predictions all refresh
│   └── Navigate back
│
├── On error:
│   ├── 409 → Duplicate entry (already exists for this date)
│   └── 422 → Validation error
│
└── Offline → queue mutation for later sync
```

---

## 7. Calendar Screen

### 7.1 Purpose

Full-screen month calendar with 11-code phase color mapping, day selection bottom sheet, Adjust Period Date BottomSheet, and inline override.

### 7.2 Data Fetching

Uses the shared `useCycleCalendar` hook (no manual fetch/state management):

```typescript
const { data: calData, isLoading } = useCycleCalendar(3, 3);
const logCorrection = useLogCorrection();
const encodedDays = calData?.days ?? {};
```

### 7.3 UI Layout

```
┌──────────────────────────────────────┐
│ Calendar                     [Today] │
│                                      │
│   ◀  July 2026                  ▶   │
│                                      │
│  Su Mo Tu We Th Fr Sa                │
│            1   2   3   4             │
│   5   6   7   8   9  10  11         │
│  (phase colors: 11 codes,           │
│   cancelled=c strikethrough,         │
│   unconfirmed=u dashed border)      │
│                                      │
│  ● Period  ● Pred.Period  ● Unconf. │
│  ● Fertile  ● Ovulation   ● Luteal  │
│                                      │
│  [Cycle Dashboard]                   │
│  [Adjust Period Date]                │
└──────────────────────────────────────┘
```

### 7.4 Month Navigation + Today Button

```typescript
const [currentMonth, setCurrentMonth] = useState(new Date());
const [selectedDate, setSelectedDate] = useState<Date | null>(null);

// Header with Today button:
<Pressable onPress={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}>
  <Text>Today</Text>
</Pressable>

// Month arrows using SVG icons:
<Pressable onPress={() => setCurrentMonth(m => subMonths(m, 1))} />
<Text>{format(currentMonth, 'MMMM yyyy')}</Text>
<Pressable onPress={() => setCurrentMonth(m => addMonths(m, 1))} />
```

### 7.5 Day Grid with Phase Colors

```typescript
const days = useMemo(() => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  return eachDayOfInterval({ start: calStart, end: calEnd });
}, [currentMonth]);

// Each day cell resolves color from the 11-code DAY_TYPE_MAP:
const encoded = encodedDays[format(day, 'yyyy-MM-dd')];
const typeColor = DAY_TYPE_MAP[encoded ?? ''] ?? null;

const isCancelled = encoded === 'c';  // strikethrough + 0.5 opacity
```

The grid wraps the month into week rows. Days outside the current month are dimmed. Cancelled (`c`) days get strikethrough and 0.5 opacity. Unconfirmed (`u`) days get a dashed border.

### 7.6 Legend

The legend at the bottom shows only 6 codes: `P` (Period), `p` (Predicted Period), `u` (Unconfirmed), `F` (Fertile), `O` (Ovulation), `L` (Luteal), each with a colored dot.

### 7.7 Selected Day Bottom Sheet

When a day is tapped, a BottomSheet appears with:
- **Date header** (e.g., "July 10, 2026")
- **Phase badge** (colored pill with phase label, e.g. "Period Phase")
- **Quick Log** section with mood chip buttons: 😊 Happy, 😴 Tired, 😰 Anxious, 💪 Motivated
- **Symptoms** chip buttons: Cramps, Bloating, Headache, Fatigue, Nausea
- **"Log Period"** button
- **"View [Phase] Details"** → navigates to PhaseDetail screen

### 7.8 Adjust Period Date BottomSheet

An inline BottomSheet with `react-hook-form` + `zod` controlled DatePickerField. The submit button is labeled **"Save & Recalculate"** and posts a correction with a 5-day end_date guess but no prediction link:

```typescript
const handlePermanentOverride = handleSubmit((data) => {
  const endDate = addDays(new Date(data.overrideDate), 5);
  logCorrection.mutate({
    period_start_date: data.overrideDate,
    period_end_date: toDateStr(endDate),
    corrected_prediction_id: null,  // CalendarScreen doesn't link to a prediction
  }, {
    onSuccess: () => { setShowOverride(false); reset(); },
  });
});
```

### 7.9 Animated Loading Skeleton

While loading, the screen shows an animated skeleton grid with 35 cells, each using Reanimated `withDelay` and `withSpring` for a staggered reveal effect.

---

## 8. Cycle Analytics Screen

### 8.1 Purpose

Display cycle statistics and insights based on logged entries.

### 8.2 Data Fetching

```typescript
const analytics = await cycleService.getAnalytics();
// GET /api/v1/cycle/analytics

// Response:
interface CycleAnalytics {
  average_cycle_length_days?: number | null;
  shortest_cycle_days?: number | null;
  longest_cycle_days?: number | null;
  common_symptoms: Array<{ symptom: string; count: number }>;
  common_moods: Array<{ mood: string; count: number }>;
  total_entries: number;
}
```

### 8.3 UI Layout

```
┌─────────────────────────────────────┐
│  Cycle Analytics                    │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │  📊 Cycle Statistics          │  │
│  │                               │  │
│  │  Average Cycle:  28 days      │  │
│  │  Shortest Cycle: 26 days      │  │
│  │  Longest Cycle:  32 days      │  │
│  │  Total Logged:   6 cycles     │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌───────────────────────────────┐  │
│  │  Common Symptoms              │  │
│  │  ─────────────────────        │  │
│  │  Cramps   ████████████  80%   │  │
│  │  Bloating ████████      60%   │  │
│  │  Headache ██████        40%   │  │
│  │  Fatigue  ██████        40%   │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌───────────────────────────────┐  │
│  │  Common Moods                 │  │
│  │  ─────────────────────        │  │
│  │  Happy    ████████████  80%   │  │
│  │  Tired    ████████      60%   │  │
│  │  Anxious  ██████        40%   │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## 9. Predictions Engine

### 9.1 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    PREDICTION PIPELINE                    │
│                                                          │
│  User Action                              ┌──────────┐   │
│  ├── Log period entry                      │Trigger   │   │
│  ├── Log correction          ──────────────▶Prediction│   │
│  ├── Complete onboarding                   │Recompute │   │
│  └── Crontab (daily)                       └────┬─────┘   │
│                                                  │         │
│        ┌─────────────────────────────────────────┘         │
│        ▼                                                     │
│  ┌──────────────────────────────────────┐                   │
│  │         CycleService                  │                   │
│  │  get_all_entries() → fetch all       │                   │
│  │                                    │                   │
│  │  ┌──────────────┐  ┌──────────────┐ │                   │
│  │  │ Global Model │  │   Fallback   │ │                   │
│  │  │ (JSON)       │  │  Heuristics  │ │                   │
│  │  └──────┬───────┘  └──────┬───────┘ │                   │
│  │         │                 │          │                   │
│  │         ▼                 ▼          │                   │
│  │  ┌─────────────────────────────┐     │                   │
│  │  │   PredictionSelector        │     │                   │
│  │  │   - Enough data? → Global   │     │                   │
│  │  │   - Not enough? → Fallback  │     │                   │
│  │  └─────────────┬───────────────┘     │                   │
│  └────────────────┼─────────────────────┘                   │
│                   ▼                                         │
│  ┌──────────────────────────────────────┐                   │
│  │         PredictedCycle record        │                   │
│  │  - predicted_next_period_start       │                   │
│  │  - model_version, confidence_score   │                   │
│  │  - training_data_points, etc.        │                   │
│  └──────────────────────────────────────┘                   │
│                   │                                         │
│                   ▼                                         │
│  ┌──────────────────────────────────────┐                   │
│  │         Calendar Service             │                   │
│  │  - Compute phase encodings (P/F/O/L) │                   │
│  │  - Return dictionary of day → phase   │                   │
│  └──────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 Global Model Pipeline (JSON)

#### 9.2.1 Global Model (Backend)

The global prediction model is a linear regression model stored as JSON with scaler parameters:

```python
# app/integrations/prediction_engine.py

class GlobalModel:
    """Cycle prediction using global population statistics + user-specific scaling."""

    def __init__(self, model_data: dict):
        self.version = model_data["version"]
        self.feature_names = model_data["feature_names"]  # ["avg_cycle_length", "cycle_std_dev", "total_cycles", ...]
        self.coefficients = model_data["coefficients"]      # {"avg_cycle_length": 0.92, ...}
        self.intercept = model_data.get("intercept", 0)
        self.scaler = model_data["scaler"]                  # {"mean": {...}, "std": {...}}
        self.rmse = model_data.get("rmse", 3.5)             # Root mean squared error in days

    def predict(self, features: dict) -> float:
        """Predict next cycle length in days."""
        # 1. Normalize features using scaler
        normalized = {}
        for name in self.feature_names:
            mean = self.scaler["mean"].get(name, 0)
            std = self.scaler["std"].get(name, 1)
            normalized[name] = (features.get(name, mean) - mean) / std

        # 2. Compute linear prediction
        prediction = self.intercept
        for name in self.feature_names:
            prediction += self.coefficients.get(name, 0) * normalized.get(name, 0)

        return prediction
```

#### 9.2.2 Feature Extraction

```python
def extract_features(user_entries: list[CycleEntry]) -> dict:
    """Extract features from user's cycle history for prediction."""

    if len(user_entries) < 2:
        return None  # Not enough data

    # Sort entries by date
    sorted_entries = sorted(user_entries, key=lambda e: e.period_start_date)

    # Compute cycle lengths
    cycle_lengths = []
    period_lengths = []
    for i in range(1, len(sorted_entries)):
        gap = (sorted_entries[i].period_start_date - sorted_entries[i-1].period_start_date).days
        cycle_lengths.append(gap)

    for entry in sorted_entries:
        if entry.period_end_date:
            p_len = (entry.period_end_date - entry.period_start_date).days
            period_lengths.append(p_len)

    if not cycle_lengths:
        return None

    import statistics

    features = {
        "avg_cycle_length": statistics.mean(cycle_lengths),
        "cycle_std_dev": statistics.stdev(cycle_lengths) if len(cycle_lengths) > 1 else 0,
        "min_cycle_length": min(cycle_lengths),
        "max_cycle_length": max(cycle_lengths),
        "avg_period_length": statistics.mean(period_lengths) if period_lengths else 5,
        "total_cycles": len(cycle_lengths),
        "recency_weighted_avg": compute_recency_weighted_avg(cycle_lengths),
    }

    return features
```

#### 9.2.3 Confidence Score

```python
def compute_confidence(features: dict, model_rmse: float) -> tuple[float, str]:
    """Compute confidence score and label."""

    # Factors affecting confidence:
    # 1. Number of cycles logged
    # 2. Standard deviation (regularity)
    # 3. Model RMSE

    n_cycles = features["total_cycles"]
    std_dev = features["cycle_std_dev"]

    # Base score from data quantity
    if n_cycles >= 6:
        base = 0.9
    elif n_cycles >= 4:
        base = 0.7
    elif n_cycles >= 2:
        base = 0.5
    else:
        base = 0.3

    # Adjust for regularity
    regularity_penalty = min(std_dev / 28, 0.4)  # Max 40% penalty

    # Adjust for model accuracy
    accuracy_factor = max(0, 1 - (model_rmse / 14))  # RMSE of 14 days → 0

    score = base * (1 - regularity_penalty) * accuracy_factor
    score = min(max(score, 0), 1)  # Clamp [0, 1]

    # Label
    if score >= 0.85:
        label = "Excellent"
    elif score >= 0.71:
        label = "Good"
    elif score >= 0.51:
        label = "Fair"
    elif score >= 0.31:
        label = "Uncertain"
    else:
        label = "Very uncertain"

    return round(score, 2), label
```

#### 9.2.4 Mobile Global Model Client

```typescript
// mobile/src/services/ml/globalModel.ts

class GlobalModelClient {
  private model: GlobalModel | null = null;
  private currentVersion: number = 0;

  async ensureLatest(): Promise<void> {
    try {
      const status = await cycleService.getModelStatus();
      // GET /api/v1/cycle/models/status
      // { current_version: 3, download_url: "/api/v1/cycle/models/download/global_model_v3.json" }

      if (status.current_version > this.currentVersion) {
        const modelData = await cycleService.downloadModel(status.currentVersion);
        // GET /api/v1/cycle/models/download/global_model_v3.json

        this.model = modelData;
        this.currentVersion = status.currentVersion;
      }
    } catch {
      // Keep existing model if download fails
    }
  }

  predict(features: Record<string, number>): number {
    if (!this.model) throw new Error('Model not loaded');

    let prediction = this.model.coefficients._intercept || 0;
    for (const name of this.model.feature_names) {
      const mean = this.model.scaler.mean[name] || 0;
      const std = this.model.scaler.std[name] || 1;
      const normalized = ((features[name] || mean) - mean) / std;
      prediction += (this.model.coefficients[name] || 0) * normalized;
    }
    return prediction;
  }
}

export const globalModelClient = new GlobalModelClient();
```

### 9.3 Fallback Heuristics

When insufficient data exists (< 3 cycles) or no global model is loaded, the system uses a median-based fallback:

```python
# app/integrations/prediction_engine.py

def fallback_prediction(
    cycle_lengths: list[int],
    avg_error: float | None = None,
) -> tuple[int, float, int]:
    """Return (predicted_length, confidence, window_days)."""
    if len(cycle_lengths) >= 3:
        base = int(median(cycle_lengths))
        confidence = 0.40
    else:
        base = 28  # default
        confidence = 0.20

    if avg_error is not None and abs(avg_error) > 0.1:
        base = int(round(base + avg_error))
        confidence = max(0.15, confidence - 0.05)

    base = max(20, min(45, base))
    pred_std = float(np.std(cycle_lengths)) if len(cycle_lengths) >= 2 else 5.0
    window = max(3, min(10, int(pred_std)))

    return base, round(confidence, 2), window
```

The backend `CycleService._predict_with_fallback()` applies the fallback:
- Gets cycle lengths from entries (20-45 day gap filter)
- Calls `fallback_prediction(cycle_lengths, avg_error)` to get predicted length + confidence
- Computes fertile window as ovulation_day ± range (fertile_start = next_start - 14, fertile_end = fertile_start + 5)
- Returns a `PredictionResult` dataclass

### 9.4 Prediction Service (Backend)

All prediction logic lives in `CycleService` (no separate `PredictionService` class). The main entry point is `compute_predictions()`:

```python
# app/modules/cycle/services.py — inside CycleService

async def compute_predictions(self, user_id: uuid.UUID) -> PredictedCycle:
    entries = await self._get_recent_entries(user_id, limit=12)
    if len(entries) < 1:
        raise InsufficientDataError("Need at least 1 cycle entry")

    model = await self._load_active_model()  # JSON model from DB path
    if model is not None and len(entries) >= 3:
        result = await self._predict_with_global_model(user_obj, entries, model)
    else:
        result = self._predict_with_fallback(entries, user_obj)

    return await self._upsert_prediction(user_id, result)
```

The global model path (`_predict_with_global_model`):
- Loads the active JSON model via `SystemConfig` table (key `global_model_path`)
- Computes cycle lengths, period lengths, user BMI bucket, age bucket, stress level
- Calls `apply_global_model()` from `prediction_engine.py` which applies linear regression using stored coefficients + scaler
- Fertile window: `next_start - 14` to `fertile_start + 5`
- Median period length used for predicted end date

The `_upsert_prediction` method:
- Deactivates the previous active prediction (sets `is_active = False`)
- Creates a new `PredictedCycle` record with the computed dates
- The `prediction_window_days` is set from `cycle_length_std_dev` if > 3.5 days

Auto-link on new entry (`_try_auto_link_prediction`):
- When a new `CycleEntry` is created, the service checks if its start date falls within `auto_link_window_days` of any active prediction
- If matched, sets `prediction.actual_cycle_entry_id`, `prediction_error_days`, and marks `entry.is_correction = True`
- Updates user ML metrics (avg_prediction_error_days, total_cycles_logged, is_dirty_for_retraining)

### 9.5 Correction Logic

#### 9.5.1 Backend: `POST /api/v1/cycle/corrections`

The route accepts an optional `X-Client-Updated-At` header for conflict detection, and `symptoms` in the body:

```python
@router.post("/corrections", response_model=CorrectionResponse, status_code=201)
async def create_correction(
    payload: CorrectionCreate,
    current_user: CurrentUser,
    svc: CycleServiceDep,
    x_client_updated_at: str | None = Header(None, alias="X-Client-Updated-At"),
) -> CorrectionResponse:
    corrected_id = uuid.UUID(payload.corrected_prediction_id) if payload.corrected_prediction_id else None
    entry = await svc.log_correction(
        user_id=current_user.id,
        period_start_date=payload.period_start_date,
        period_end_date=payload.period_end_date,
        symptoms=payload.symptoms,
        corrected_prediction_id=corrected_id,
        client_updated_at=x_client_updated_at,
    )
    avg_period_length = await svc.get_avg_period_length(current_user.id)
    resp = CorrectionResponse.model_validate(entry)
    resp.avg_period_length = avg_period_length  # Returned for client-side display
    return resp
```

**Service (simplified):**
```python
async def log_correction(self, user_id, period_start_date, period_end_date=None,
                         symptoms=None, corrected_prediction_id=None, client_updated_at=None):
    # 1. Conflict detection: reject if server has newer data
    if client_updated_at:
        latest = await self._get_latest_entry(user_id)
        if latest and latest.created_at > client_updated_at:
            raise CycleConflictError("Server has newer data")

    # 2. Create cycle entry
    entry = CycleEntry(user_id=user_id, period_start_date=period_start_date,
                       period_end_date=period_end_date, symptoms=symptoms or [],
                       is_correction=corrected_prediction_id is not None,
                       corrected_prediction_id=corrected_prediction_id)

    # 3. Auto-close any open entry that ended before this period
    await self._auto_close_open_entry(user_id, period_start_date)

    # 4. If linked to a prediction, record error and update ML metrics
    if corrected_prediction_id:
        prediction = await self.get_prediction_by_id(corrected_prediction_id, user_id)
        error = (period_start_date - prediction.predicted_next_period_start).days
        prediction.actual_cycle_entry_id = entry.id
        prediction.prediction_error_days = error
        await self._update_user_ml_metrics(user_id, error)

    await self.db.commit()

    # 5. Recompute predictions asynchronously
    await self.compute_predictions(user_id)

    return entry
```

#### 9.5.2 Correction Window (P-3 to P+6)

The correction sticky card shows only when today is between 3 days before and 6 days after the predicted period start. This is the optimal window because:

- **P-3:** PMS symptoms typically begin, user may feel period coming
- **P+6:** Period should have started by now if prediction was accurate
- **Outside window:** User can still use "Adjust Period Date" (permanent override button)

### 9.6 Snooze Logic

#### 9.6.1 Backend: `POST /api/v1/cycle/snooze`

```python
@router.post("/snooze", status_code=201)
async def log_snooze(payload: SnoozeCreate, current_user: CurrentUser, svc: CycleServiceDep):
    result = await svc.log_snooze(
        user_id=current_user.id,
        predicted_cycle_id=payload.predicted_cycle_id,
        day_offset=payload.day_offset,
    )
    return SnoozeResponse.model_validate(result)
```

**Service:**
```python
async def log_snooze(self, user_id: uuid.UUID, predicted_cycle_id: uuid.UUID, day_offset: int):
    snooze = SnoozeEvent(
        user_id=user_id,
        predicted_cycle_id=predicted_cycle_id,
        day_offset=day_offset,
    )
    self.db.add(snooze)

    # If snoozed past window, auto-correct
    prediction = await self.db.get(PredictedCycle, predicted_cycle_id)
    if prediction:
        predicted_date = prediction.predicted_next_period_start
        if day_offset >= 7:  # Snoozed 7+ days → period likely started
            # Auto-create correction entry
            await self.log_correction(
                user_id=user_id,
                period_start=predicted_date + timedelta(days=day_offset),
                period_end=None,
                corrected_prediction_id=predicted_cycle_id,
            )

    await self.db.commit()
    return snooze
```

---

## 10. Notifications

### 10.1 Check-in Push Notification

A daily Celery beat task sends push notifications to users whose predicted period starts in 3 days (P-3):

```python
# app/tasks/checkin.py

@celery_app.task(name="checkin_daily_push")
def checkin_push_notification():
    """Send push to users at P-3 window."""

    today = date.today()
    target_date = today + timedelta(days=3)  # P-3

    # Find predictions 3 days away that haven't had checkin sent
    predictions = db.execute(
        select(PredictedCycle)
        .where(PredictedCycle.predicted_next_period_start == target_date)
        .where(PredictedCycle.checkin_sent == False)  # noqa: E712
        .where(PredictedCycle.is_active == True)  # noqa: E712
    ).scalars().all()

    for prediction in predictions:
        user = db.get(User, prediction.user_id)
        if not user or not user.fcm_tokens:
            continue

        # Send via FCM
        fcm_client.send_notification(
            tokens=user.fcm_tokens,
            title="Period Check-in",
            body="Your period may start soon. How are you feeling?",
            data={
                "type": "checkin",
                "screen": "CycleDashboard",
                "prediction_id": str(prediction.id),
            },
        )

        # Mark as sent
        prediction.checkin_sent = True

    db.commit()
```

### 10.2 Notification Deep Link

When the user taps the notification, the app opens and navigates to CycleDashboard:

```typescript
// mobile/src/app/App.tsx
Notifications.addNotificationResponseReceivedListener(response => {
  const data = response.notification.request.content.data;
  if (data?.type === 'checkin') {
    navigate('Main', {
      screen: 'Calendar',
      params: { screen: 'CycleDashboard' },
    });
  }
});
```

### 10.3 Local Notification Scheduling

The app schedules local notifications for:
- **Period reminder:** On predicted start date
- **Fertile window reminder:** At predicted fertile window
- **Mood reminder:** Daily at configurable time
- **Water reminder:** Periodic throughout day
- **Sync reminder:** If offline data not synced for 24h

---

## 11. Database Schema

### 11.1 Cycle Entries

```sql
-- app/modules/cycle/models.py
CREATE TABLE cycle_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),

    period_start_date   DATE NOT NULL,
    period_end_date     DATE,
    flow_intensity      VARCHAR(10),          -- 'light', 'medium', 'heavy'
    symptoms            JSONB DEFAULT '[]'::jsonb,
    mood_tags           JSONB DEFAULT '[]'::jsonb,
    energy_level        INTEGER,              -- 1-5
    notes               TEXT,

    corrected_prediction_id UUID REFERENCES predicted_cycles(id),
    is_correction       BOOLEAN NOT NULL DEFAULT FALSE,

    -- Sync fields
    client_updated_at   TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, period_start_date)  -- One entry per start date
);

CREATE INDEX idx_cycle_user ON cycle_entries(user_id, period_start_date DESC);
CREATE INDEX idx_cycle_active ON cycle_entries(user_id, is_active);
```

### 11.2 Predicted Cycles

```sql
-- app/modules/cycle/models.py
CREATE TABLE predicted_cycles (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                         UUID NOT NULL REFERENCES users(id),

    predicted_next_period_start     DATE NOT NULL,
    predicted_period_end            DATE,
    predicted_fertile_window_start  DATE,
    predicted_fertile_window_end    DATE,

    model_version                   VARCHAR(50),       -- "3" or "fallback"
    model_type                      VARCHAR(20),       -- "global_model", "fallback"
    confidence_score                REAL,
    confidence_label                VARCHAR(10),       -- "high", "medium", "low"
    training_data_points            INTEGER NOT NULL DEFAULT 0,
    prediction_window_days          INTEGER,

    actual_cycle_entry_id           UUID REFERENCES cycle_entries(id),
    prediction_error_days           INTEGER,           -- Computed when actual logged
    checkin_sent                    BOOLEAN NOT NULL DEFAULT FALSE,

    is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pred_user ON predicted_cycles(user_id, is_active);
CREATE INDEX idx_pred_checkin ON predicted_cycles(predicted_next_period_start, checkin_sent)
    WHERE checkin_sent = FALSE;
```

### 11.3 Snooze Events

```sql
-- app/modules/cycle/models.py
CREATE TABLE snooze_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    predicted_cycle_id  UUID NOT NULL REFERENCES predicted_cycles(id),
    snoozed_at          DATE NOT NULL DEFAULT CURRENT_DATE,
    day_offset          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snooze_user ON snooze_events(user_id, snoozed_at);
```

### 11.4 System Config

```sql
-- app/modules/cycle/models.py
CREATE TABLE system_config (
    key     VARCHAR(100) PRIMARY KEY,
    value   TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed data: current global model version
INSERT INTO system_config (key, value) VALUES ('global_model_version', '3');
```

### 11.5 Entity Relationship Diagram

```
┌─────────────┐
│    users    │
│ id (PK)     │
│ avg_cycle   │
│ cycle_std   │
│ total_cycles│
│ is_dirty    │
└──────┬──────┘
       │ 1
       │
       ├───────────────────┐
       │                   │
┌──────▼──────────┐  ┌────▼───────────┐
│  cycle_entries  │  │ predicted_cycle│
│                 │  │                │
│ id (PK)        │  │ id (PK)        │
│ user_id (FK)   │  │ user_id (FK)   │
│ period_start   │  │ next_start     │
│ period_end     │  │ fertile_window │
│ flow_intensity │  │ confidence     │
│ symptoms []    │  │ model_version  │
│ mood_tags []   │  │ checkin_sent   │
│ is_correction  │  │ is_active      │
│ corrected_pred │  └───────┬────────┘
└────────────────┘          │
       │                    │
       │ 1                  │ 1
       │                    │
       │  ┌─────────────────┘
       │  │
       │  │  ┌──────────────────┐
       │  │  │  snooze_events    │
       │  │  │                  │
       │  └──│ predicted_id (FK)│
       │     │ day_offset       │
       │     │ snoozed_at       │
       │     └──────────────────┘
       │
       │ (optional FK from predicted → actual)
       │
       └────────────────────────┐
                                │
                     ┌──────────▼──────────┐
                     │  system_config       │
                     │  key (PK)            │
                     │  value               │
                     └─────────────────────┘
```

---

## 12. API Reference

### 12.1 Cycle Endpoints

| Method | Endpoint | Description | Auth | Pagination |
|--------|----------|-------------|------|------------|
| POST | `/api/v1/cycle/entries` | Log period entry | Access | — |
| GET | `/api/v1/cycle/entries` | List entries | Access | Offset (limit, offset) |
| GET | `/api/v1/cycle/entries/{id}` | Get single entry | Access | — |
| PUT | `/api/v1/cycle/entries/{id}` | Update entry | Access | — |
| DELETE | `/api/v1/cycle/entries/{id}` | Soft-delete entry | Access | — |
| GET | `/api/v1/cycle/predictions` | Get next prediction | Access | — |
| GET | `/api/v1/cycle/predictions/history` | Past predictions vs actual dates | Access | — |
| GET | `/api/v1/cycle/analytics` | Cycle statistics | Access | — |
| POST | `/api/v1/cycle/corrections` | Log correction | Access | — |
| POST | `/api/v1/cycle/snooze` | Log "Not yet" | Access | — |
| GET | `/api/v1/cycle/calendar` | Calendar (encoded) | Access | — |
| GET | `/api/v1/cycle/models/status` | Model version | Access | — |
| GET | `/api/v1/cycle/models/download/{filename}` | Download model | Access | — |

### 12.2 Request/Response Examples

**POST /api/v1/cycle/entries**
```json
// Request:
{
  "period_start_date": "2026-07-10",
  "period_end_date": "2026-07-14",
  "flow_intensity": "medium",
  "symptoms": ["cramps", "bloating"],
  "mood_tags": ["tired"],
  "energy_level": 2
}

// Response 201:
{
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "period_start_date": "2026-07-10",
    "period_end_date": "2026-07-14",
    "flow_intensity": "medium",
    "symptoms": ["cramps", "bloating"],
    "mood_tags": ["tired"],
    "energy_level": 2,
    "is_correction": false,
    "created_at": "2026-07-10T12:00:00Z"
  },
  "message": "ok"
}
```

**GET /api/v1/cycle/calendar?months_back=3&months_forward=3**
```json
// Response 200:
{
  "data": {
    "days": {
      "2026-04-10": "L",
      "2026-04-11": "P",
      "2026-04-12": "P",
      "...": "...",
      "2026-07-10": "L",
      "2026-07-11": "L",
      "2026-07-15": "P",
      "2026-07-16": "P"
    },
    "next_period_in_days": 5,
    "needs_checkin": true,
    "predictions": {
      "id": "uuid",
      "predicted_next_period_start": "2026-07-15",
      "predicted_period_end": "2026-07-20",
      "predicted_fertile_window_start": "2026-07-25",
      "predicted_fertile_window_end": "2026-07-30",
      "model_type": "global_model",
      "confidence_score": 0.85,
      "confidence_label": "Good",
      "training_data_points": 4,
      "prediction_window_days": 28
    }
  },
  "message": "ok"
}
```

**POST /api/v1/cycle/corrections**
```json
// Request:
{
  "period_start_date": "2026-07-14",
  "period_end_date": "2026-07-19",
  "corrected_prediction_id": "prediction-uuid"
}

// Response 201:
{
  "data": {
    "id": "entry-uuid",
    "period_start_date": "2026-07-14",
    "period_end_date": "2026-07-19",
    "is_correction": true,
    "corrected_prediction_id": "prediction-uuid",
    "created_at": "2026-07-14T08:00:00Z"
  },
  "message": "ok"
}
```

**POST /api/v1/cycle/snooze**
```json
// Request:
{
  "predicted_cycle_id": "prediction-uuid",
  "day_offset": 1
}

// Response 201:
{
  "data": {
    "id": "snooze-uuid",
    "predicted_cycle_id": "prediction-uuid",
    "snoozed_at": "2026-07-14",
    "day_offset": 1,
    "created_at": "2026-07-14T08:00:00Z"
  },
  "message": "ok"
}
```

**GET /api/v1/cycle/analytics**
```json
// Response 200:
{
  "data": {
    "average_cycle_length_days": 28.5,
    "shortest_cycle_days": 26,
    "longest_cycle_days": 32,
    "common_symptoms": [
      { "symptom": "cramps", "count": 5 },
      { "symptom": "bloating", "count": 3 },
      { "symptom": "headache", "count": 2 }
    ],
    "common_moods": [
      { "mood": "happy", "count": 4 },
      { "mood": "tired", "count": 3 }
    ],
    "total_entries": 6
  },
  "message": "ok"
}
```

---

## 13. Offline Behavior

### 13.1 Cycle Module Offline Strategy

| Feature | Online | Offline |
|---------|--------|---------|
| Calendar view | API fetch + cache | Stale cache (TanStack Query) |
| Predictions | API fetch | Cached prediction |
| Log period | POST to API | Queue for sync |
| Correction | POST to API | Queue for sync |
| Analytics | API fetch | Cached analytics |
| Model download | Download new model | Keep existing model |
| StickyCard | Live prediction | Cached prediction |
| Calendar Screen | Full data with phases | Stale encoded days |

### 13.2 Cache Configuration

```typescript
// TanStack Query cache times for cycle queries
{
  cycleCalendar: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  cyclePredictions: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  cycleEntries: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  cycleAnalytics: { staleTime: 10 * 60 * 1000, gcTime: 60 * 60 * 1000 },
}
```

### 13.3 Offline Queue

```typescript
interface OfflineMutation {
  id: string;
  key: string[];
  fn: () => Promise<any>;
  timestamp: number;
}

// Queue is persisted in AsyncStorage
const OFFLINE_QUEUE_KEY = 'shecare.offlineQueue';

// On reconnect:
// 1. Process all queued mutations in FIFO order
// 2. After each success → invalidate related queries
// 3. After all processed → pull server changes
```

### 13.4 Conflict Resolution (Cycle Entries)

Since cycle entries have `UNIQUE(user_id, period_start_date)` constraint:

1. If offline entry has the same `period_start_date` as an existing server entry:
   - Compare `client_updated_at` vs `updated_at`
   - Last-write-wins
   - Return server record to client

2. If the user corrected while offline and a new prediction was computed server-side:
   - The correction is applied after the prediction
   - Prediction is recomputed on server

---

## 14. Synchronization

### 14.1 Cycle Sync Flow

```
Cycle entry logged offline
│
├── Store in local SQLite (if applicable)
│
├── Add to offline queue:
│   { type: 'CYCLE_ENTRY_CREATE', data: entryData, client_updated_at: now }
│
├── Show optimistic UI update
│
└── Wait for connectivity
    │
    ├── App foreground → trigger sync
    │
    ├── Sync engine processes queue
    │   ├── POST /api/v1/cycle/entries
    │   ├── Success → remove from queue, update local
    │   ├── 409 Conflict → resolve (LWW), update local
    │   └── Error → retry with backoff
    │
    └── After queue processed:
        ├── GET /api/v1/sync/changes?since=<lastSync>
        ├── Apply server changes locally
        └── Update last sync timestamp
```

### 14.2 Sync Fields

Tables with offline sync support include a `client_updated_at` timestamp:

| Table | client_updated_at | Sync Strategy |
|-------|-------------------|---------------|
| cycle_entries | Yes | Upsert + LWW |
| user_onboarding | Yes | Upsert + LWW |
| mood_logs | Yes | Upsert + LWW |
| journal_entries | Yes | Upsert + LWW |

### 14.3 Backend Sync Endpoints

```python
# POST /api/v1/sync/batch
# Push a batch of offline operations
async def batch_sync(operations: list[SyncOperation], user_id: uuid.UUID):
    results = []
    for op in operations:
        result = await apply_operation(user_id, op)
        results.append(result)
    return results

# GET /api/v1/sync/changes?since=2026-07-01T00:00:00Z
# Pull server changes since timestamp
async def get_changes(user_id: uuid.UUID, since: datetime):
    changes = []
    for table in SYNCABLE_TABLES:
        records = await get_updated_since(user_id, table, since)
        for record in records:
            changes.append({
                "table": table,
                "record_id": str(record.id),
                "data": serialize(record),
                "updated_at": record.updated_at.isoformat(),
            })
    return {"changes": changes, "server_time": datetime.now(tz=UTC).isoformat()}
```

---

## 15. Model Management

### 15.1 Model Versioning

The global prediction model follows a versioning scheme:

```
storage/models/prod/
├── global_model_v1.json
├── global_model_v2.json
├── global_model_v3.json     ← Current
└── global_model_v4.json     ← Staged for rollout
```

### 15.2 Model Update Flow

```
Mobile App startup
│
├── Check current model version (cached locally)
│
├── GET /api/v1/cycle/models/status
│   ├── Response: { current_version: 3, download_url: "..." }
│   │
│   └── current_version > cached_version?
│       ├── Yes → download new model
│       │   ├── GET /api/v1/cycle/models/download/global_model_v3.json
│       │   ├── Validate checksum (SHA-256)
│       │   ├── Store in local filesystem
│       │   └── Update cached version
│       └── No → use existing model
│
└── Model ready for predictions
```

### 15.3 Background Model Update

```typescript
// mobile/src/services/ml/modelUpdater.ts

export const modelUpdater = {
  async checkForUpdate(): Promise<{ wellness: boolean; minilm: boolean }> {
    const result = { wellness: false, minilm: false };

    // Check wellness classifier model
    try {
      const versionResp = await api.get('/api/v1/models/wellness-classifier/version');
      const serverVersion = versionResp.data?.data?.version;
      const localVersion = await AsyncStorage.getItem('wellness.model.version');

      if (serverVersion && serverVersion !== localVersion) {
        // Download new model
        const modelResp = await api.get(
          `/api/v1/models/wellness-classifier/${serverVersion}.onnx`,
          { responseType: 'arraybuffer' }
        );
        // Store locally...
        result.wellness = true;
      }
    } catch { /* ignore */ }

    return result;
  }
};
```

### 15.4 Model Retraining Signal

The user's `is_dirty_for_retraining` flag is set when:
- A correction is logged (prediction was wrong)
- A new cycle entry is added
- Multiple snoozes for the same prediction

This flag signals the backend to include this user's data in the next global model training batch.

---

## 16. Error Handling

### 16.1 Cycle Module Errors

| Scenario | HTTP | Error Code | Client Handling |
|----------|------|------------|-----------------|
| Entry not found | 404 | ENTRY_NOT_FOUND | Show "Cycle entry not found" |
| No prediction | 200 (null) | — | Show "Log your first period" |
| Duplicate date | 409 | DUPLICATE_ENTRY | Show "Entry already exists" |
| Invalid date range | 422 | VALIDATION_ERROR | Show inline validation |
| Offline correction | — | — | Queue for sync, show toast |
| Model download fail | 500 | MODEL_DOWNLOAD_FAILED | Keep existing model |
| Prediction fail | 200 (fallback) | — | Show fallback with lower confidence |

### 16.2 Error Response Format

```json
{
  "error": {
    "code": "DUPLICATE_ENTRY",
    "details": "A cycle entry already exists for this period start date",
    "request_id": "uuid-for-tracing"
  }
}
```

---

## 17. Key React Query Hooks

```typescript
// mobile/src/services/queries/cycle.ts

// Calendar data (3 months back, 3 months forward)
export function useCycleCalendar(monthsBack = 3, monthsForward = 3) {
  return useQuery({
    queryKey: ['cycle', 'calendar', monthsBack, monthsForward],
    queryFn: () => cycleService.getCalendar(monthsBack, monthsForward),
    staleTime: 5 * 60 * 1000,
  });
}

// Next prediction (single)
export function useCyclePredictions() {
  return useQuery({
    queryKey: ['cycle', 'predictions'],
    queryFn: () => cycleService.getPredictions(),
    staleTime: 5 * 60 * 1000,
  });
}

// Cycle entries with pagination
export function useCycleEntries(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['cycle', 'entries', params],
    queryFn: () => cycleService.getEntries(params),
    staleTime: 2 * 60 * 1000,
  });
}

// Cycle analytics
export function useCycleAnalytics() {
  return useQuery({
    queryKey: ['cycle', 'analytics'],
    queryFn: () => cycleService.getAnalytics(),
    staleTime: 10 * 60 * 1000,
  });
}

// Log correction mutation
export function useLogCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CorrectionData) => cycleService.logCorrection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycle'] }); // Refresh ALL cycle queries
    },
  });
}

// Log snooze mutation
export function useLogSnooze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SnoozeData) => cycleService.logSnooze(data.predictedCycleId, data.dayOffset),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycle', 'predictions'] });
    },
  });
}
```

---

## Appendix A: Complete Correction Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CORRECTION FLOW                              │
│                                                                     │
│  User action triggers correction                                    │
│                                                                     │
│  1. StickyCard "Yes, it started"                                    │
│     OR                                                              │
│  2. "Adjust Period Date" button → BottomSheet → Confirm             │
│     OR                                                              │
│  3. LogPeriodScreen → Save (new entry)                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Mobile:                                                     │   │
│  │  POST /api/v1/cycle/corrections                             │   │
│  │  {                                                          │   │
│  │    "period_start_date": "2026-07-14",                      │   │
│  │    "period_end_date": "2026-07-19",                        │   │
│  │    "corrected_prediction_id": "pred-uuid"                  │   │
│  │  }                                                          │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────┐   │
│  │ Backend: cycle_service.log_correction()                     │   │
│  │                                                             │   │
│  │  1. Create CycleEntry (is_correction=true)                  │   │
│  │  2. Deactivate old prediction (is_active=false)             │   │
│  │  3. Recompute prediction:                                   │   │
│  │     a. Fetch ALL cycle entries (including correction)       │   │
│  │     b. Extract features                                     │   │
│  │     c. Run global model or fallback                         │   │
│  │     d. Create new PredictedCycle record                     │   │
│  │  4. Update user: avg_cycle_length, total_cycles_logged      │   │
│  │  5. Commit transaction                                       │   │
│  │  6. Emit "cycle_corrected" event                            │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────┐   │
│  │ Response 201: CorrectionResponse                            │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────┐   │
│  │ Mobile: onSuccess callback                                  │   │
│  │  1. Close bottom sheet (setShowOverride(false))             │   │
│  │  2. Invalidate all cycle queries:                           │   │
│  │     queryClient.invalidateQueries({ queryKey: ['cycle'] })  │   │
│  │  3. Dashboard/Predictions refresh with new prediction       │   │
│  │  4. CalendarScreen refetches with new phase encodings       │   │
│  │  5. StickyCard recalculates visibility window               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Appendix B: Complete Calendar Day Computation

```
Server computes phase for each day:

for each day in range(months_back, months_forward):
    phase_code = null

    // Check if day falls within a logged period
    for each cycle_entry:
        if day >= entry.period_start_date AND day <= entry.period_end_date:
            phase_code = 'P'   // Menstrual
            break

    // If not menstrual, check prediction phases
    if phase_code is null AND prediction exists:
        // Luteal phase: from predicted_fertile_window_end to predicted_next_period_start
        if day >= prediction.fertile_window_end AND day < prediction.next_period_start:
            phase_code = 'L'

        // Ovulation phase: within fertile window
        if day >= prediction.fertile_window_start AND day <= prediction.fertile_window_end:
            phase_code = 'O'

    // If still no phase, compute based on cycle position
    if phase_code is null:
        days_since_last_period = day - last_entry.period_end_date
        if days_since_last_period <= 14:  // Follicular phase (first ~14 days)
            phase_code = 'F'
        else: // Luteal phase
            phase_code = 'L'

    encoded_days[day] = phase_code
```

## Appendix C: Key Files Reference

| File | Purpose |
|------|---------|
| `mobile/src/screens/cycle/CycleDashboardScreen.tsx` | Main cycle dashboard with calendar, cards, actions |
| `mobile/src/screens/cycle/CyclePredictionsScreen.tsx` | Single prediction with countdown + override |
| `mobile/src/screens/cycle/CycleHistoryScreen.tsx` | Paginated cycle entry list |
| `mobile/src/screens/cycle/LogPeriodScreen.tsx` | Period entry form |
| `mobile/src/screens/cycle/CycleAnalyticsScreen.tsx` | Cycle statistics and insights |
| `mobile/src/screens/calendar/CalendarScreen.tsx` | Full month calendar with phase colors |
| `mobile/src/components/ui/Calendar.tsx` | Reusable month grid component |
| `mobile/src/components/ui/StickyCard.tsx` | Correction window sticky card |
| `mobile/src/components/ui/PredictionDetailCard.tsx` | Prediction display card |
| `mobile/src/components/ui/BottomSheet.tsx` | Reanimated bottom sheet with pan gesture |
| `mobile/src/components/ui/DatePickerField.tsx` | react-hook-form date picker |
| `mobile/src/services/api/cycle.ts` | Cycle API client (all endpoints) |
| `mobile/src/services/queries/cycle.ts` | TanStack Query hooks for cycle data |
| `mobile/src/services/ml/globalModel.ts` | Global model client (linear regression) |
| `mobile/src/services/ml/modelUpdater.ts` | Background model update checker |
| `mobile/src/services/ml/heuristicScorer.ts` | Fallback prediction logic |
| `mobile/src/navigation/CalendarStack.tsx` | Calendar tab navigation (7 routes) |
| `mobile/src/navigation/types.ts` | Param list type definitions |
| `backend/app/modules/cycle/routes.py` | 11 cycle HTTP endpoints |
| `backend/app/modules/cycle/services.py` | Cycle, Prediction, Calendar services |
| `backend/app/modules/cycle/models.py` | CycleEntry, PredictedCycle, SnoozeEvent tables |
| `backend/app/modules/cycle/schemas.py` | Pydantic request/response schemas |
| `backend/app/modules/cycle/tasks.py` | Initial prediction Celery task |
| `backend/app/integrations/prediction_engine.py` | GlobalModel + fallback prediction |
| `backend/app/tasks/checkin.py` | Daily P-3 checkin push notification |
| `backend/alembic/versions/0002_domain_tables.py` | Creates cycle, wellness, pregnancy tables |
| `backend/alembic/versions/0015_add_checkin_sent.py` | Adds checkin_sent to predicted_cycles |
