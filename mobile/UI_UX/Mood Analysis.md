# Mood Tracking & Analysis — Soft UI / Neumorphic Design

> Route: `MainTabs` → `Home` → `Mood Log` (also accessible from dashboard card)

## Layout & Aesthetics

A soothing, quiet interface designed to invite reflection. Set on a Soft Cream (`#FFF8F0`) background, components utilize modern soft neumorphism — avoiding harsh borders in favor of soft shadows and light glares that make buttons appear to raise organically from the canvas.

```
┌──────────────────────────────────────────┐
│  ◀ How are you feeling, love?   [History]│  <- Header: EB Garamond title
├──────────────────────────────────────────┤
│  Select your dominant mood today         │
│                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │  😊  │ │  😌  │ │  😐  │ │  😢  │     │  <- Neumorphic raised emoji buttons
│  │Happy │ │Calm  │ │Neut. │ │ Sad  │     │
│  └──────┘ └──────┘ └──────┘ └──────┘     │
│  ┌──────┐ ┌──────┐ ┌──────┐              │
│  │  😰  │ │  😴  │ │  😡  │              │
│  │Stres.│ │Tired │ │Angry │              │
│  └──────┘ └──────┘ └──────┘              │
│                                          │
│  Mood Intensity: 4/10                    │
│  ●  ●  ●  ●  ○  ○  ○  ○  ○  ○            │  <- Dot-based intensity slider
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Add a personal note...             │  │  <- Note text box (radius 16px)
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │          [ Save Mood ]             │  │  <- Primary button (Soft Blush)
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Neumorphic Card Styling

Interactive controls (mood buttons, sliders, text inputs) share the following shadow details to establish depth without borders:
- **Base Color**: Soft Cream (`#FFF8F0`) or Off-White (`#FDF8F5`)
- **Shadow Offset**:
  - Top-Left (Light Reflection): `-6px -6px 12px rgba(255, 255, 255, 0.9)`
  - Bottom-Right (Soft Shadow): `6px 6px 12px rgba(0, 0, 0, 0.04)`
- **Radius**: `20px` (radius.xl)

---

## Mood Selector Specifications

A grid of seven emoji buttons. When selected, the neumorphic shape "depresses" (inner inset shadow is applied) and a 1.5px border outline fades in.

| Emoji | Label | Background Highlight (Active State) |
|-------|-------|------------------------------------|
| **😊** | Happy | Mint (`#D4F0E0`) |
| **😌** | Calm | Lavender (`#E8D5F5`) |
| **😐** | Neutral | Off-White (`#FDF8F5`) |
| **😢** | Sad | Blush Light (`#FFB3C6`) |
| **😰** | Stressed | Mauve (`#D4A5B5`) |
| **😴** | Tired | Warm Gray (`#8A8A8A` at 0.15 opacity) |
| **😡** | Angry | Soft Peach (`#FFDAB9`) |

- **Active Highlight Outline**: `2px solid #FF6B8A` (Soft Blush)
- **Haptics**: Light haptic vibration on selecting an emoji.

---

## Intensity Dot Slider

- **Dots**: 10 horizontally aligned circle indicators.
- **Active State (up to index)**: Colored in the Soft Blush gradient (`#FF6B8A → #FF5277`).
- **Inactive State**: Outlined in Mauve (`#D4A5B5`).
- **Label**: Displays *"Intensity: X/10"* in Inter (15px, Charcoal).

---

## Mood Trend SVG Graph & Insights

Located below the logging area or on the history sub-screen:
- **Trend Line**: Smooth SVG Bezier line in Soft Blush (`#FF6B8A`) with individual data points highlighted as circles.
- **Y-Axis**: Maps emojis from Sad (bottom) to Happy (top).
- **X-Axis**: Represents the last 7 days.
- **AI Emotional Insight Card**:
  - **Style**: Wellness card layout with a soft Lavender (`#E8D5F5`) background and `20px` corner radius.
  - **Content**: Sparkles icon and personalized reflection: *"Your mood tends to lift during your follicular phase when estrogen levels rise. Try adding gentle stretching exercises to maintain this flow."*
  - **Disclaimer**: *"AI-generated reflection. Not medical advice."* shown in Warm Gray (`#8A8A8A`) at the bottom.
