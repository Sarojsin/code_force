# Home Dashboard — Bento + Modern Girlish Design

> Route: `MainTabs` → `Home` tab (first tab in bottom navigation)

## Layout Architecture

The screen is built on a soft gradient background (`#FFB3C6 → #FFF8F0`) flowing from light blush at the top to warm cream at the bottom. The content is organized in a bento grid using elegant glassmorphic panels and soft shadow cards with a standard `20px` corner radius.

```
┌──────────────────────────────────────────┐
│  🌸 SheCare                🔔 [Profile]  │  <- Header: EB Garamond Logo + notification bell + avatar
├──────────────────────────────────────────┤
│  👋 Good morning, [Name]                 │  <- Title: EB Garamond, soft welcoming greeting
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │  🌸 Next Period in 12 days         │  │  <- Large primary brand card (Soft Blush gradient)
│  │  Sep 15 - 20                       │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────┐ ┌─────────────────┐  │
│  │  Today's Cycle │ │  Mood Journal   │  │  <- Bento Row 1: Today's Cycle (Glassmorphic)
│  │  Day 3         │ │  😊 Log mood    │  │     and Mood Card (Lavender accent)
│  │  Menstrual     │ │  [ heart icon]  │  │
│  └────────────────┘ └─────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  ✨ AI Prediction Snapshot         │  │  <- 2-column wide glass card
│  │  ┌───────┐   ┌───────┐   ┌───────┐ │  │
│  │  │  86%  │   │  75%  │   │  92%  │ │  │
│  │  │Accur. │   │Fertile│   │Ovulat.│ │  │
│  │  └───────┘   └───────┘   └───────┘ │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────┐ ┌─────────────────┐  │
│  │  AI Chat Assistant│ Educational Videos│  <- Bento Row 2: AI Chat & Videos (rounded preview)
│  │  💬 Ask me...  │ │  🎬 3 new       │  │
│  └────────────────┘ └─────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  📊 Analytics Trend                 │  │  <- Bento Row 3: Analytics Card with mini SVG sparkline
│  │  [  Mini Trend Chart Preview  ]   │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│        [Bottom Tab Navigation]           │  <- Glassmorphic floating navigation
└──────────────────────────────────────────┘
```

## Cards Specification

### 1. Next Period Card (Active Stat Pill)
- **Background**: Primary brand gradient (`#FF6B8A` to `#FF5277`)
- **Shadow**: `shadow.primary` (`0 4px 12px rgba(255,107,138,0.4)`)
- **Typography**: Playfair Display/EB Garamond for countdown text (24px, White), Inter for dates (15px, White).
- **Icon**: Stylized floral SVG outline or calendar overlay in white.
- **Action**: Tap → navigates to Predictions screen.

### 2. Today's Cycle Card
- **Background**: Glassmorphic panel with blur (`backdrop-filter: blur(16px), background: rgba(255,255,255,0.7)`) and 1px white border.
- **Content**: Cycle day number ("Day 3") in Playfair Display (24px, Charcoal), current phase ("Menstrual Phase") in Inter (15px, Charcoal), and a Soft Blush status dot.
- **Quick Action**: "Log Symptom" text button using `#FF6B8A` color.
- **Icon**: Outlined calendar icon (`#FF6B8A`).

### 3. Mood Card
- **Background**: Soft Lavender (`#E8D5F5`) background panel.
- **Content**: Most recent logged emoji (`😊`) and "How are you feeling?" prompt in Inter (15px, Charcoal).
- **Quick Action**: Tapping opens the Mood selector overlay.
- **Icon**: Muted lavender heart icon (`#8A6E9B`).

### 4. AI Prediction Snapshot (2-column wide)
- **Background**: Clear glassmorphic card with a light border.
- **Content**: Three mini stats: Prediction Accuracy (86%), Fertility % (75%), and Ovulation Confidence (92%).
- **Visualization**: Each stat contains a thin-stroke circular progress indicator (Soft Blush `#FF6B8A` active track, Mauve `#D4A5B5` inactive track) enclosing the percentage value.
- **Action**: Tap anywhere → navigates to Prediction details.

### 5. AI Chat Card
- **Background**: Warm Cream (`#FFF8F0`) card with soft shadow.
- **Content**: Sparkles icon, short preview of last assistant message ("Log a symptom...").
- **Action**: Tap → opens AI health assistant chat.

### 6. Videos Card
- **Background**: Standard white card with `#FFF8F0` details.
- **Content**: Play button overlay, thumbnail preview, and a pink floating bubble badge showing "3 new".
- **Action**: Tap → opens the Educational Video library.

### 7. Analytics Card
- **Background**: Warm Cream (`#FFF8F0`) bento panel.
- **Content**: Minimal line chart representing mood/cycle length over 7 days, "View insights" CTA.
- **Icon**: Muted gray bar-chart icon.

## Screen States

| State | Behavior |
|-------|----------|
| **Loading** | Staggered skeleton placeholders with shimmering effect matching each card's coordinates. |
| **Error** | "Could not reload dashboard" alert using Soft Blush border + retry button, displaying last cached local state. |
| **Empty** | "Welcome to SheCare" onboarding banner with a primary pill button to "Start Log". |

## Micro-Interactions & Transitions

- **Card Entrance**: Cards fly up with a 4px Y-translation, staggered by 60ms each on mounting.
- **Press Scaling**: Tapping any card scales it down to `0.96` with a gentle spring, returning to `1.0` on release.
- **Header Bell**: Clicking the notification bell triggers a quick 15-degree rotation shake (spring animation).
- **Haptic Feedback**: Subtle vibration trigger on opening quick actions.
