# uiplan4 — Luna Overlay + Animation Hooks

> **Phase 5 (Luna) + Phase 7 (Animations).** Can run in parallel with screen overhauls.
> **Priority:** Medium
> **Files:** 2 to create, 1 to modify

---

## 1. Animation Hooks — CREATE `mobile/src/hooks/usePressScale.ts`

Reusable press-feedback hook matching design spec:

```typescript
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export function usePressScale(scaleTo = 0.96) {
  const scale = useSharedValue(1);

  const onPressIn = () => {
    scale.value = withSpring(scaleTo, { damping: 12, stiffness: 200 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, onPressIn, onPressOut };
}
```

### Usage in all pressable components

Apply to: `Button`, `Card` (interactive), `Chip`, calendar day cells, mood items, nav buttons, SOS button.

---

## 2. Staggered Entrance — CREATE `mobile/src/hooks/useStaggerEntrance.ts`

Matches design's staggered `anim-up anim-d1..6` pattern:

```typescript
import { useSharedValue, useAnimatedStyle, withDelay, withSpring } from 'react-native-reanimated';

export function useStaggerEntrance(delayMs: number, index: number) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  // On mount:
  React.useEffect(() => {
    opacity.value = withDelay(delayMs * index, withSpring(1, { damping: 20 }));
    translateY.value = withDelay(delayMs * index, withSpring(0, { damping: 20 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return animatedStyle;
}
```

### Design animation class mapping

| CSS Class | Reanimated Equivalent | Delay Pattern |
|---|---|---|
| `anim-up` | `useStaggerEntrance(70, i)` | Opacity 0→1, translateY 20→0 |
| `anim-fade` | `withTiming(1, { duration: 350 })` | Opacity only |
| `anim-spring` | `withSpring(1, { damping: 10 })` | Spring scale from 0.8 |
| `anim-float` | `withRepeat(...)` | translateY -6→0 loop, 4s |
| `anim-d1` through `anim-d6` | `useStaggerEntrance(70, i)` | Sequential delays per index |

### Usage in screens

```typescript
// Home dashboard card entrance:
const cardStyle = useStaggerEntrance(70, cardIndex);
<Animated.View style={cardStyle}>
  <Card>...</Card>
</Animated.View>
```

---

## 3. Luna Context Service — CREATE `mobile/src/services/companion/lunaContext.ts`

Port `getLunaContext()` from design file (lines 278–336 of `App.tsx`):

```typescript
export type LunaAnimation = 'idle' | 'walk-right' | 'walk-left' | 'bounce';
export type LunaScreen = 'home' | 'calendar' | 'journal' | 'sos' | 'wellness' | 'chat' | 'settings' | 'onboarding';

export interface LunaContext {
  animation: LunaAnimation;
  message: string;
  actionLabel?: string;
}

export function getLunaContext(
  screen: LunaScreen,
  opts: {
    lunaEnabled: boolean;
    pregnancyMode: boolean;
    currentPhase?: string;
    selectedDate?: number | null;
    selectedPhase?: string | null;
    mood?: string | null;
    energy?: number;
    wellnessTab?: string;
    week?: number;
    trimester?: number;
    babySize?: string;
  },
): LunaContext {
  // Exact same logic as design:
  // - home (pregnancy → week/trimester/babySize, else → cycle phase)
  // - calendar (selected date + phase)
  // - journal (mood + energy + sentiment)
  // - wellness (tab-specific metric)
  // - chat ("Ask about cramps, sleep, or nutrition 🌸")
  // - settings ("Luna insights on · Pregnancy on")
  // - sos ("Emergency contacts ready 🆘")
  // - onboarding ("Complete setup to unlock insights ✨")
}
```

### Data flow

The HomeDashboard screen passes current data to `LunaOverlay` via this context. Add to `LunaOverlay` props:

```typescript
export interface LunaOverlayProps {
  screen: LunaScreen;
  lunaEnabled: boolean;
  pregnancyMode: boolean;
  // ... other context values
}
```

---

## 4. LunaOverlay — `mobile/src/screens/companion/LunaOverlay.tsx`

### Visual restyle

| Aspect | Current | Target |
|---|---|---|
| Avatar size | 72×72 | 60×60 |
| Avatar bg | Solid from sprite | Gradient `#FFB3C6 → #FF6B8A` + white border 2.5px |
| Avatar shadow | None | `0 8px 24px rgba(255,107,138,0.35)` |
| Position | `bottom: 8, right: 8` | `bottom: 96, right: 14` (above tab bar) |
| Current bubble | Speech bubble with arrow | Add expand/collapse toggle |

### Expandable bubble — new feature

Add state `const [expanded, setExpanded] = useState(false)`.

When expanded, render above the avatar:

```
┌──────────────────────┐
│ [LUNA avatar] LUNA   ×│  ← dismiss button
│                      │
│ Contextual message   │
│                      │
│ [Action label →]     │
│            ┌──┐      │
│            │▬▬│ tail │
└────────────┴──┴──────┘
       ┌──────────┐
       │ 🐱avatar │  ← tap to toggle
       └──────────┘
```
- Bubble: 210px wide, glass bg (rgba + blur), borderRadius 22
- Tail: 14×14 rotated square (45deg), bottom-right aligned
- Header: 28px avatar circle + "LUNA" label
- Context message: 12px, lineHeight 1.6
- Dismiss × button: 26×26 circle, top-right

### Animation states

Map from `LunaContext.animation` to Reanimated:

```typescript
switch (ctx.animation) {
  case 'idle':
    // withRepeat(withSequence(withTiming(-6), withTiming(0)), -1, true) — float
    break;
  case 'walk-right':
    // translateX from -160 to 0, linear 7s
    break;
  case 'walk-left':
    // translateX from 160 to 0, linear 7s
    break;
  case 'bounce':
    // withSequence(withTiming(-14), withTiming(0)) — bounce 900ms
    break;
}
```

Apply via `useAnimatedStyle` on the avatar container.

---

## 5. SOS Pulse Animation — `mobile/src/screens/safety/SafetyHomeScreen.tsx`

Add pulsing ring around the SOS button:

```typescript
const ringScale = useSharedValue(1);
const ringOpacity = useSharedValue(0.6);

useEffect(() => {
  ringScale.value = withRepeat(
    withSequence(
      withTiming(1.15, { duration: 1000 }),
      withTiming(1, { duration: 1000 }),
    ),
    -1, true,
  );
  ringOpacity.value = withRepeat(
    withSequence(
      withTiming(0, { duration: 1000 }),
      withTiming(0.6, { duration: 1000 }),
    ),
    -1, true,
  );
}, []);

const ringStyle = useAnimatedStyle(() => ({
  transform: [{ scale: ringScale.value }],
  opacity: ringOpacity.value,
}));
```

Render two ring layers behind the SOS button:

```typescript
<Animated.View style={[ringStyle, {
  position: 'absolute', width: 180, height: 180,
  borderRadius: 90, borderWidth: 2, borderColor: 'rgba(239,68,68,0.6)',
}]} />
```

---

## 6. Verify

1. Luna avatar appears at bottom-right (96px from bottom, 14px from right)
2. Tap Luna → expand bubble with contextual message
3. Dismiss × closes bubble
4. Messages change based on screen (home, calendar, journal, etc.)
5. Animation state matches screen context (idle, walk-right, bounce)
6. All pressable elements on screen have spring-scale feedback
7. Cards on home dashboard stagger in with sequential delays
8. SOS button has pulsing ring animation
