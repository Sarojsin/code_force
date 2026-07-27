# Day 7 — LunaOverlay UI Component

## Goal
Build the floating Luna overlay component that sits above the Home Dashboard. Shows the cat sprite, a speech bubble, an XP bar, and handles pet interactions.

---

## 7.1 Create `src/screens/companion/LunaOverlay.tsx`

```tsx
/**
 * LunaOverlay — Floating cat companion that sits above the Home Dashboard.
 *
 * Position: bottom-right corner, above the tab bar.
 * States:
 *   - Hidden: feature disabled or user toggled off
 *   - Idle: static cat with occasional blink
 *   - Speaking: speech bubble visible + animation
 *   - Pet: user taps the cat
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  AppState,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useCompanionStore } from '../../stores/companionStore';
import { useAnimationEngine, LunaSprite, areAssetsInstalled } from '../../services/companion';
import { useSpeechBubble } from '../../services/companion/EventEngine';
import { eventBus } from '../../services/eventBus';
import { Text, Loader } from '../../components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LUNA_SIZE = 72;
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.55;

interface LunaOverlayProps {
  /** Called when the event engine should be re-initialized */
  onInit?: (cleanup: () => void) => void;
}

export function LunaOverlay({ onInit }: LunaOverlayProps) {
  // ── Store ──
  const isHidden = useCompanionStore((s) => s.isHidden);
  const reduceAnimations = useCompanionStore((s) => s.reduceAnimations);
  const xp = useCompanionStore((s) => s.xp);
  const level = useCompanionStore((s) => s.level);
  const xpToNext = useCompanionStore((s) => s.xpToNext);
  const levelTitle = useCompanionStore((s) => s.levelTitle);
  const installStatus = useCompanionStore((s) => s.installStatus);

  // ── Asset readiness ──
  const [assetsReady, setAssetsReady] = useState(false);
  useEffect(() => {
    areAssetsInstalled().then(setAssetsReady);
  }, []);

  // ── Animation engine ──
  const { play, animatedStyle, isAnimating } = useAnimationEngine();

  // ── Speech bubble ──
  const { current: speech, show: showBubble } = useSpeechBubble();

  // ── Drag position ──
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // ── Tap animation ──
  const [showTapFeedback, setShowTapFeedback] = useState(false);

  // ── Pulse animation for idle ──
  const pulseAnim = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  // ── Play idle blink after inactivity ──
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSleeping, setIsSleeping] = useState(false);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    setIsSleeping(false);
    if (!reduceAnimations) {
      play('idle_blink');
    }
    inactivityTimer.current = setTimeout(() => {
      setIsSleeping(true);
      if (!reduceAnimations) {
        play('sleep');
      }
    }, 30000); // 30 seconds idle → sleep
  }, [reduceAnimations, play]);

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  // ── Handle speech bubble events from EventEngine ──
  // The EventEngine calls showBubble() — we pass it via onInit
  useEffect(() => {
    if (onInit) {
      const cleanup = () => {}; // EventEngine cleanup
      onInit(cleanup);
    }
  }, [onInit]);

  // ── Listen for app state changes ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        resetInactivityTimer();
      }
    });
    return () => sub.remove();
  }, [resetInactivityTimer]);

  // ── Speech bubble → play animation; bubble gone → revert to idle ──
  useEffect(() => {
    if (speech) {
      resetInactivityTimer();
      if (!reduceAnimations) {
        play(speech.animation);
      }
    } else {
      // Bubble disappeared — revert to idle animation
      if (!reduceAnimations) {
        play('idle');
      }
    }
  }, [speech?.id]);

  // ── Handle tap ──
  const handleTap = useCallback(() => {
    if (isHidden) return;
    resetInactivityTimer();

    // Play pet animation
    if (!reduceAnimations) {
      play('pet');
    }

    // Show tap feedback
    setShowTapFeedback(true);
    setTimeout(() => setShowTapFeedback(false), 500);

    // Emit petted event for XP
    eventBus.emit('luna_petted', { userId: useCompanionStore.getState().userId ?? '' });

    // Speech bubble
    const { dialogueEngine } = require('../../services/companion/DialogueEngine');
    showBubble(dialogueEngine.get('petted'), 'pet', 3000);
  }, [isHidden, reduceAnimations, resetInactivityTimer, play, showBubble]);

  // ── Pan gesture for dragging (replaces old handleDrag) ──
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      // Snap to a grid-like position (optional rounding)
      translateX.value = withSpring(Math.round(translateX.value / 10) * 10);
      translateY.value = withSpring(Math.round(translateY.value / 10) * 10);
    })
    .minDistance(10);

  // ── Draggable style ──
  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  // ── Don't render if hidden ──
  if (isHidden) return null;

  // Construct the inner content (shared by all states)
  const innerContent = (() => {
    if (installStatus === 'downloading' || installStatus === 'extracting') {
      return (
        <View style={styles.downloadPlaceholder}>
          <Loader size="small" />
          <Text variant="caption" color="muted" align="center" style={{ marginTop: 4 }}>
            {installStatus === 'downloading' ? 'Downloading...' : 'Extracting...'}
          </Text>
        </View>
      );
    }
    if (!assetsReady && installStatus !== 'ready') {
      return (
        <View style={styles.downloadPlaceholder}>
          <Text style={{ fontSize: 28, opacity: 0.4 }}>🐱</Text>
          <Text variant="caption" color="muted" align="center" style={{ fontSize: 9, marginTop: 2 }}>
            Install in Settings
          </Text>
        </View>
      );
    }
    return (
      <>
        {/* Speech Bubble */}
        {speech && (
          <View style={styles.bubbleContainer}>
            <View style={styles.bubble}>
              <Text
                variant="caption"
                align="center"
                style={styles.bubbleText}
                numberOfLines={3}
              >
                {speech.text}
              </Text>
            </View>
            <View style={styles.bubbleArrow} />
          </View>
        )}

        {/* Tap feedback heart */}
        {showTapFeedback && (
          <Animated.View style={[styles.tapFeedback, pulseStyle]}>
            <Text style={styles.heartText}>💕</Text>
          </Animated.View>
        )}

        {/* Luna Sprite */}
        <Pressable
          onPress={handleTap}
          onLongPress={() => {
            // Long press could open Pet House in Phase 2
          }}
          accessibilityLabel="Luna the companion cat. Tap to pet."
          accessibilityRole="imagebutton"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <LunaSprite
            size={reduceAnimations ? LUNA_SIZE - 8 : LUNA_SIZE}
          animatedStyle={animatedStyle}
        />
      </Pressable>

      {/* XP Bar */}
      <View style={styles.xpBar}>
        <View style={[styles.xpFill, { width: `${xpProgress * 100}%` as any }]} />
      </View>

      {/* Level Badge */}
      <View style={styles.levelBadge}>
        <Text variant="micro" style={styles.levelText}>
          Lv.{level}
        </Text>
      </View>
    </> {/* end of innerContent */}
  )})();

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, dragStyle]}>
        {innerContent}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    alignItems: 'center',
    zIndex: 1000,
  },
  downloadPlaceholder: {
    width: LUNA_SIZE,
    height: LUNA_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleContainer: {
    marginBottom: 4,
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 138, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: BUBBLE_MAX_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bubbleText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#3B4151',
  },
  bubbleArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255, 255, 255, 0.95)',
    alignSelf: 'center',
    marginTop: -1,
  },
  tapFeedback: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
  },
  heartText: {
    fontSize: 20,
  },
  xpBar: {
    width: LUNA_SIZE - 12,
    height: 3,
    backgroundColor: '#FFD9E1',
    borderRadius: 2,
    marginTop: 2,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#FF5C8A',
    borderRadius: 2,
  },
  levelBadge: {
    backgroundColor: '#FF5C8A',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 1,
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
```

---

## 7.2 Theme Token Usage — Replace Hardcoded Colors

**Critical:** All speech bubble backgrounds, text colors, XP bar colors, and level badge colors must draw from the central `src/theme/tokens.ts` system rather than hardcoded hex values. This ensures dark mode compatibility (Rule §3.3 of frontend_rules).

### Import the theme hook and color tokens

```typescript
import { useTheme } from '../../theme';
```

### Inside the component

```typescript
const theme = useTheme();
```

### Refactor the StyleSheet to use dynamic styles via the theme

Replace the static `styles` object with a function that receives the theme:

```typescript
const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      alignItems: 'center',
      zIndex: 1000,
    },
    bubbleContainer: {
      marginBottom: 4,
      alignItems: 'center',
    },
    bubble: {
      backgroundColor: theme.colors.surface + 'F2', // surface with 0.95 opacity
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.primary + '33', // primary at 20% opacity
      paddingHorizontal: 10,
      paddingVertical: 6,
      maxWidth: BUBBLE_MAX_WIDTH,
      shadowColor: theme.colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    bubbleText: {
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textPrimary,
    },
    bubbleArrow: {
      width: 0,
      height: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 8,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: theme.colors.surface,
      alignSelf: 'center',
      marginTop: -1,
    },
    tapFeedback: {
      position: 'absolute',
      top: -20,
      alignSelf: 'center',
    },
    heartText: {
      fontSize: 20,
    },
    xpBar: {
      width: LUNA_SIZE - 12,
      height: 3,
      backgroundColor: theme.colors.primaryMuted ?? theme.colors.primary + '40',
      borderRadius: theme.radius.sm,
      marginTop: 2,
      overflow: 'hidden',
    },
    xpFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.sm,
    },
    levelBadge: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.sm + 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      marginTop: 1,
    },
    levelText: {
      color: theme.colors.textInverse,
      fontSize: 9,
      fontWeight: '700',
    },
  });
```

### Apply the themed styles

```typescript
const theme = useTheme();
const styles = useMemo(() => createStyles(theme), [theme]);
```

### Dark mode fallback check

Verify the theme token file (`src/theme/tokens.ts`) includes dark mode values:

```typescript
// In tokens.ts, ensure `surface` in dark mode is dark:
// dark: { surface: '#1A1D26', textPrimary: '#F7F7F9', ... }
```

If `primaryMuted` is not defined in the tokens, either add it or use the hex opacity approach `theme.colors.primary + '40'`. **Prefer adding a semantic token** to `tokens.ts`:

```typescript
export const colors = {
  // ... existing tokens ...
  primaryMuted: palette.primary100, // #FFD9E1
};
```

If `Text` component doesn't have a `variant="micro"`, add it to the component or use an existing small variant:

In `src/components/ui/Text.tsx` (or wherever Text is defined), ensure `micro` variant exists:

```typescript
// If using variant-based Text, add:
case 'micro':
  return { fontSize: 10, lineHeight: 12, ... };
```

---

## 7.3 Test the Overlay

**Manual test checklist:**

1. Render `LunaOverlay` on the HomeDashboard screen
2. Cat appears in bottom-right corner
3. Cat blinks (idle animation)
4. After 30 seconds of inactivity, cat falls asleep
5. Tap cat → pet animation + heart feedback + speech bubble
6. Speech bubble displays random "petted" dialogue
7. XP bar shows current progress
8. Level badge shows correct level number
9. Dragging moves the cat (if gesture is wired)

---

## ✅ Day 7 Validation

- [ ] `src/screens/companion/LunaOverlay.tsx` created
- [ ] Cat renders at bottom-right with absolute positioning
- [ ] Speech bubble renders above cat with arrow
- [ ] Bubble auto-dismisses after duration
- [ ] Idle → blink animation cycles
- [ ] 30-second inactivity triggers sleep animation
- [ ] Tap triggers pet animation + heart + speech
- [ ] XP bar shows progress to next level
- [ ] Level badge shows level number
- [ ] `isHidden=true` renders nothing
- [ ] `reduceAnimations=true` reduces sprite size, skips animations
- [ ] `installStatus='downloading'` shows loader with text "Downloading..."
- [ ] `installStatus='extracting'` shows loader with text "Extracting..."
- [ ] Assets not downloaded yet shows placeholder cat + "Install in Settings"
- [ ] `variant="micro"` exists on Text component
- [ ] Speech bubble auto-dismisses and reverts animation to idle
- [ ] `savedTranslateX` / `savedTranslateY` shared values declared (add to shared values section)
- [ ] `react-native-gesture-handler` imported (must be already in project dependencies)
- [ ] App builds without TypeScript errors
