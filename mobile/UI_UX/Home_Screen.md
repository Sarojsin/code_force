# Home Dashboard — Bento + Glassmorphism

> Route: `MainTabs` → `Home` tab (first tab in bottom navigation)

## Layout Architecture

Bento grid with glassmorphism cards on a soft pink gradient background.

```
┌─────────────────────────────────────┐
│  👋 Good morning, [Name]   🔔 👤   │  <- Header: greeting + profile + notification
├─────────────────────────────────────┤
│  ┌──────────┐ ┌──────────────────┐  │
│  │  Today's │ │   Next Period    │  │
│  │  Cycle   │ │   in 4 days      │  │
│  │  Day 3   │ │   Sep 15 - 20    │  │
│  └──────────┘ └──────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │   AI Prediction Snapshot        │  │  <- 2-column wide glass card
│  │   ┌──────┐ ┌──────┐ ┌──────┐  │  │
│  │   │ 86%  │ │ 75%  │ │ 92%  │  │  │
│  │   │Accur.│ │Fertil│ │Ovulat│  │  │
│  │   └──────┘ └──────┘ └──────┘  │  │
│  └────────────────────────────────┘  │
│  ┌──────────┐ ┌──────────┐          │
│  │   Mood   │ │  Videos  │          │
│  │   😊😐😢  │ │ 🎬 3 new │          │
│  └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐          │
│  │  AI Chat │ │Analytics │          │
│  │  Ask me  │ │   View   │          │
│  │ anything │ │ insights │          │
│  └──────────┘ └──────────┘          │
├─────────────────────────────────────┤
│      [Bottom Tab Navigation]        │  <- Floating / standard bottom nav
└─────────────────────────────────────┘
```

## Cards Specification

### 1. Today's Cycle Card
- **Glassmorphism** with blur backdrop
- Shows: cycle day number, current phase name, phase color indicator dot
- Quick action: "Log Symptom" button
- Icon: calendar-outline (feather)

### 2. Next Period Card
- Semi-solid brand gradient (primary pink)
- Shows: countdown "X days", predicted date range (Sep 15 - 20)
- White text with high opacity
- Quick action: "View Predictions" → navigates to Predictions screen

### 3. AI Prediction Snapshot (2-column wide)
- Glassmorphism card
- Three mini stats: accuracy gauge (86%), fertility % (75%), ovulation confidence (92%)
- Each stat: circular progress indicator + label
- Tap anywhere → navigates to full Prediction screen
- Icon: sparkles / AI icon

### 4. Mood Card
- Soft pastel background (matching current dominant mood)
- Shows: 3 most recent mood emojis in a row, "Log mood" prompt
- Quick action: opens Mood Log
- Icon: heart / emoji

### 5. Videos Card
- Shows: thumbnail preview of latest video
- Badge: "3 new" if unseen
- Quick action: opens Video Library
- Icon: play-circle

### 6. AI Chat Card
- Glassmorphism
- Shows: last AI message preview (1 line)
- Quick action: opens AI Chat
- Icon: message-circle / chat

### 7. Analytics Card
- Shows: mini line chart (last 7 days mood or cycle length trend)
- "View insights" CTA
- Icon: bar-chart-2

## States

| State | Behavior |
|-------|----------|
| **Loading** | Skeleton shimmer for each card (matching card dimensions) |
| **Error** | Toast message + retry button; cached data shown stale-while-revalidate |
| **Empty** | Cards show "Start tracking" prompts with CTAs |
| **First launch** | Onboarding prompt instead of dashboard |

## Interactions

- Each card: spring scale 0.96 on press-in, 1.0 on press-out
- Cards have staggered entrance animation (50ms delay between each)
- Pull-to-refresh reloads all card data
- Notification bell shows unread count badge
- Profile avatar tappable → Profile screen
