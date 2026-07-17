# Menstrual Phases — Phase Card Guide

> Route: `MainTabs` → `Home` → `PhaseDetail` (also accessible from Calendar bottom sheet)

## Layout & Navigation

A swipeable horizontal paging guide containing four beautifully stylized cards representing the phases of the menstrual cycle. Set against a soft Off-White (`#FDF8F5`) backdrop, each card uses a soft feminine gradient and a nested glassmorphic overlay for cycle facts and recommendations.

```
┌──────────────────────────────────────────┐
│  ◀ Cycle Phase Guide             [Close] │  <- Header: EB Garamond, close text link
├──────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  🔴 Menstrual Phase (Day 1 - 5)    │  │  <- Phase Card: Soft Blush gradient
│  │  ┌──────────────────────────────┐  │  │
│  │  │  Hormones: Estrogen ⬇         │  │  │  <- Glassmorphic Info Panel
│  │  │            Progesterone ⬇    │  │  │
│  │  │  Energy:   🌸 🌸 ░ ░ ░       │  │  │     (Energy & Mood rating with floral icons)
│  │  │  Mood:     🌸 🌸 🌸 ░ ░       │  │  │
│  │  └──────────────────────────────┘  │  │
│  │                                    │  │
│  │  Nutrition Recommendations          │  │
│  │  🥦 Iron-rich leafy greens         │  │
│  │  💧 Warm herbal infusions          │  │
│  │                                    │  │
│  │  Exercise & Activity               │  │
│  │  🧘 Gentle restorative yoga        │  │
│  │  🚶 Restful walks                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│   ●──────○──────○──────○                 │  <- Page indicator (active dot: Soft Blush)
│                                          │
└──────────────────────────────────────────┘
```

## Phase Card Gradient & Icon Specifications

### 1. Menstrual Phase Card
- **Background Gradient**: Soft Blush to Vivid Rose (`#FF6B8A → #FF5277`)
- **Header Color**: White (`#FFFFFF`)
- **Icon Overlay**: Stylized water droplet/blood drop in white outline.
- **Hormone Status**: Estrogen ⬇, Progesterone ⬇
- **Energy Level**: 2/5 (indicated by two active Soft Blush floral glyphs, three empty gray glyphs)
- **Common Symptoms**: Cramps, Fatigue, Back Pain (represented as Blush Light `#FFB3C6` chips)

### 2. Follicular Phase Card
- **Background Gradient**: Soft Peach to Off-White (`#FFDAB9 → #FDF8F5`)
- **Header Color**: Charcoal (`#2D2D2D`)
- **Icon Overlay**: Sprout/leaf icon in Mauve (`#D4A5B5`).
- **Hormone Status**: Estrogen ⬆, Progesterone ⬇
- **Energy Level**: 4/5
- **Common Symptoms**: High energy, skin clarity.

### 3. Ovulation Phase Card
- **Background Gradient**: Mint to Warm Cream (`#D4F0E0 → #FFF8F0`)
- **Header Color**: Charcoal (`#2D2D2D`)
- **Icon Overlay**: Sparkle/star icon in Mint (`#D4F0E0`).
- **Hormone Status**: LH ⬆⬆, FSH ⬆
- **Energy Level**: 5/5
- **Common Symptoms**: Fertile window indicators.

### 4. Luteal Phase Card
- **Background Gradient**: Lavender to Warm Cream (`#E8D5F5 → #FFF8F0`)
- **Header Color**: Charcoal (`#2D2D2D`)
- **Icon Overlay**: Moon outline in Mauve (`#D4A5B5`).
- **Hormone Status**: Progesterone ⬆⬆, Estrogen ⬇
- **Energy Level**: 3/5
- **Common Symptoms**: Bloating, mood sensitivity, cravings (Lavender `#E8D5F5` chips).

## Nested Glassmorphic Info Panel

- **Style**:
  ```css
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 20px;
  ```
- **Text Color**: Dark Charcoal (`#2D2D2D`) for maximum contrast and legibility.

## Page Indicator & Interaction

- **Dots**: Active dot is scaled up to 1.25x and colored in Soft Blush (`#FF6B8A`). Inactive dots are colored in Mauve (`#D4A5B5`).
- **Transitions**: Smooth horizontal swipe gesture with snapping (`damping: 20, stiffness: 150`).
- **Parallax**: Background gradient transitions 30% slower than card text elements during swipe to add depth.
