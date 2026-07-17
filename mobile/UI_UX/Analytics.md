# Analytics Dashboard — Bento Layout & Girlish Design

> Route: `MainTabs` → `Analytics` tab (3rd tab)

## Layout & Aesthetics

A clean, modern bento grid displaying personal health cycles, symptoms, and mood trends. Set on an Off-White (`#FDF8F5`) canvas with rounded elements (`20px` radius) and soft shadows (`shadow.soft`) for an elegant, readable presentation.

```
┌──────────────────────────────────────────┐
│  Analytics                    [Filter ▾] │  <- Header: EB Garamond, filter dropdown button
│  Your cycle patterns at a glance          │
├──────────────────────────────────────────┤
│  ┌────────────────┐  ┌─────────────────┐  │
│  │  Avg Cycle      │  │  Avg Period     │  │  <- Bento Row 1: Warm Cream cards, Charcoal text,
│  │  28 days       │  │  5 days         │  │     Soft Blush trend indicator
│  │  ▲ 1.2 days    │  │  ▼ 0.4 days     │  │
│  └────────────────┘  └─────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Cycle Length Over Time            │  │  <- 2-column wide line chart (Soft Blush SVG line)
│  │  [  Line Chart with soft gradient  ]│  │
│  └────────────────────────────────────┘  │
│  ┌────────────────┐  ┌─────────────────┐  │
│  │  Pred. Accuracy│  │  Mood Trend     │  │  <- Bento Row 2: Prediction (Lavender progress circle)
│  │  ┌──────────┐  │  │  😊 Happy       │  │     and Mood summary (dominant emoji + sparkline)
│  │  │   86%    │  │  │  7.2/10 Avg    │  │
│  │  └──────────┘  │  │  [Sparkline]    │  │
│  └────────────────┘  └─────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Top Symptoms Logged               │  │  <- Symptoms horizontal bar chart (Mauve indicators)
│  │  Cramps   ████████████░░░░ 80%     │  │
│  │  Fatigue  ██████████░░░░░░ 66%     │  │
│  │  Bloating ████████░░░░░░░░ 50%     │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Sleep & Stress Correlation        │  │  <- Correlation section (Mint and Lavender bars)
│  │  🌙 Sleep:  ██████████░░░ 7.2h     │  │
│  │  ⚡ Stress: ████░░░░░░░░░ 3.8/10   │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Component Specifications

### 1. Stat Cards (Bento Row 1)
- **Background**: Warm Cream (`#FFF8F0`) card, `20px` border radius, `shadow.soft`.
- **Text**: Title in Inter (12px, Warm Gray `#8A8A8A`), value in EB Garamond (28px, Charcoal `#2D2D2D`).
- **Trend Indicator**: Soft Blush (`#FF6B8A`) for positive status indicators, Mauve (`#D4A5B5`) for negative.

### 2. Cycle Length Line Chart (Full Width)
- **Style**: Smooth SVG Bezier curves. The path is colored in Soft Blush (`#FF6B8A`) with a line thickness of 3px.
- **Gradient Fill**: Below the curve, a fading gradient from Blush Light (`#FFB3C6` at 0.3 opacity) to Off-White (`#FDF8F5` at 0.0 opacity).
- **Grid Lines**: Muted Warm Gray (`#8A8A8A` at 0.1 opacity) with a dashed average baseline in Mauve (`#D4A5B5`).

### 3. Prediction Accuracy Circle (1 column)
- **Aesthetic**: Circular progress ring. Active arc uses the Soft Blush gradient (`#FF6B8A` to `#FF5277`), and the inactive track is Lavender (`#E8D5F5`).
- **Center Value**: Inter (20px, Bold, Charcoal `#2D2D2D`).

### 4. Mood Trend Card (1 column)
- **Background**: Lavender (`#E8D5F5`) background panel.
- **Center Value**: Dominant mood emoji (`😊`) in a central circular avatar alongside a mini 7-day sparkline in Mauve (`#D4A5B5`).

### 5. Symptoms Bar Chart (Full Width)
- **Aesthetic**: Rounded progress tracks (`8px` height, radius.sm).
- **Colors**: Active bar fill uses Mauve (`#D4A5B5`) transitioning to Blush Light (`#FFB3C6`). The track background is Off-White (`#FDF8F5`).

### 6. Sleep & Stress Tracking
- **Icons**: Muted lavender moon (`#8A6E9B`) and soft gold lightning bolt.
- **Progress Track**: Sleep active bar uses Mint (`#D4F0E0`), Stress active bar uses Mauve (`#D4A5B5`).

## Screen States

| State | Behavior |
|-------|----------|
| **Loading** | Staggered entrance shimmer placeholders for each bento card. |
| **Error** | Shows a toast warning at the bottom with a Blush Light retry action. |

## Empty State (Not Enough Data)

If the user has logged less than 3 cycles, a warm, supportive screen is shown:
- **Illustration**: Hand-drawn graphic of a woman watering a flower pot (soft pastel Blush/Lavender tones).
- **Header**: Playfair Display (20px, Charcoal): *"Patience is beautiful"*
- **Subtext**: Inter (15px, Warm Gray): *"Log at least 3 cycles to uncover your body's natural patterns and cycle insights."*
- **Action**: Primary Soft Blush pill button: *"Log Today's Symptoms"*
