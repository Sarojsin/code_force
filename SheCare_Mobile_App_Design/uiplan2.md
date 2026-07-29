# uiplan2 — Shared Component Overhaul

> **Phase 2 — Design-system components.** All screens depend on these.
> **Priority:** High
> **Files:** 6 to modify, 1 to create

---

## 1. Button — `mobile/src/components/ui/Button.tsx`

### Changes

| Aspect | Current | Target |
|---|---|---|
| Primary bg | Solid `theme.colors.primary` (#FF5C8A) | `expo-linear-gradient` with `['#FF6B8A', '#D4507A']` |
| `borderRadius` | 12 | 16 (all sizes) |
| Primary shadow | None | `shadow.primary` (0 8px 24px rgba(255,107,138,0.38)) |
| Disabled opacity | 0.6 | Explicit bg `rgba(160,120,136,0.25)`, text `#A07888` |
| Press anim | `withSpring(0.96)` | Keep, but change `damping: 12` for snappier feel |
| Letter spacing | None | Add `letterSpacing: '0.01em'` on text |
| Gradient clipping | — | Add `overflow: 'hidden'` to container |

### New variant — `'ghost'`

Add to `ButtonVariant` type:

```typescript
case 'ghost':
  return {
    container: {
      backgroundColor: 'rgba(255,255,255,0.6)',
      borderWidth: 1.5,
      borderColor: '#F7C5CC',
    },
    text: { color: '#FF6B8A' },
  };
```

### Implementation approach — gradient primary

```typescript
// Replace solid backgroundColor with:
import { LinearGradient } from 'expo-linear-gradient';

// In the render, when variant === 'primary':
<LinearGradient colors={['#FF6B8A', '#D4507A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
  // ... button content inside
</LinearGradient>
```

Wrap inside `AnimatedPressable` with `overflow: 'hidden'` for the gradient.

---

## 2. Card — `mobile/src/components/ui/Card.tsx`

### Changes

| Aspect | Current | Target |
|---|---|---|
| `borderRadius` | `theme.radius.lg` (16) | Default 22 (bento), add `variant` prop |
| Shadow | Optional `elevated` | Per-variant defaults |
| Press animation | None | New `onPress` prop triggers scale 0.96 spring |
| Glass variant | None | New variant with blur + transparency |

### Add `variant` prop

```typescript
export type CardVariant = 'standard' | 'hero' | 'glass' | 'flat';

export interface CardProps extends ViewProps {
  children: ReactNode;
  padded?: boolean;
  variant?: CardVariant;
  onPress?: () => void;
}
```

### Variant styles

| Variant | borderRadius | Background | Shadow | Border |
|---|---|---|---|---|
| `standard` | 16 | `theme.colors.surface` | `theme.shadow.md` | hairlineWidth border |
| `hero` | 26 | transparent (caller provides gradient) | `theme.shadow.hero` | none |
| `glass` | 22 | `rgba(255,248,240,0.72)` + BlurView | `theme.shadow.soft` | 1px solid rgba(255,255,255,0.9) |
| `flat` | 22 | `theme.colors.surface` | none | 1px solid roseQuartz-44 |

### Glass card implementation

```typescript
import { BlurView } from 'expo-blur';

// When variant === 'glass':
<BlurView intensity={20} tint="light" style={[styles.glass, style]}>
  {children}
</BlurView>
```

### Press animation

When `onPress` is provided, wrap in `AnimatedPressable`:

```typescript
<AnimatedPressable
  onPress={onPress}
  onPressIn={() => { scale.value = withSpring(0.96); }}
  onPressOut={() => { scale.value = withSpring(1); }}
  style={[animatedStyle]}
>
  {children}
</AnimatedPressable>
```

---

## 3. MoodPicker — `mobile/src/components/ui/MoodPicker.tsx`

### Replace current grid with design spec

```typescript
export const DESIGN_MOODS: MoodOption[] = [
  { id: 'radiant',   label: 'Radiant',   emoji: '✨' },
  { id: 'calm',      label: 'Calm',      emoji: '🌸' },
  { id: 'energized', label: 'Energized', emoji: '⚡' },
  { id: 'anxious',   label: 'Anxious',   emoji: '🌊' },
  { id: 'tired',     label: 'Tired',     emoji: '🌙' },
  { id: 'sad',       label: 'Sad',       emoji: '🌧️' },
];
```

### Per-mood colors

```typescript
const MOOD_COLORS: Record<string, { bg: string; selected: string; border: string }> = {
  radiant:   { bg: '#FFE8EF', selected: '#FF6B8A', border: '#FF6B8A33' },
  calm:      { bg: '#FAF0F4', selected: '#D4A5B5', border: '#D4A5B533' },
  energized: { bg: '#FFF4E3', selected: '#F5A623', border: '#F5A62333' },
  anxious:   { bg: '#E8F2FF', selected: '#6BA8E8', border: '#6BA8E833' },
  tired:     { bg: '#F0E8FA', selected: '#9B6BD4', border: '#9B6BD433' },
  sad:       { bg: '#EDF3FA', selected: '#7B9EC8', border: '#7B9EC833' },
};
```

### Layout changes

- Grid: **3 columns** (not 4)
- Each button: `minHeight: 68`, `borderRadius: 18`
- Selected: filled with `mood.selected` color, `boxShadow: 0 6px 18px mood.selected-55`, `scale(1.06)`
- Unselected: `mood.bg` background, border `1.5px solid mood.border`
- Emoji: 28px, label: 11px weight 700 below emoji

---

## 4. SymptomGrid — `mobile/src/components/ui/SymptomGrid.tsx`

### Changes

| Aspect | Current | Target |
|---|---|---|
| Chip shape | bordered rectangle | pill (`borderRadius: 100px`) |
| Active bg | `theme.colors.primary` | `#FF6B8A` with `scale(1.05)` + shadow |
| Inactive bg | transparent | `rgba(255,255,255,0.75)` |
| Inactive border | `theme.colors.border` | `1.5px solid theme.colors.primary + '44'` |
| Padding | `px: lg, py: auto` | `px: 13, py: 5` |
| Press animation | none | Reanimated spring 0.95 → 1.0 |

---

## 5. ProgressDots — `mobile/src/components/ui/ProgressDots.tsx`

### Changes

| Aspect | Current | Target |
|---|---|---|
| Active dot width | 20px | 24px |
| Inactive dot width | 8px | 8px (unchanged) |
| Height | 8px | 8px (unchanged) |
| `borderRadius` | 4 | 4 (unchanged) |
| Active color | `theme.colors.primary` | `#FF6B8A` |
| Inactive color | `theme.colors.border` | `#F7C5CC88` (rose + 53% opacity) |

### Animation

Add `useAnimatedStyle` for width transition:

```typescript
const animStyle = useAnimatedStyle(() => ({
  width: withSpring(isActive ? 24 : 8, { damping: 15 }),
}));
```

### Format change

Remove `<Text variant="caption">1/6</Text>` — design shows "STEP X OF 6" as a **label above the dots**, not inside. Move that text to the parent screen.

---

## 6. Calendar — `mobile/src/components/ui/Calendar.tsx`

### Day cell changes

| Aspect | Current | Target |
|---|---|---|
| Size | `minWidth/Height: 44` | Fixed `width: 46, height: 46` |
| `borderRadius` | `pill` (999) | 14 |
| Selected bg | `theme.colors.primary` | Phase accent color (menstrual=#FF6B8A, follicular=#F5A623, etc.) |
| Selected shadow | none | `0 4px 14px phaseAccent + '55'` |
| Today indicator | blue ring | 2px `#FF6B8A` outline + inner 4px red dot at bottom |
| Period day | filled pink | filled `#FF6B8A` |
| Predicted period | none | outlined `#FF6B8A` with `borderStyle: 'dashed'` |
| Day content | `Text` + optional dot | Day number centered, dot only on today-not-selected |

### Phase legend (new — add above calendar grid)

Add a horizontal row above the weekday headers:

```typescript
const PHASES = [
  { id: 'menstrual',  emoji: '🩸', label: 'Menstrual',  bg: '#FFE4EC', fg: '#B83058' },
  { id: 'follicular', emoji: '🌱', label: 'Follicular', bg: '#FFF4E3', fg: '#A0621A' },
  { id: 'ovulation',  emoji: '🌟', label: 'Ovulation',  bg: '#E5F9F0', fg: '#1A6B45' },
  { id: 'luteal',     emoji: '🌙', label: 'Luteal',     bg: '#EFE8FA', fg: '#5A35A0' },
];

<View style={{ flexDirection: 'row', gap: 7, marginBottom: 18 }}>
  {PHASES.map(p => (
    <View style={{
      flexDirection: 'row', gap: 5,
      background: p.bg, borderRadius: 20,
      padding: '5px 10px',
      borderWidth: 1, borderColor: `${p.fg}22`,
    }}>
      <Text>{p.emoji}</Text>
      <Text style={{ fontSize: 11, fontWeight: 700, color: p.fg }}>{p.label}</Text>
    </View>
  ))}
</View>
```

---

## 7. Toggle — CREATE `mobile/src/components/ui/Toggle.tsx`

New component matching design spec exactly:

```typescript
export interface ToggleProps {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ on, onChange, disabled }: ToggleProps) {
  // Track: 50×28px, borderRadius 14
  // On: linear-gradient(135deg, #FF6B8A, #D4507A)
  // Off: rgba(160,120,136,0.20)
  // Thumb: 22×22 white circle, borderRadius 50%
  //   position: absolute, top: 3, left: on ? 25 : 3
  //   boxShadow: 0 2px 6px rgba(0,0,0,0.18)
  // Transition: left 0.28s cubic-bezier(0.34,1.56,0.64,1) → Reanimated withSpring
}
```

Used in: SettingsScreen (notifications, biometrics, pregnancy mode, AI insights toggles), Onboarding screens.

---

## 8. Verify

After all component changes:
1. `npx tsc --noEmit` — zero type errors
2. Run `npx eslint src/components/ui/` — lint clean
3. Visually verify each component in isolation (Storybook or dev screen)
