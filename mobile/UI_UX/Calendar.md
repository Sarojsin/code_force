# Calendar Screen — Minimal Material Design

> Route: `MainTabs` → `Calendar` tab (2nd tab)

## Layout

```
┌─────────────────────────────────────┐
│  < September 2026 >          [Today] │
├─────────────────────────────────────┤
│  Su  Mo  Tu  We  Th  Fr  Sa        │
│             1   2   3   4   5       │
│   6   7   8   9  10  11  12       │
│  13  14  15  16  17  18  19       │  <- Color-coded phase days
│  20  21  22  23  24  25  26       │
│  27  28  29  30                    │
├─────────────────────────────────────┤
│  ┌─── Selected Day Details ──────┐  │  <- Bottom sheet (draggable)
│  │  Sep 15, 2026 — Day 3          │  │
│  │  ● Menstrual Phase             │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │ 😊 Happy  │ 😴 Tired     │  │  │  <- Tappable chips
│  │  │ 😰 Anxious│ 💪 Motivated │  │  │
│  │  └──────────────────────────┘  │  │
│  │  Symptoms: Cramps, Bloating    │  │
│  │  Notes: "Feeling a bit low..." │  │
│  │  Prediction: Next period Oct 12│  │
│  └────────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Phase Color Coding

| Phase | Color | HEX | Calendar Day Style |
|-------|-------|-----|-------------------|
| Menstrual | Red | `#FF5252` | Solid fill, white text |
| Follicular | Yellow | `#FFD54F` | Light fill, dark text |
| Ovulation | Green | `#4CAF50` | Solid fill, white text, subtle glow |
| Luteal | Blue | `#42A5F5` | Light fill, white text |

## Calendar Component Spec

- **Large monthly calendar** filling the screen width (with horizontal padding)
- **Month navigation**: left/right arrows + `MMMM yyyy` header title
- **Weekday headers**: 3-letter abbreviated (Mon, Tue, Wed...)
- **Selected day**: spring bounce animation on tap (scale 1.0 → 1.15 → 1.0)
- **Today**: outlined circle with primary color
- **Phase days**: background color per phase coding above
- **Predicted days**: striped/hatched pattern (or lighter opacity) to distinguish from logged
- **Markers**: small dot for logged symptoms, different dot for logged moods

## Bottom Sheet (Details Panel)

- Drag gesture to pull up (snap points: 30%, 60%, 90%)
- Handle bar at top (30px wide, 4px tall, rounded pill)
- Smooth spring animation on reveal

### Bottom Sheet Sections

1. **Date & Phase Header**: Full date + phase name with color indicator
2. **Mood Chips**: Quick mood selector (same as Mood Log emojis) — tappable to log
3. **Symptom Tags**: Common symptoms as tappable chips, selected ones highlighted
4. **Notes**: Expandable text area, existing notes shown, tap to edit
5. **Prediction**: "Next period in X days" with mini timeline
6. **Actions**: "Log Period", "Add Note", "View Phase Details" buttons

## States

| State | Behavior |
|-------|----------|
| **Loading** | Calendar skeleton with 28 day cells shimmering |
| **No data** | Empty month, "Start logging your cycle" CTA |
| **Partial data** | Some days colored (logged), others blank |
| **Error** | Toast error, offline data shown stale-while-revalidate |

## Interactions

- Day tap: select that day, animate, show bottom sheet with that day's data
- Long-press on a day: quick log period start/end toggle
- Swipe left/right on header: change month
- "Today" button: scroll back to current month and select today
