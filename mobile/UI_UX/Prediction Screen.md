# AI Prediction Screen — Glassmorphism + Charts

> Route: `MainTabs` → `Home` → `Predictions` (or accessible from Cycle stack / Home dashboard)

## Layout

Premium prediction dashboard with glass card, circular progress, timeline, and charts.

```
┌─────────────────────────────────────┐
│  ◀ Predictions              [Share] │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │  📊 Prediction Confidence     │  │  <- Large glass card
│  │                               │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │     ┌──────┐            │  │  │
│  │  │     │ 86%  │            │  │  │  <- Large circular progress
│  │  │     │Accuracy            │  │  │
│  │  │     └──────┘            │  │  │
│  │  │ Based on 4 logged cycles │  │  │
│  │  └─────────────────────────┘  │  │
│  │                               │  │
│  │  Data Quality: ●●●●○○ Good   │  │  <- 5-dot quality indicator
│  └───────────────────────────────┘  │
│                                     │
│  Next Events                        │
│  ┌───────────────────────────────┐  │
│  │ 🔴 Next Period                │  │
│  │   Sep 15 - Sep 20             │  │
│  │   in 4 days                   │  │
│  │   ───────────────────────     │  │
│  │ 🟢 Fertility Window           │  │
│  │   Sep 25 - Sep 30             │  │
│  │   in 14 days                  │  │
│  │   ───────────────────────     │  │
│  │ ⭐ Ovulation Day              │  │
│  │   Sep 28                      │  │
│  │   in 17 days                  │  │
│  └───────────────────────────────┘  │
│                                     │
│  Cycle Timeline                     │
│  ┌───────────────────────────────┐  │
│  │ 🔴────🟡────🟢────🔵───►     │  │  <- Horizontal timeline bar
│  │   D1     D8    D14    D21     │  │
│  │           ▲ You are here       │  │
│  └───────────────────────────────┘  │
│                                     │
│  AI Insight                         │
│  ┌───────────────────────────────┐  │
│  │ 🤖 Your cycle has been        │  │
│  │ consistent within 2 days      │  │
│  │ over the last 4 cycles.       │  │
│  │ Predictions will improve as   │  │
│  │ you log more data.            │  │
│  └───────────────────────────────┘  │
│                                     │
│  Prediction History (accuracy)      │
│  ┌──────────┬──────────┬──────────┐ │
│  │ Month    │ Predicted│ Actual   │ │
│  ├──────────┼──────────┼──────────┤ │
│  │ August   │ Sep 12   │ Sep 14   │ │  <- Table showing accuracy
│  │ July     │ Aug 10   │ Aug 10   │ │
│  │ June     │ Jul 8    │ Jul 11   │ │
│  └──────────┴──────────┴──────────┘ │
└─────────────────────────────────────┘
```

## Large Glass Card (Top)

```
backdrop-filter: blur(20px)
background: linear-gradient(135deg, rgba(255, 92, 138, 0.1), rgba(155, 123, 255, 0.1))
border: 1px solid rgba(255, 255, 255, 0.4)
border-radius: 28px
```

### Circular Progress
- SVG arc with animated fill
- Color: gradient from yellow → green based on percentage
- Center text: percentage large (bold 36px), "Accuracy" label below
- Subtext: "Based on X logged cycles"

### Data Quality Indicator
- 5 dots, filled proportionally
- Labels: Insufficient (1), Minimal (2), Good (3), Great (4), Excellent (5)
- Color: red → orange → yellow → green → deep green

## Next Events List

Three event rows with:
- **Color dot** (red=period, green=fertile, gold=ovulation)
- **Event name** + date range
- **Countdown** ("in X days")
- **Divider** between events
- Spring entrance animation (staggered, 100ms delay)

## Cycle Timeline

- Horizontal colored bar divided into 4 phase segments
- Current position marker with "You are here" label
- Phase labels below the bar (Day 1, Day 8, Day 14, Day 21)
- Colors match phase colors (Red → Yellow → Green → Blue)
- Animated marker movement on transition

## AI Insight

- Glassmorphism card (lighter style)
- AI sparkle icon (accent purple)
- Personalized text about cycle consistency
- Updated monthly or when new data is available
- "Powered by AI" badge

## Prediction Accuracy Table

- 3 columns: Month, Predicted date, Actual date
- Color coding: green row (accurate within 1 day), yellow (within 2 days), red (off by 3+)
- Scrollable if many rows
- Summary line at bottom: "Average accuracy: ±1.5 days"

## States

| State | Behavior |
|-------|----------|
| **Loading** | Full-screen skeleton with glass card + list placeholders |
| **No cycles logged** | Emotional empty state: "Start tracking to see predictions" with CTA |
| **1 cycle logged** | Prediction shown with low confidence warning |
| **3+ cycles** | Good confidence, full prediction detail |
| **Error** | Toast error, cached data stale-while-revalidate |
| **Share** | Export as image (iOS share sheet / Android sharing intent) |

## Empty State

```
┌──────────────────────────────┐
│      🔮                      │
│   No predictions yet         │
│   Log your first period to   │
│   start receiving AI-        │
│   powered predictions.       │
│                              │
│   [Log My Period]            │
└──────────────────────────────┘
```
