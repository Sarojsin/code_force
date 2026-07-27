# Phase 2 Day 7 — AnimationEngine Sound Triggers

## Goal
Integrate sound playback into the AnimationEngine so that each animation state triggers the corresponding sound effect automatically. Wire the `soundEngine` into the animation state machine without requiring manual `playSound` calls from higher-level components.

---

## 7.1 Update `AnimationEngine.ts` — Sound Integration

**File:** `src/services/companion/AnimationEngine.ts`

Add a playSound callback parameter to the animation functions so sounds play automatically when an animation transitions to a sound-capable state.

```typescript
import { soundEngine } from './SoundEngine';

// ── Add to the playAnimation function ──
function playAnimation(
  state: AnimationState,
  options?: { reduceAnimations?: boolean; muteSounds?: boolean }
) {
  const config = ANIMATION_CONFIGS[state];
  if (!config) return;

  // ... existing animation logic ...

  // Play sound for this animation state (non-blocking)
  if (!options?.muteSounds) {
    soundEngine.playForAnimation(state);
  }
}
```

**Alternative approach: hook-based integration.** If `AnimationEngine.ts` exports a custom hook (`useAnimationEngine`), add a `useEffect` that watches the animation state and triggers sounds:

```typescript
// Inside the hook or component:
const [currentAnimation, setCurrentAnimation] = useState<AnimationState>('idle');

useEffect(() => {
  soundEngine.playForAnimation(currentAnimation);
}, [currentAnimation]);
```

**Recommended: Event-driven integration.** The simplest approach with minimal coupling — emit an event when the animation changes and have the sound engine listen:

```typescript
// In the animation setter function:
const setAnimation = (newState: AnimationState) => {
  currentAnimationRef.current = newState;
  // ... animation logic ...
  eventBus.emit('luna_animation_changed', { state: newState });
};

// In SoundEngine.ts or a setup file:
eventBus.on('luna_animation_changed', ({ state }) => {
  soundEngine.playForAnimation(state);
});
```

**Choose one approach.** For Phase 2, the **event-driven** approach is cleanest because it decouples animation from audio entirely.

---

## 7.2 Add `luna_animation_changed` Event

**File:** `src/services/eventBus.ts`

```typescript
// In EventMap:
luna_animation_changed: { state: string };
```

---

## 7.3 Wire SoundEngine Subscription

**File:** `src/services/companion/SoundEngine.ts` — Add a setup method:

```typescript
import { eventBus } from '../eventBus';

// Add to SoundEngine class:
private unsub: (() => void) | null = null;

setupEventSubscription(): void {
  if (this.unsub) return;
  this.unsub = eventBus.on('luna_animation_changed', ({ state }) => {
    this.playForAnimation(state);
  });
}

teardownEventSubscription(): void {
  this.unsub?.();
  this.unsub = null;
}
```

Call `setupEventSubscription()` during `loadAssets()` or in the `initEventEngine` flow. Call `teardownEventSubscription()` during `unloadAssets()`.

---

## 7.4 Update `LunaOverlay.tsx` — Emit Animation Events

**File:** `src/screens/companion/LunaOverlay.tsx`

Wherever the animation state is updated (e.g., `setCurrentAnimation('happy')`), emit the event:

```typescript
import { eventBus } from '../../services/eventBus';

// Inside the animation state setter:
const animateTo = (state: AnimationState) => {
  setCurrentAnimation(state);
  eventBus.emit('luna_animation_changed', { state });
};
```

This ensures every animation transition (idle blink, happy, pet, sleep, celebrate) triggers the correct sound automatically.

---

## 7.5 Update `installLuna`/`uninstallLuna` Flow

**File:** `src/services/assetDownloader.ts`

In `installLuna()`:

```typescript
// After soundEngine.loadAssets():
soundEngine.setupEventSubscription();
```

In `uninstallLuna()`:

```typescript
soundEngine.teardownEventSubscription();
await soundEngine.unloadAssets();
```

---

## 7.6 Validation

- [ ] Animation state transitions emit `luna_animation_changed` event
- [ ] `SoundEngine.setupEventSubscription()` listens for the event
- [ ] `happy` animation triggers meow sound
- [ ] `pet` animation triggers purr sound
- [ ] `sleep` animation triggers yawn sound
- [ ] `celebrate` animation triggers celebrate sound
- [ ] `muteSounds: true` prevents all sound playback
- [ ] Event subscription cleaned up on `teardownEventSubscription()`
- [ ] `installLuna` wires up the sound subscription
- [ ] `uninstallLuna` tears down all sound state
- [ ] `tsc --noEmit` passes with 0 new errors
