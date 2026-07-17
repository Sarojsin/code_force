# Calendar Screen — Modern Girlish Style

> Route: `MainTabs` → `Calendar` tab (2nd tab)

## Layout & Structure

The calendar screen uses an elegant, uncluttered grid set on an Off-White (`#FDF8F5`) canvas. Phase days are represented using organic pastel circles. A draggable Warm Cream (`#FFF8F0`) bottom sheet holds logging controls and cycle insights.

```
┌──────────────────────────────────────────┐
│  ◀  September 2026  ▶            [Today] │  <- Header: EB Garamond month navigation, today button
├──────────────────────────────────────────┤
│  Su   Mo   Tu   We   Th   Fr   Sa        │
│             1    2    3    4    5        │
│   6    7    8    9   10   11   12        │
│  13   14  [15]  16   17   18   19        │  <- Selected day (15) highlighted with spring border
│  20   21   22   23   24   25   26        │  <- Color-coded phase circles and dots
│  27   28   29   30                       │
├──────────────────────────────────────────┤
│  ┌─── Log Details ─────────────────────┐  │  <- Bottom Sheet (draggable, 20px radius)
│  │   Sep 15, 2026 — Cycle Day 3        │  │
│  │   🔴 Menstrual Phase                │  │
│  │   Mood: 😊 [Add Note]               │  │
│  │   Symptoms logged: Cramps, Fatigue  │  │
│  │   ┌──────────────────────────────┐  │  │
│  │   │  [ Save Daily Log ]          │  │  │  <- Primary button (Soft Blush)
│  │   └──────────────────────────────┘  │  │
│  └─────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Phase Color Coding & Day Styles

Logged phase days are color-coded using the soft/warm color system:

| Phase | Color Name | HEX | Day Cell Style |
|-------|------------|-----|----------------|
| **Menstrual** | Soft Blush | `#FF6B8A` | Solid circle fill, white text |
| **Follicular** | Soft Peach | `#FFDAB9` | Soft peach background circle, Charcoal text |
| **Ovulation** | Mint | `#D4F0E0` | Mint background circle with soft shadow, Charcoal text |
| **Luteal** | Lavender | `#E8D5F5` | Lavender background circle, Charcoal text |
| **Predicted Period** | Blush Light | `#FFB3C6` | Outlined or striped diagonal pattern, Charcoal text |

- **Selected Day**: Highlighted with a 2px solid Soft Blush (`#FF6B8A`) border and a spring bounce animation (scales up to 1.15, then snaps to 1.0).
- **Today Indicator**: Muted gray background circle with a Soft Blush (`#FF6B8A`) text number.
- **Log Indicators**:
  - Logged Symptoms: Small Mauve (`#D4A5B5`) dot placed directly beneath the day's text number.
  - Logged Mood: Tiny native emoji symbol printed under the day's cell.

## Draggable Details Panel (Bottom Sheet)

- **Style**: Background is Warm Cream (`#FFF8F0`) with a `20px` corner radius. The drag handle is a Mauve (`#D4A5B5`) pill (`32px` wide, `4px` tall).
- **Snap Points**: Snaps at 30% (summary preview), 65% (standard logs), and 90% (full-screen input).

### Bottom Sheet Form Controls

1. **Phase Summary**: Heading uses Playfair Display (18px, Charcoal) showing the date and current phase with a colored status dot.
2. **Mood Selector Chips**: Horizontal rows of emoji chips. Selected emoji gets a Blush Light (`#FFB3C6`) background, unselected chips remain transparent with a thin Mauve (`#D4A5B5`) border.
3. **Symptom Tag Grid**: Tappable symptom badges. Background is Blush Light (`#FFB3C6`) with Charcoal text when active, and Off-White (`#FDF8F5`) with a Mauve border when inactive.
4. **Notes Field**: Expansive text area. Border is 1px solid `#D4A5B5` (Mauve) on an Off-White input canvas.
5. **Action Buttons**:
  - *Primary (Save)*: Pill-shaped (`24px` radius) with Soft Blush gradient background and white text.
  - *Secondary (Delete/Cancel)*: Ghost style with a Soft Blush border and Soft Blush text.

## Screen States

| State | Behavior |
|-------|----------|
| **Loading** | 28 shimmering circular grids representing blank day cells. |
| **Offline** | Users can log locally. Changes are saved to encrypted storage and synchronized with the backend on reconnect (showing a toast: *"Saved offline"*). |
