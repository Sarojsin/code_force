# Day 10 — Integrate LunaOverlay into HomeDashboard

## Goal
Mount the `LunaOverlay` on the Home Dashboard screen so it's visible to users. Initialize the EventEngine so Luna reacts to user actions.

---

## 10.1 Modify `src/screens/home/HomeDashboardScreen.tsx`

### Add imports

```typescript
import { useEffect, useRef } from 'react';  // if not already
import { View } from 'react-native';  // if not already
import { LunaOverlay } from '../companion/LunaOverlay';
import { initEventEngine } from '../../services/companion/EventEngine';
import { useSpeechBubble } from '../../services/companion/EventEngine';
import { useCompanionStore } from '../../stores/companionStore';
import { FeatureFlagLocalService } from '../../services/localDb/FeatureFlagLocalService';
import { logger } from '../../utils';
```

### Inside `HomeDashboardScreen` component

Add state and effects to check feature flag and initialize the event engine:

```typescript
export function HomeDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  // ── Luna state ──
  const [lunaEnabled, setLunaEnabled] = useState(false);
  const lunaInitialized = useRef(false);
  const eventCleanupRef = useRef<(() => void) | null>(null);
  const { show: showBubble } = useSpeechBubble();

  // Check if Luna is installed
  useEffect(() => {
    (async () => {
      try {
        const flagService = new FeatureFlagLocalService();
        const enabled = await flagService.isLunaEnabled();
        setLunaEnabled(enabled);
      } catch (error) {
        logger.error('HomeDashboard.checkLunaFlag', error);
      }
    })();
  }, []);

  // Initialize EventEngine when Luna is enabled
  useEffect(() => {
    if (lunaEnabled && !lunaInitialized.current) {
      lunaInitialized.current = true;
      eventCleanupRef.current = initEventEngine(showBubble);
    }

    return () => {
      if (eventCleanupRef.current) {
        eventCleanupRef.current();
        eventCleanupRef.current = null;
        lunaInitialized.current = false;
      }
    };
  }, [lunaEnabled, showBubble]);

  // Hydrate companion store when user is loaded
  const user = useAuthStore((s) => s.user);
  const hydrateCompanion = useCompanionStore((s) => s.hydrate);

  useEffect(() => {
    if (lunaEnabled && user) {
      hydrateCompanion(user.id);
    }
  }, [lunaEnabled, user, hydrateCompanion]);

  // ... rest of existing HomeDashboardScreen code ...
}
```

### Add LunaOverlay to the render output

Find the `<SafeAreaView>` or the main wrapper `<View>` in the return JSX and add `LunaOverlay` **inside** it, after all other content but before the closing tag. It must be inside the same parent that covers the full screen.

```tsx
return (
  <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]}>
    <ScrollView ...>
      {/* existing dashboard content */}
    </ScrollView>

    {/* Luna Overlay — rendered only when installed */}
    {lunaEnabled && <LunaOverlay />}
  </SafeAreaView>
);
```

**Positioning note:** `LunaOverlay` uses `position: 'absolute', bottom: 8, right: 8` so it sits above the ScrollView content. This works because `SafeAreaView` is the relative positioning parent (the overlay has no `position: 'relative'` parent constraint, so it positions relative to the nearest ancestor with a defined frame — in this case the `SafeAreaView`).

---

## 10.2 Clean Event Unsubscribes — Prevent Memory Leaks During Navigation

**Critical:** When `HomeDashboardScreen` unmounts (e.g., user switches tabs or navigates away), the EventEngine cleanup function must remove all subscribers from the `eventBus`. Failure to do so causes:

- **Double reactions** — Luna reacts twice to the same event if the tab is re-mounted and a second subscription is added
- **Memory leaks** — stale closures hold references to unmounted components
- **XP duplication** — the same event awards XP multiple times

### Verify the cleanup in `useEffect` (already in the plan code)

```typescript
useEffect(() => {
  if (lunaEnabled && !lunaInitialized.current) {
    lunaInitialized.current = true;
    eventCleanupRef.current = initEventEngine(showBubble);
  }

  // ✅ Proper cleanup on unmount or lunaEnabled change
  return () => {
    if (eventCleanupRef.current) {
      eventCleanupRef.current();  // calls each eventBus.on() unsubscribe
      eventCleanupRef.current = null;
      lunaInitialized.current = false;  // allow re-init on remount
    }
  };
}, [lunaEnabled, showBubble]);
```

### Guard against rapid navigation (tab spamming)

React Navigation may mount/unmount the Home tab rapidly when the user swipes across tabs. Use a debounce or an additional guard:

```typescript
import { useIsFocused } from '@react-navigation/native';

export function HomeDashboardScreen() {
  const isFocused = useIsFocused();

  // Only render Luna when the Home tab is focused
  // This also unmounts EventEngine when switching away
  {isFocused && lunaEnabled && <LunaOverlay />}
}
```

### Verify no duplicate subscriptions

Add a quick test to confirm the event bus has exactly the expected number of listeners:

```typescript
// In the EventEngine test or a debug utility:
console.log('journal_saved listeners:', eventBus.listenerCount('journal_saved'));
// Expected: 1 when HomeDashboard is mounted, 0 when unmounted
```

### Update the edge cases table

Replace the last row in the Edge Cases section with a more detailed entry:

| Case | Expected Behavior |
|------|-------------------|
| User switches tabs rapidly (spam taps) | Each mount → cleanup cycle runs correctly; no duplicate subscriptions |
| HomeDashboard unmounts during navigation | Event cleanup removes all subscribers; no stale closures |
| Remount after unmount | `lunaInitialized.current` is `false`, so EventEngine re-initializes cleanly |
| HomeDashboard re-renders from parent state change | `lunaInitialized` ref prevents double initialization |

When `lunaEnabled` is `false`, neither the event engine nor the overlay is initialized. This means zero performance impact for users who don't install Luna — exactly as the plan specifies.

---

## 10.3 Handle User Logout

When the user logs out, the EventEngine should be cleaned up and the companion store reset.

In `AuthStore` or the logout handler in `SettingsScreen`:

```typescript
// In the logout handler:
if (eventCleanupRef.current) {
  eventCleanupRef.current();
  eventCleanupRef.current = null;
}
useCompanionStore.getState().reset();
```

---

## 10.4 Test Integration

1. Launch app without Luna installed → Dashboard looks normal, no overlay
2. Install Luna via Settings → Go back to Dashboard → Luna appears
3. Log a period → Luna reacts with celebration animation + speech bubble
4. Log a mood → Luna reacts with mood-appropriate animation
5. Save a journal → Luna says a journal-related message + awards XP
6. Tap Luna → Pet reaction
7. Wait 30 seconds → Luna falls asleep
8. Uninstall Luna → Luna disappears from Dashboard
9. Re-install → Luna reappears with previous XP intact
10. Logout → Luna cleanup happens, no memory leaks

---

## 10.5 Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| User switches tabs and comes back | Luna still there, idle animation resumes |
| User locks phone, unlocks | App foreground triggers welcome back message |
| User is offline | Luna works fine (everything is local) |
| User has very slow device | `reduceAnimations` helps, but even full mode uses lightweight Reanimated |
| Rapid event firing (e.g., logging 10 moods quickly) | EventEngine processes each; speech bubbles may overlap but animations play in sequence via priority |
| HomeDashboard re-renders | `lunaInitialized` ref prevents double initialization |

---

## ✅ Day 10 Validation

- [ ] `LunaOverlay` rendered conditionally on HomeDashboard based on `luna_enabled`
- [ ] `initEventEngine()` called once when Luna first becomes enabled
- [ ] Event engine cleanup on unmount / logout
- [ ] Companion store hydrated when user loads
- [ ] Zero impact on dashboard when Luna is not installed
- [ ] Luna visible and interactive on HomeDashboard
- [ ] App state transitions (foreground/background) handled
- [ ] Tab switching preserves Luna state
- [ ] No memory leaks from event listeners
- [ ] App builds without TypeScript errors
