# Phase 2 Day 8 — Achievement System: Engine + Badge + Popup

## Goal
Complete the Achievement System: build the `AchievementBadge` component, create an achievement popup component, wire the `showAchievementPopup` callback through `initEventEngine`, and persist unlocked achievements in `companionStore.memory.achievements`.

---

## 8.1 Create `src/components/ui/AchievementBadge.tsx`

```tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme/tokens';
import type { Achievement } from '../../services/companion/AchievementEngine';

interface AchievementBadgeProps {
  achievement: Achievement;
  unlocked: boolean;
  onPress?: () => void;
}

export const AchievementBadge = React.memo(function AchievementBadge({
  achievement,
  unlocked,
  onPress,
}: AchievementBadgeProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.badge,
        {
          backgroundColor: unlocked
            ? theme.colors.primaryContainer
            : theme.colors.surface,
          opacity: unlocked ? 1 : 0.5,
        },
      ]}
      accessibilityLabel={`${achievement.name}: ${achievement.description}. ${unlocked ? 'Unlocked' : 'Locked'}`}
      accessibilityRole="image"
    >
      <Text style={styles.icon}>{achievement.icon || '🏆'}</Text>
      <Text
        style={[
          styles.name,
          { color: unlocked ? theme.colors.primary : theme.colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {achievement.name}
      </Text>
      <Text
        style={[styles.description, { color: theme.colors.textSecondary }]}
        numberOfLines={2}
      >
        {achievement.description}
      </Text>
      {unlocked && <Text style={styles.check}>✅</Text>}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    minHeight: 60,
  },
  icon: { fontSize: 24, marginRight: 10 },
  name: { fontSize: 14, fontWeight: '600', flex: 1 },
  description: { fontSize: 12, width: '100%', marginTop: 4 },
  check: { fontSize: 16, marginLeft: 4 },
});
```

---

## 8.2 Create Achievement Popup Component

**File:** `src/components/ui/AchievementPopup.tsx`

A temporary overlay that slides in from the top when an achievement is unlocked, then auto-dismisses.

```tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/tokens';
import type { Achievement } from '../../services/companion/AchievementEngine';

interface AchievementPopupProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

export function AchievementPopup({ achievement, onDismiss }: AchievementPopupProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (!achievement) return;

    Animated.spring(slideAnim, {
      toValue: insets.top + 8,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, 3000);

    return () => clearTimeout(timer);
  }, [achievement]);

  if (!achievement) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.primary,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessibilityLabel={`Achievement unlocked: ${achievement.name}`}
      accessibilityRole="alert"
    >
      <Text style={styles.icon}>{achievement.icon}</Text>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Achievement Unlocked!</Text>
        <Text style={styles.name}>{achievement.name}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  icon: { fontSize: 28, marginRight: 12 },
  textContainer: { flex: 1 },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
```

---

## 8.3 Create `src/stores/achievementStore.ts`

A lightweight Zustand store to track the currently-displayed popup:

```typescript
import { create } from 'zustand';
import type { Achievement } from '../services/companion/AchievementEngine';

interface AchievementStoreState {
  currentPopup: Achievement | null;
  showPopup: (achievement: Achievement) => void;
  dismissPopup: () => void;
}

export const useAchievementStore = create<AchievementStoreState>((set) => ({
  currentPopup: null,

  showPopup: (achievement: Achievement) => {
    set({ currentPopup: achievement });
  },

  dismissPopup: () => {
    set({ currentPopup: null });
  },
}));
```

---

## 8.4 Wire `showAchievementPopup` in `initEventEngine`

**File:** `src/services/companion/EventEngine.ts`

The `initEventEngine` function already accepts `showAchievementPopup` as an optional parameter. In `HomeDashboardScreen.tsx`, pass the popup trigger:

```typescript
// In HomeDashboardScreen.tsx:
import { useAchievementStore } from '../../stores/achievementStore';

const showPopup = useAchievementStore((s) => s.showPopup);

useEffect(() => {
  const cleanup = initEventEngine(showBubble, (achievement) => {
    showPopup(achievement);
  });
  return () => {
    cleanup();
  };
}, []);
```

Render the popup in the home screen:

```tsx
// At the end of HomeDashboardScreen's return, before closing tags:
<AchievementPopup
  achievement={currentPopup}
  onDismiss={dismissPopup}
/>
```

---

## 8.5 Integration: HomeDashboardScreen

**File:** `src/screens/home/HomeDashboardScreen.tsx`

The full integration flow:
1. `initEventEngine(showBubble, showPopup)` — registers event handlers + achievement callback
2. `AchievementPopup` rendered at the root level, above all other content
3. When `achievementEngine.checkAchievements()` finds a new achievement, it calls `showPopup(achievement)` which slides in the popup
4. After 3 seconds, the popup auto-dismisses

---

## 8.6 Validation

- [ ] `AchievementBadge` renders locked/unlocked states with different opacity
- [ ] `AchievementPopup` slides in from top, shows icon + name, auto-dismisses
- [ ] `achievementStore` manages popup state (show/dismiss)
- [ ] `initEventEngine` callback triggers `showPopup()` with the achievement
- [ ] Popup appears when an achievement condition is first met
- [ ] Already-unlocked achievements don't re-trigger popup
- [ ] Unlocked achievements persist in `companionStore.memory.achievements`
- [ ] `tsc --noEmit` passes with 0 new errors
