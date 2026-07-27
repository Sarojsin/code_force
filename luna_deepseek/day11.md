# Day 11 — Tap-to-Pet + Idle Animations

## Goal
Polish the interactive experience: tap-to-pet with XP reward, auto-idle blink, sleep transition, and smooth animation sequencing.

---

## 11.1 Enhance the Pet Interaction

Currently the `LunaOverlay` has a basic tap handler. Enhance it to:

1. Play a richer pet animation sequence
2. Award XP for petting (with cooldown to prevent spam)
3. Show a heart burst animation
4. Cycle through different pet reactions

### Update `src/screens/companion/LunaOverlay.tsx`

Replace the `handleTap` function with an enhanced version:

```typescript
// ── Pet cooldown (prevent spam) ──
const PET_COOLDOWN_MS = 5000;
const [petCount, setPetCount] = useState(0);

// ── Persist last pet time to SQLite memory (survives restarts) ──
const lastPetTime = useRef(useCompanionStore.getState().memory?.lastPetTime ?? 0);

const handleTap = useCallback(() => {
  if (isHidden) return;

  const now = Date.now();
  if (!reduceAnimations) {
    // Cycle through pet animations
    const petAnimations: AnimationState[] = ['pet', 'wave', 'happy'];
    const animIndex = petCount % petAnimations.length;
    play(petAnimations[animIndex]);
    setPetCount((c) => c + 1);
  }

  // ── Show heart feedback ──
  setShowTapFeedback(true);
  setTimeout(() => setShowTapFeedback(false), 800);

  // ── Award XP (with cooldown, cooldown persisted in SQLite memory) ──
  if (now - lastPetTime.current > PET_COOLDOWN_MS) {
    lastPetTime.current = now;
    useCompanionStore.getState().updateMemory('lastPetTime', now);
    useCompanionStore.getState().addXP(1); // 1 XP per pet
    useCompanionStore.getState().addCoins(1);
  }

  // ── Speech bubble ──
  const { dialogueEngine } = require('../../services/companion/DialogueEngine');
  showBubble(dialogueEngine.get('petted'), 'pet', 3000);

  // ── Reset inactivity timer ──
  resetInactivityTimer();
}, [isHidden, reduceAnimations, petCount, play, showBubble, resetInactivityTimer]);
```

---

## 11.2 Add Heart Burst Animation

Replace the simple `💕` text with a small animated burst:

```tsx
// ── Heart burst ──
const hearts = useSharedValue(0);
const heartStyle = useAnimatedStyle(() => ({
  opacity: hearts.value,
  transform: [
    { translateY: -hearts.value * 20 },
    { scale: 1 + hearts.value * 0.5 },
  ],
}));

// Inside handleTap, after setShowTapFeedback(true):
hearts.value = withSequence(
  withTiming(1, { duration: 200, easing: Easing.out(Easing.back(2)) }),
  withDelay(400, withTiming(0, { duration: 200 }))
);

// In JSX, replace the static heart:
{showTapFeedback && (
  <Animated.View style={[styles.tapFeedback, heartStyle]}>
    <Text style={styles.heartText}>💕</Text>
  </Animated.View>
)}
```

Also, rotate between multiple heart emojis:

```typescript
const HEART_EMOJIS = ['💕', '❤️', '💗', '💖', '🐾'];
const heartEmoji = HEART_EMOJIS[petCount % HEART_EMOJIS.length];
```

---

## 11.3 Idle Animation Sequence

The cat should not just blink — it should have a natural idle behavior:

| Time | Action |
|------|--------|
| 0–10s | Idle blink every 4 seconds |
| 10–20s | Look around (subtle head rotation via scaleX) |
| 20–30s | Stretch (scale up slightly) |
| 30s+ | Sleep (fade opacity oscillation) |

### Implement in `LunaOverlay.tsx`

```typescript
// ── Idle animation state machine ──
const idleStage = useRef(0);
const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

const startIdleCycle = useCallback(() => {
  if (reduceAnimations) return;

  idleStage.current = 0;

  if (idleTimer.current) clearInterval(idleTimer.current);

  idleTimer.current = setInterval(() => {
    idleStage.current += 1;

    switch (idleStage.current) {
      case 1: case 2: // Blink
        if (!isAnimating('idle') && !isAnimating('sleep')) {
          play('idle_blink');
        }
        break;
      case 5: // Look around
        if (!isAnimating('idle') && !isAnimating('sleep')) {
          // Subtle scaleX pulse
          scale.value = withSequence(
            withTiming(1.02, { duration: 300 }),
            withTiming(0.98, { duration: 300 }),
            withTiming(1, { duration: 300 })
          );
        }
        break;
      case 8: // Stretch
        if (!isAnimating('idle') && !isAnimating('sleep')) {
          scale.value = withSequence(
            withTiming(1.08, { duration: 400 }),
            withTiming(1, { duration: 400 })
          );
        }
        break;
      case 10: // Fall asleep (after ~40 seconds)
        setIsSleeping(true);
        play('sleep');
        if (idleTimer.current) clearInterval(idleTimer.current);
        break;
    }
  }, 4000); // Every 4 seconds
}, [reduceAnimations, isAnimating, play, scale]);

// Call startIdleCycle instead of simple blink
useEffect(() => {
  if (!isHidden && !reduceAnimations) {
    startIdleCycle();
  }
  return () => {
    if (idleTimer.current) clearInterval(idleTimer.current);
  };
}, [isHidden, reduceAnimations, startIdleCycle]);
```

---

## 11.4 Wake from Sleep on Interaction

When the user taps or scrolls, Luna should wake up:

```typescript
// Reset idle (wake up)
const wakeUp = useCallback(() => {
  if (isSleeping) {
    setIsSleeping(false);
    if (!reduceAnimations) {
      // Wake stretch
      scale.value = withSequence(
        withTiming(1.1, { duration: 200 }),
        withTiming(1, { duration: 200 })
      );
      opacity.value = withTiming(1, { duration: 200 });
      // Yawn message
      const { dialogueEngine } = require('../../services/companion/DialogueEngine');
      showBubble('Yawn... Good morning! 🌸', 'wave', 2500);
    }
  }
  resetInactivityTimer();
}, [isSleeping, reduceAnimations, scale, opacity, showBubble, resetInactivityTimer]);

// Call wakeUp at the start of handleTap
```

---

## 11.5 Add Pet Counter Persistence

Remember how many times the user has petted Luna today:

```typescript
// In companionStore.ts, add:
petCountToday: number;
// In hydrate, load from memory:
petCountToday: (meta.memory?.petCountToday as number) ?? 0;

// In setOutfit or a new action:
updateMemory('petCountToday', (memory.petCountToday as number ?? 0) + 1);
```

---

## 11.6 Test Pet Interactions

1. Tap Luna → Pet animation + heart burst + speech bubble
2. Tap again within 5 seconds → Animation plays but no XP awarded (cooldown)
3. Tap after cooldown → XP +1, coins +1
4. Tap 5 times → Different pet animation cycles through
5. Leave idle for 10 seconds → Blink animation
6. Leave idle for 20 seconds → Look around + stretch
7. Leave idle for 40 seconds → Luna falls asleep
8. Tap sleeping Luna → Wake animation + yawn message
9. Enable "Reduce Animations" → No animations, tap just triggers speech bubble
10. XP bar updates after each pet (cooldown respected)

---

## ✅ Day 11 Validation

- [ ] Tap-to-pet plays animation (cycles through pet/wave/happy)
- [ ] Heart burst animation with rotating emojis
- [ ] XP awarded on pet with 5-second cooldown
- [ ] Idle cycle: blink → look → stretch → sleep
- [ ] Sleeping state has breathing opacity animation
- [ ] Tap sleeping cat → wake animation + yawn message
- [ ] Inactivity timer resets on tap / scroll / event
- [ ] "Reduce Animations" disables all idle animations
- [ ] Pet cooldown (`lastPetTime`) persists in SQLite memory column (survives app restart)
- [ ] Idle cycle has `reduceAnimations` guard at the start of `startIdleCycle()`
- [ ] Pet count tracked and persisted
- [ ] All animations use Reanimated (no layout thrashing)
- [ ] App builds without TypeScript errors
