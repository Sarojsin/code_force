# Menstrual Phases — Gradient Cards + Glassmorphism

> Route: `MainTabs` → `Home` → `PhaseDetail` (or accessible from Calendar bottom sheet)

## Layout

Full-screen horizontal swipeable pager with 4 phase cards.

```
┌─────────────────────────────────────┐
│  < Phase Guide              [Close] │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │  🔴 Menstrual (Day 1-5)       │  │  <- Deep Red Gradient card
│  │  ┌─────────────────────────┐  │  │
│  │  │  Hormones: Estrogen ⬇    │  │  │
│  │  │            Progesterone ⬇│  │  │
│  │  │  Energy: ★★☆☆☆          │  │  │
│  │  │  Mood:   ★★★☆☆          │  │  │
│  │  └─────────────────────────┘  │  │
│  │                               │  │
│  │  Nutrition Tips               │  │
│  │  🥦 Iron-rich foods           │  │  <- Tappable with detail
│  │  🫐 Vitamin C for absorption  │  │
│  │  💧 Stay hydrated             │  │
│  │                               │  │
│  │  Exercise Recommendations     │  │
│  │  🧘 Gentle yoga               │  │
│  │  🚶 Light walking             │  │
│  │  ❌ Avoid high intensity       │  │
│  │                               │  │
│  │  Common Symptoms              │  │
│  │  ⚡ Cramps • 🫠 Fatigue • 😰  │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  ●───○───○───○  (page indicator)    │  <- Dots for 4 phases
│                                     │
└─────────────────────────────────────┘
```

## Phase Card Specifications

### 1. Menstrual Phase
- **Gradient**: Deep Red `#D63B3B` → `#FF5C8A`
- **Icon**: Droplet / blood drop (white, outline style)
- **Duration**: Day 1–5 (average)
- **Hormones**: Estrogen ⬇, Progesterone ⬇
- **Energy**: Low (★☆☆☆☆)
- **Mood**: Variable (★★☆☆☆)

### 2. Follicular Phase
- **Gradient**: Orange `#FFB74D` → Yellow `#FFD54F`
- **Icon**: Leaf / sprout
- **Duration**: Day 6–13
- **Hormones**: Estrogen ⬆⬆, Progesterone ⬇
- **Energy**: High (★★★★☆)
- **Mood**: Positive (★★★★★)

### 3. Ovulation Phase
- **Gradient**: Green `#4CAF50` → Mint `#81C784`
- **Icon**: Sparkle / star
- **Duration**: Day 14–16
- **Hormones**: LH ⬆⬆, FSH ⬆
- **Energy**: Peak (★★★★★)
- **Mood**: High (★★★★★)

### 4. Luteal Phase
- **Gradient**: Purple `#7E57C2` → Lavender `#9B7BFF`
- **Icon**: Moon
- **Duration**: Day 17–28
- **Hormones**: Progesterone ⬆⬆, Estrogen ⬆
- **Energy**: Decreasing (★★★☆☆)
- **Mood**: PMS symptoms (★★☆☆☆)

## Glassmorphism Card Properties

```
backdrop-filter: blur(16px)
background: rgba(255, 255, 255, 0.15)
border: 1px solid rgba(255, 255, 255, 0.25)
border-radius: 24px
```

## Page Indicator

3 dots below the card, filled dot = current phase. Smooth dot scale animation on swipe.

## Swipe Interaction

- Horizontal swipe with `react-native-gesture-handler` + Reanimated
- Snap-to-card behavior (no half-transitions)
- Card parallax: background gradient moves slower than content
- Spring animation on release (`damping: 20, stiffness: 150`)
- Swipe hint animation on first visit (subtle arrow bounce)

## Data Sections Per Card

| Section | Display |
|---------|---------|
| Hormone levels | Bar chart or arrow indicators (up/down/flat) |
| Energy level | 5-star rating with animated fill |
| Mood level | 5-star rating + emoji indicator |
| Nutrition | 3-4 bullet points with food icons |
| Exercise | 3-4 recommendations with activity icons |
| Common symptoms | Tag chips with emoji prefix |

## States

| State | Behavior |
|-------|----------|
| **Loading** | Card skeleton shimmer matching card dimensions |
| **Not enough data** | Generic phase information (no personalization) |
| **Personalized** | Shows user's logged data for each phase (cycle length, common symptoms) |
| **Error** | Fallback to generic phase info, retry option |
