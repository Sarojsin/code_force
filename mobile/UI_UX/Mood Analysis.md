# Mood Tracking — Soft UI / Neumorphism

> Route: `MainTabs` → `Home` → `Mood Log` (or accessible from Home dashboard card)

## Layout

Calming mood tracking screen with emoji selector, trend graph, and AI insights.

```
┌─────────────────────────────────────┐
│  ◀ How are you feeling?     [History]│
├─────────────────────────────────────┤
│  Select your current mood           │
│                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ 😊  │ │ 😌  │ │ 😐  │ │ 😢  │  │  <- Neumorphism raised buttons
│  │Happy│ │Calm │ │Neut.│ │ Sad │  │  │
│  └─────┘ └─────┘ └─────┘ └─────┘  │
│  ┌─────┐ ┌─────┐ ┌─────┐          │
│  │ 😰  │ │ 😴  │ │ 😡  │          │
│  │Stres│ │Tired│ │Angry│          │
│  └─────┘ └─────┘ └─────┘          │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Intensity: ●●●●○○○○○○       │  │  <- Dot-based slider
│  │  (4/10)                        │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Add a note...                 │  │  <- Text input (pill shape)
│  └───────────────────────────────┘  │
│                                     │
│  [Save Mood]                        │  <- Full-width button
│                                     │
├─────────────────────────────────────┤
│  Mood Trend (Last 7 Days)           │  <- Trend section (below fold or scroll)
│  ┌───────────────────────────────┐  │
│  │ 📊 Line chart (SVG)          │  │
│  │ 😊 ┤╱╲──╱╲                    │  │
│  │ 😐 ┤  ╲╱──╲╱──╲──            │  │
│  │ 😢 ┤        ╲──╱──╲          │  │
│  │    Mon Tue Wed Thu Fri Sat Sun│  │
│  └───────────────────────────────┘  │
│                                     │
│  Weekly Summary                     │
│  ┌───────────────────────────────┐  │
│  │ 😊 Happy  5 times             │  │
│  │ 😢 Sad    2 times             │  │
│  │ Average intensity: 6.2/10     │  │
│  │ Most common: Afternoon         │  │
│  └───────────────────────────────┘  │
│                                     │
│  AI Emotional Insight               │
│  ┌───────────────────────────────┐  │
│  │ 🤖 Your mood tends to         │  │
│  │ improve in the follicular     │  │
│  │ phase. Consider tracking      │  │
│  │ sleep quality alongside mood. │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Neumorphism Cards

```
background: #FFF8FB (or slightly darker)
border-radius: 20px
box-shadow:
  -6px -6px 12px rgba(255, 255, 255, 0.8)   (top-left, light)
   6px  6px 12px rgba(0, 0, 0, 0.05)         (bottom-right, shadow)
No border.
```

Applied to: mood selector buttons, intensity slider, note input.

## Mood Selector

7 mood options in a 2-row grid:

| Emoji | Label | Color |
|-------|-------|-------|
| 😊 | Happy | Green `#D1FAE5` |
| 😌 | Calm | Blue `#BFDBFE` |
| 😐 | Neutral | Gray `#E5E7EB` |
| 😢 | Sad | Light Blue `#DBEAFE` |
| 😰 | Stressed | Purple `#EDE9FE` |
| 😴 | Tired | Warm Gray `#E5E7EB` |
| 😡 | Angry | Red-Orange `#FEE2E2` |

### Interaction
- Tap: button depresses (neumorphism pushed-in effect)
- Selected: highlighted with brand color border + slight scale
- Haptic feedback on selection

## Intensity Slider

- 10 dots in a row
- Selected dots filled with brand primary gradient
- Unselected dots: light gray outline
- Tap any dot to set intensity
- "X/10" label updates in real time

## Mood Trend Graph

- Line chart using `react-native-svg`
- Y-axis: mood emojis mapped to numeric (1-7)
- X-axis: last 7 days
- Smooth bezier curves
- Gradient fill under the line
- Dots on each data point

## Weekly Summary

- List of mood frequencies (sorted by count)
- Average intensity
- Most common time of day for logging
- Best mood streak (consecutive days of positive mood)

## AI Emotional Insight

- Glassmorphism card with AI sparkle icon
- Insight generated by backend AI based on mood + cycle data
- Shows correlation between cycle phase and mood
- Personalized recommendations
- Disclaimer: "AI-generated insight, not medical advice"

## States

| State | Behavior |
|-------|----------|
| **Loading** | Skeleton for mood selector + chart area |
| **Today not logged** | Mood selector active, trend shows previous days |
| **Today logged** | Mood selector shows today's mood (disabled, editable), trend updates |
| **Error logging** | Toast error, retry option |
| **Insufficient data for trend** | "Log your mood for 3+ days to see trends" |
| **No AI insight** | "Log more data for personalized insights" |
