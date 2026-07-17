# AI Prediction Screen — Glassmorphic Dashboards & Timelines

> Route: `MainTabs` → `Home` → `Predictions` (also accessible from Cycle stack / dashboard cards)

## Layout & Aesthetics

A premium, informative dashboard offering advanced forecasts of menstrual cycles, fertile windows, and ovulation days. Built on a soft Off-White (`#FDF8F5`) background, it features a prominent gradient glass card at the top, a horizontal cycle timeline, and formatted historical logs.

```
┌──────────────────────────────────────────┐
│  ◀ Predictions                   [Share] │  <- Header: EB Garamond, share icon
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │  📊 Prediction Accuracy Info       │  │  <- Premium Glass Card (Soft Blush/Lavender glow)
│  │  ┌──────────┐                      │  │
│  │  │   86%    │ Based on 4 logged    │  │  <- Circular progress indicator
│  │  │ Accuracy │ cycles               │  │
│  │  └──────────┘                      │  │
│  │  Data Quality: ●●●●○ Good          │  │  <- 5-dot quality meter
│  └────────────────────────────────────┘  │
│                                          │
│  Next Cycle Events                       │  <- Heading: Inter, 18px
│  ┌────────────────────────────────────┐  │
│  │  🔴 Next Period                    │  │  <- Event list (color coded dots)
│  │     Sep 15 - Sep 20 (in 4 days)     │  │
│  │  ────────────────────────────────  │  │
│  │  🟢 Fertile Window                 │  │
│  │     Sep 25 - Sep 30 (in 14 days)   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Cycle Phase Timeline                    │
│  ┌────────────────────────────────────┐  │
│  │ [🔴Menstrual][🟡Follicular][🟢Ovul]│  │  <- Horizontal multi-segment phase bar
│  │               ▲ You are here       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Prediction History                      │
│  ┌────────────┬───────────┬───────────┐  │
│  │ Month      │ Predicted │ Actual    │  │  <- Scrollable comparison table
│  ├────────────┼───────────┼───────────┤  │
│  │ August     │ Sep 12    │ Sep 14    │  │
│  └────────────┴───────────┴───────────┘  │
└──────────────────────────────────────────┘
```

## Component Details

### 1. Large Glass Card (Top Header)
- **Style**:
  ```css
  backdrop-filter: blur(24px);
  background: linear-gradient(135deg, rgba(255, 107, 138, 0.12), rgba(232, 213, 245, 0.12));
  border: 1.5px solid rgba(255, 255, 255, 0.45);
  border-radius: 28px;
  ```
- **Circular Progress**: SVG path. Active track is Soft Blush (`#FF6B8A`), inactive is Lavender (`#E8D5F5`). Center text displays the percentage in Inter (24px, Bold, Charcoal `#2D2D2D`).
- **Data Quality Meter**: 5 horizontal dots. Dot colors follow cycle progress:
  - 1 dot active: Red (`#FF0000`)
  - 2 dots active: Soft Peach (`#FFDAB9`)
  - 3 dots active: Lavender (`#E8D5F5`)
  - 4 dots active: Mint (`#D4F0E0`)
  - 5 dots active: Mint (`#D4F0E0` with a subtle glow)

### 2. Next Events List
Each event is marked with a 10px circular color dot representing its category:
- **Next Period**: Soft Blush (`#FF6B8A`)
- **Fertility Window**: Mint (`#D4F0E0`)
- **Ovulation Day**: Soft Peach (`#FFDAB9`)
- **Typography**: Event titles in Inter (15px, Bold, Charcoal), countdown details in Warm Gray (`#8A8A8A`).

### 3. Cycle Phase Timeline
- **Timeline Bar**: A horizontal container divided into 4 colored segments representing the cycle phases:
  - Menstrual: Soft Blush (`#FF6B8A`)
  - Follicular: Soft Peach (`#FFDAB9`)
  - Ovulation: Mint (`#D4F0E0`)
  - Luteal: Lavender (`#E8D5F5`)
- **Marker**: A small Soft Blush leaf icon overlays the timeline bar showing the current day position, labeled *"You are here"* in Inter (12px, Charcoal).

### 4. Prediction History Table
Comparison list of predicted versus actual starting dates, color-coded by accuracy:
- **Accurate (<=1 day deviation)**: Row background tinted Mint (`#D4F0E0` at 0.2 opacity).
- **Close (2 days deviation)**: Row background tinted Soft Peach (`#FFDAB9` at 0.2 opacity).
- **Off (>=3 days deviation)**: Row background tinted Blush Light (`#FFB3C6` at 0.2 opacity).

---

## Screen States

| State | Behavior |
|-------|----------|
| **Loading** | Full-screen glass card and list items shimmer in a staggered loop. |
| **Error** | Shows local prediction data, overlays a Warm Gray warning bar: *"Tap to refresh predictions."* |

## Empty State (No Logs Recorded)

If the user has not logged any cycle, the screen shows:
- **Illustration**: A cozy hand-drawn graphic of an open calendar book decorated with flowers (Blush and Lavender colors).
- **Header**: Playfair Display (20px, Charcoal): *"Your cycle story begins here"*
- **Subtext**: Inter (15px, Warm Gray): *"Log your first period start date, and let our AI companion calculate your upcoming cycles and fertile window."*
- **Action**: Primary Soft Blush pill button: *"Log Period Start"*
