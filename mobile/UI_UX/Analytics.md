# Analytics Dashboard — Bento Layout

> Route: `MainTabs` → `Analytics` tab (3rd tab)

## Layout

Bento grid with statistics cards, charts, and progress indicators.

```
┌─────────────────────────────────────┐
│  Analytics               [Filter ▾] │
│  Your cycle patterns at a glance    │
├─────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐  │
│  │   Avg Cycle  │ │  Avg Period  │  │
│  │    28 days   │ │   5 days     │  │
│  │   └──────┘   │ │  └──────┘    │  │
│  └──────────────┘ └──────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Cycle Length Over Time        │  │  <- 2-column wide line chart
│  │  ┌──────────────────────────┐  │  │
│  │  │ 📈 Line chart (SVG)      │  │  │
│  │  │ 30 ┤╱╲──╱╲───╱╲──╱╲     │  │  │
│  │  │ 25 ┤  ╲╱  ╲╱   ╲╱  ╲╱    │  │  │
│  │  │    └─────────────────    │  │  │
│  │  │      Jul  Aug  Sep  Oct  │  │  │
│  │  └──────────────────────────┘  │  │
│  └────────────────────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐  │
│  │ Pred. Accur. │ │  Mood Trend  │  │
│  │  ┌──────┐    │ │  ┌──────┐    │  │
│  │  │ 86%  │    │ │  │ 😊   │    │  │  <- Circular progress
│  │  └──────┘    │ │  │ 7.2  │    │  │
│  └──────────────┘ └──────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Top Symptoms                   │  │
│  │  Cramps    ████████████░░ 80%  │  │  <- Horizontal bar chart
│  │  Fatigue   ████████░░░░ 66%   │  │
│  │  Bloating  ██████░░░░░░ 50%   │  │
│  │  Headache  ████░░░░░░░░ 33%   │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Sleep & Stress                 │  │
│  │  Sleep: ████████░░ 7.2h avg   │  │
│  │  Stress:███░░░░░░░ 3.8/10     │  │
│  └────────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Cards Specification

### 1. Stat Cards (2 × 2 grid, top row)
- **Avg Cycle Length**: Large number (28), label below, icon top-left
- **Avg Period Length**: Large number (5), label below
- Both cards: white background, soft shadow, rounded 16px
- Trend indicator: ▲▼ compared to previous average

### 2. Cycle Length Chart (full width, 2 columns)
- Line chart using `react-native-svg` + `react-native-chart-kit` or custom SVG
- X-axis: months (last 6 cycles), Y-axis: days (20–35)
- Shaded area under the line (gradient fill)
- Dots on data points, tappable for details
- Average line (dashed) across the chart

### 3. Prediction Accuracy (1 column)
- Circular progress indicator (SVG arc)
- Center: percentage (86%) in bold
- Label: "Prediction Accuracy"
- Color: gradient from yellow → green based on percentage

### 4. Mood Trend (1 column)
- Circular progress with emoji at center
- Shows average mood score (7.2/10) and dominant mood emoji
- Mini sparkline below showing last 7 days

### 5. Symptoms Bar Chart (full width)
- Horizontal bars with percentage labels
- Sorted by frequency descending
- Color-coded bars (brand colors cycling)
- Animated bar fill on appear

### 6. Sleep & Stress (full width)
- Two horizontal progress bars
- Sleep: average hours with moon icon
- Stress: score with lightning icon
- Comparison to previous period: ▲▼ indicators

## Interactions

- **Filter button** (top right): opens bottom sheet with time range (3 months, 6 months, 1 year, All)
- **Card tap**: expands card to full screen for detailed view
- **Chart touch**: crosshair with tooltip showing exact values
- **Pull-to-refresh**: reloads analytics data
- **Share**: export as image (iOS share sheet)

## States

| State | Behavior |
|-------|----------|
| **Loading** | Skeleton cards matching each chart/card dimension |
| **Not enough data** | Prompt: "Log 3+ cycles to see analytics" |
| **Sufficient data** | Full charts with trend lines |
| **Error** | Offline data shown, toast with retry |

## Empty State

```
┌──────────────────────────────┐
│      📊                       │
│   Not enough data yet         │
│   Log at least 3 cycles to    │
│   see your analytics pattern  │
│                               │
│   [Track Your Cycle]          │
└──────────────────────────────┘
```
