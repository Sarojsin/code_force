# uiplan1 — Design Token Alignment

> **Phase 1 — Foundation.** Blocks all other phases.
> **Priority:** High
> **Files:** 1 to modify (`mobile/src/theme/tokens.ts`)

---

## 1. Color Palette Update

**File:** `mobile/src/theme/tokens.ts`

### 1.1 Brand / Primary palette — change exact hex values

| Current Token | Current Value | Change To | Design Token Name |
|---|---|---|---|
| `primary50` | `#FFF1F4` | `#FFF8F0` (matches cream bg) | — |
| `primary100` | `#FFD9E1` | `#FFE8EF` (mood bg) | — |
| `primary300` | `#FF8FA8` | `#FFB3C6` | `blushLight` |
| `primary500` | `#FF5C8A` | `#FF6B8A` | `blush` |
| `primary700` | `#D6336B` | `#D4507A` (gradient mid) | — |

### 1.2 Add missing palette entries

```typescript
// In the palette object, add:
primary900: '#A83060',    // hero gradient deep end
roseQuartz: '#F7C5CC',    // borders, card accents
mauve:      '#D4A5B5',    // secondary accent
lavender:   '#E8D5F5',    // phase, wellness cards
mint:       '#D4F0E0',    // success/wellness backgrounds
warmCream:  '#FFF8F0',    // page background
blushLight: '#FFB3C6',    // soft backgrounds
```

### 1.3 Add semantic accent colors to `colors` object

```typescript
// In colors (light mode):
accent:        palette.mauve,      // #D4A5B5 — replaces current accent500
accentLight:   palette.lavender,   // #E8D5F5
roseQuartz:    palette.roseQuartz, // #F7C5CC
mint:          palette.mint,       // #D4F0E0
// New semantic text colors matching design:
textDark:      '#2D1B26',   // design's `dark` — headings
textMid:       '#6B4D5A',   // design's `mid` — secondary body
textSoft:      '#A07888',   // design's `soft` — captions / muted
textLighter:   '#C9A8B8',   // design's `lighter` — inactive nav
```

### 1.4 Update background color

| Token | Current | Change To |
|---|---|---|
| `background` | `#FFF8FB` | `#FFF8F0` (design's `cream`) |

### 1.5 Update phase palette to match design exact values

| Current Phase | Current Value | Change To |
|---|---|---|
| `menstrual` | `#FF6B8A` | Keep `#FF6B8A` (already matches) |
| `follicular` | `#FFDAB9` | `#FFB3C6` (design's `blushLight`) |
| `ovulation` | `#D4F0E0` | Keep `#D4F0E0` (already `mint`) |
| `luteal` | `#E8D5F5` | Keep `#E8D5F5` (already `lavender`) |

### 1.6 Update danger palette

| Token | Current | Change To |
|---|---|---|
| `danger500` | `#D63B3B` | `#EF4444` (design's `red`) |
| Add `danger700` | — | `#DC2626` (design's `redD`, SOS active) |

### 1.7 Dark mode colors — add equivalents

In `darkColors`, add entries for all new light-mode tokens:

```typescript
// In darkColors:
accent:        palette.accent300,  // #C4B5FD (lighter for dark bg)
accentLight:   palette.accent700,  // #7E5BEF
roseQuartz:    palette.gray300,    // #C7CCD6
mint:          '#2D4A3A',
textDark:      palette.white,
textMid:       palette.gray100,
textSoft:      palette.gray300,
textLighter:   palette.gray500,
```

---

## 2. Typography Scale Update

**File:** `mobile/src/theme/tokens.ts`

Add these missing variants to the `typography` object:

```typescript
export const typography = {
  // ... existing entries ...

  // NEW — design-specific variants:
  h1Large: { fontSize: 28, fontWeight: '800' as const, lineHeight: 34, fontFamily: fonts.heading },
  // Usage: "Good morning, Sofia ✨", "Today's Entry"

  label: { fontSize: 10, fontWeight: '700' as const, lineHeight: 14, letterSpacing: '0.09em', fontFamily: fonts.body },
  // Usage: "STEP 1 OF 6", "NEXT PERIOD", "ENERGY LEVEL"

  heroValue: { fontSize: 36, fontWeight: '800' as const, lineHeight: 40, fontFamily: fonts.heading },
  // Usage: countdown numbers like "14" in "14 days"

  countdown: { fontSize: 54, fontWeight: '900' as const, lineHeight: 58, fontFamily: fonts.heading },
  // Usage: SOS countdown number

  chip: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, fontFamily: fonts.body },
  // Usage: symptom chips, phase pills

  greeting: { fontSize: 15, fontWeight: '500' as const, lineHeight: 20, fontFamily: fonts.body },
  // Usage: "Sunday, 27 July" date line
}
```

---

## 3. Shadow Presets

**File:** `mobile/src/theme/tokens.ts`

Add these new entries to the `shadow` object:

```typescript
export const shadow = {
  // ... existing sm, md, lg, soft, primary, sos ...

  // NEW — match design values:
  primary: {
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 8,
  },
  // Usage: primary buttons, hero cards

  soft: {
    shadowColor: '#D4A5B5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  // Usage: glass cards, elevated cards

  hero: {
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 48,
    elevation: 16,
  },
  // Usage: gradient hero cards on home

  chip: {
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.27,
    shadowRadius: 12,
    elevation: 3,
  },
  // Usage: active chip / pill
}
```

---

## 4. Typed Exports

Ensure `ThemeColors` type includes the new semantic fields. Update the `Theme` interface in `ThemeProvider.tsx` only if new shapes were added — otherwise type inference covers it.

---

## 5. Verify

After `tokens.ts` is updated:
1. Run `npx tsc --noEmit` to confirm no type errors
2. Run `npx eslint src/theme/` to confirm lint passes
3. Every screen that uses `useTheme().colors.*` will now automatically reference the new values
