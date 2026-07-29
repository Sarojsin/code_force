# uiplan6 — Polish & Final Pass

> **Phase 9 — Low Priority.** Final quality pass after all other phases are complete.
> **Priority:** Low
> **Files:** ~5 to modify

---

## 1. Skeleton Placeholders — `mobile/src/components/ui/Skeleton.tsx`

### Current state
Basic skeleton with shimmer effect. No shape variants.

### Changes

Add three `shape` variants matching design:

```typescript
export type SkeletonShape = 'text' | 'card' | 'circle' | 'pill';

export interface SkeletonProps {
  width?: number;
  height?: number;
  shape?: SkeletonShape;
  // shape='circle' → width === height, borderRadius = width/2
  // shape='pill' → borderRadius = 999
  // shape='card' → borderRadius = 22
  // shape='text' → borderRadius = 8, height = 14
}
```

### Default dimensions per shape

| Shape | Default Width | Default Height | borderRadius |
|---|---|---|---|
| `text` | 120 | 14 | 8 |
| `card` | full width | 120 | 22 |
| `circle` | 48 | 48 | 24 (50%) |
| `pill` | 80 | 28 | 14 |

### Usage audit

Check all screens that use `Skeleton`:
- `HomeDashboardScreen.tsx` — loading grid → use `card` shape
- `CalendarScreen.tsx` — loading skeleton days → use `circle` shape
- `JournalEntryScreen.tsx` — loading → use `text` shape

---

## 2. Dark Mode Audit — All Modified Screens

### 2.1 Token verification checklist

For every screen modified in uiplan5, verify:

- [ ] No hardcoded `#FF6B8A` — use `theme.colors.primary`
- [ ] No hardcoded `#FFF8F0` — use `theme.colors.background`
- [ ] No hardcoded `#2D1B26` — use `theme.colors.textPrimary`
- [ ] No hardcoded `#6B4D5A` — use `theme.colors.textSecondary`
- [ ] No hardcoded `#A07888` — use `theme.colors.textMuted`
- [ ] All gradient colors reference theme tokens or match exact design hex
- [ ] All shadow colors reference `theme.shadow.*` presets

### 2.2 Phase color handling in dark mode

Phase colors (menstrual, follicular, ovulation, luteal) are used for:
- Calendar day backgrounds
- Phase timeline cards
- Phase overview cards

In dark mode, phase bg colors need to be dimmed:
```typescript
// Helper: darken a hex color for dark mode backgrounds
function darkModeBg(hex: string): string {
  // Append '33' for 20% opacity overlay on dark surface
  return hex + '33';
}
```

### 2.3 Glass effects in dark mode

Glass cards (`rgba(255,248,240,0.72)` background) need dark mode equivalent:
- Background: `rgba(42,45,56,0.85)` (uses dark surface color)
- Blur intensity: same
- Border: `rgba(255,255,255,0.08)` instead of white

### 2.4 Gradient cards in dark mode

Hero cards with blush gradients (home, settings, pregnancy) should use:
- Primary: `theme.colors.primary` (dynamically switches to lighter pink in dark)
- Mid: same gradient structure
- Deep: same — the gradient adapts via semantic tokens

### 2.5 Test matrix

| Screen | Light mode verified | Dark mode verified |
|---|---|---|
| HomeDashboardScreen | □ | □ |
| CalendarScreen | □ | □ |
| WellnessHomeScreen | □ | □ |
| JournalEntryScreen | □ | □ |
| SafetyHomeScreen | □ | □ |
| SOSActiveScreen | □ | □ |
| SettingsScreen | □ | □ |
| PregnancyHomeScreen | □ | □ |
| All 6 Onboarding screens | □ | □ |
| LunaOverlay | □ | □ |
| MainTabs | □ | □ |

---

## 3. Accessibility Audit

### 3.1 Mandatory attributes per component

| Component | `accessibilityLabel` | `accessibilityRole` | `accessibilityHint` |
|---|---|---|---|
| Button | ✅ (exists) | `"button"` | ✅ (exists) |
| Card (interactive) | Add: `"Card: {first-child-text}"` | `"button"` | Add: description |
| Toggle | Add: `"{label}, {on/off}"` | `"switch"` | Add: `"Tap to toggle"` |
| Chip | Add: `"{label}, {selected/unselected}"` | `"button"` | Add per context |
| Calendar day | ✅ (exists) | `"button"` | ✅ (exists) |
| Mood item | ✅ (exists) | `"button"` | Add: `"Select {label} mood"` |
| SOS button | Update: `"Emergency SOS"` | `"button"` | Update: `"Triggers 5-second countdown, then alerts contacts"` |
| Luna avatar | Update | `"imagebutton"` | Update: context-dependent |

### 3.2 Color contrast

Ensure all phase pill text meets WCAG AA (4.5:1 normal, 3:1 large):
- Phase text colors: `#B83058`, `#A0621A`, `#1A6B45`, `#5A35A0` on their respective bg colors — verify with contrast checker
- Caption text `#A07888` on `#FFF8F0` — verify meets 4.5:1

### 3.3 Touch targets

All interactive elements must be ≥ 44×44pt:
- Calendar day cells: 46×46 ✅ (exceeds)
- Mood items: 68pt height ✅
- Chips: use `minHeight: 44` + `minWidth: 44`
- Nav tabs: 44pt height ✅
- SOS button: 180×180 ✅

### 3.4 Live regions

- SOS state changes: use `accessibilityLiveRegion="polite"` for "SOS Alert Sent" text
- Luna bubble: when message changes, announce with `accessibilityLiveRegion="polite"`
- Sync status: connectivity banner should announce "You're offline"

---

## 4. ScreenLayout — `mobile/src/components/ui/ScreenLayout.tsx`

### 4.1 Typography alignment

Update the title rendering to use design's pattern:

```typescript
// Current: <Text variant="h2">{title}</Text>
// Target: 
{title && <Text variant="h1Large">{title}</Text>}
{subtitle && (
  <Text variant="greeting" color="muted" style={{ marginTop: 4 }}>
    {subtitle}
  </Text>
)}
```

### 4.2 Add standard padding

Design uses 18–20px horizontal padding. Update default `padded` value:
```typescript
// Current: padding: theme.spacing.lg (16)
// Update to: paddingHorizontal: 18
```

### 4.3 Background color

Ensure `ScreenLayout` sets `backgroundColor: theme.colors.background` (now `#FFF8F0`).

---

## 5. Phase Color Service — `mobile/src/utils/cyclePhases.ts`

### 5.1 Add phase metadata

Export the design's PHASE object as a reusable utility:

```typescript
export interface PhaseMeta {
  bg: string;       // background color
  fg: string;       // foreground (text) color
  accent: string;   // accent color
  label: string;    // display name
  emoji: string;    // emoji icon
  desc: string;     // description
}

export const PHASE_META: Record<string, PhaseMeta> = {
  menstrual: {
    bg: '#FFE4EC', fg: '#B83058', accent: '#FF6B8A',
    label: 'Menstrual', emoji: '🩸',
    desc: 'Rest & restore. Honour your body.',
  },
  follicular: {
    bg: '#FFF4E3', fg: '#A0621A', accent: '#F5A623',
    label: 'Follicular', emoji: '🌱',
    desc: 'Rising energy. Fresh beginnings.',
  },
  ovulation: {
    bg: '#E5F9F0', fg: '#1A6B45', accent: '#3CC87A',
    label: 'Ovulation', emoji: '🌟',
    desc: 'Peak vitality. Magnetic energy.',
  },
  luteal: {
    bg: '#EFE8FA', fg: '#5A35A0', accent: '#9B6BD4',
    label: 'Luteal', emoji: '🌙',
    desc: 'Wind down. Nurture yourself.',
  },
};
```

Consumed by: CalendarScreen, HomeDashboardScreen, WellnessScreen.

---

## 6. Final Verification

### 6.1 Build

```bash
npx tsc --noEmit
npx eslint src/
npx prettier --check src/
```

### 6.2 Visual diff checklist

| # | Check | Pass |
|---|---|---|
| 1 | All buttons use gradient primary style | □ |
| 2 | All cards use correct shadow variant | □ |
| 3 | Bottom nav is floating glass with gradient pill | □ |
| 4 | Home has hero cycle card with SVG ring | □ |
| 5 | Calendar has phase pills above grid | □ |
| 6 | Wellness segmented tabs match design | □ |
| 7 | Mood picker is 3-column with per-mood colors | □ |
| 8 | SOS has 180px pulsing button | □ |
| 9 | Settings has gradient profile hero | □ |
| 10 | Luna overlay has expandable bubble | □ |
| 11 | Pregnancy screens match design spec | □ |
| 12 | Onboarding has design backgrounds + stagger | □ |
| 13 | Dark mode tested on all screens | □ |
| 14 | Accessibility labels on all interactives | □ |
| 15 | No hardcoded colors — all use theme tokens | □ |
| 16 | Zero TypeScript errors | □ |

### 6.3 Final cleanup

- Remove unused design-token constants from any screen files (no inline `C` objects)
- Remove any leftover CSS-class-based animation references
- Ensure all color hex values in new code match the design spec exactly (use `#FF6B8A`, not `#FF5C8A`)
