# Phase 2 Day 4 — Health Hub: Screen + Navigation + Events

## Goal
Build the `HealthHubScreen` layout, register it in `HomeStack` (where `HomeDashboard` lives), add Luna long-press navigation, and wire event bus events to log actions.

**Navigation decision:** Health Hub goes into `HomeStack` (not `WellnessStack` — the Wellness stack isn't wired in any navigator). From `LunaOverlay` (inside `HomeDashboardScreen`), a simple `navigation.navigate('HealthHub')` works.

---

## 4.1 Create `src/screens/companion/HealthHubScreen.tsx`

```tsx
import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Button,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/tokens';
import { useCompanionStore } from '../../stores/companionStore';
import { useHealthMetricsStore } from '../../stores/healthMetricsStore';
import { HealthMetricCard } from '../../components/ui/HealthMetricCard';
import { StreakBadge } from '../../components/ui/StreakBadge';
import { useFocusEffect } from '@react-navigation/native';

const METRICS_CONFIG = [
  {
    key: 'sleep' as const,
    icon: '🛏️',
    label: 'Sleep',
    target: '8 hrs',
    getValue: (v: any) => (v?.hours ? `${v.hours}h` : '--'),
    parseTarget: '8',
    logPrompt: 'How many hours did you sleep?',
  },
  {
    key: 'food' as const,
    icon: '🍽️',
    label: 'Food',
    target: '3 meals',
    getValue: (v: any) => {
      if (!v?.mealType) return '--';
      const count = v.mealType === 'snack' ? 0 : 1;
      return `${count}/3`;
    },
    parseTarget: '3',
    logPrompt: 'What did you eat?',
  },
  {
    key: 'water' as const,
    icon: '💧',
    label: 'Water',
    target: '2000mL',
    getValue: (v: any) => (v?.amount ? `${v.amount}mL` : '--'),
    parseTarget: '2000',
    logPrompt: 'How much water did you drink (mL)?',
  },
  {
    key: 'exercise' as const,
    icon: '🏋️',
    label: 'Exercise',
    target: '30 min',
    getValue: (v: any) => (v?.duration ? `${v.duration}min` : '--'),
    parseTarget: '30',
    logPrompt: 'How many minutes did you exercise?',
  },
  {
    key: 'medication' as const,
    icon: '💊',
    label: 'Medication',
    target: 'Taken',
    getValue: (v: any) => (v?.taken ? '✅' : '--'),
    parseTarget: '1',
    logPrompt: 'Did you take your medication?',
  },
];

export function HealthHubScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useCompanionStore((s) => s.userId);
  const {
    todayLogs,
    streaks,
    completion,
    isLoading,
    hydrate,
    logMetric,
  } = useHealthMetricsStore();

  useFocusEffect(
    useCallback(() => {
      if (userId) hydrate(userId);
    }, [userId])
  );

  // ── Cross-platform log modal (replaces iOS-only Alert.prompt) ──
  const [logModal, setLogModal] = useState<{
    visible: boolean;
    metricKey: string;
    label: string;
    placeholder: string;
    keyboardType?: 'default' | 'numeric';
  }>({ visible: false, metricKey: '', label: '', placeholder: '' });

  const [logInput, setLogInput] = useState('');

  const handleLog = useCallback(
    async (metricKey: string) => {
      if (!userId) return;

      switch (metricKey) {
        case 'sleep':
          setLogModal({
            visible: true,
            metricKey,
            label: 'Hours slept',
            placeholder: '8',
            keyboardType: 'numeric',
          });
          break;
        case 'water':
          setLogModal({
            visible: true,
            metricKey,
            label: 'Amount in mL',
            placeholder: '250',
            keyboardType: 'numeric',
          });
          break;
        case 'exercise':
          setLogModal({
            visible: true,
            metricKey,
            label: 'Duration in minutes',
            placeholder: '30',
            keyboardType: 'numeric',
          });
          break;
        case 'food':
          setLogModal({
            visible: true,
            metricKey,
            label: 'Meal type (breakfast/lunch/dinner/snack)',
            placeholder: 'lunch',
            keyboardType: 'default',
          });
          break;
        case 'medication':
          await logMetric(userId, 'medication', {
            name: 'Supplements',
            taken: true,
          });
          break;
      }
    },
    [userId, logMetric]
  );

  const handleLogSubmit = useCallback(async () => {
    if (!userId) return;
    const { metricKey } = logModal;
    const value = logInput.trim();

    switch (metricKey) {
      case 'sleep': {
        const h = parseFloat(value);
        if (!isNaN(h) && h > 0) await logMetric(userId, 'sleep', { hours: h });
        break;
      }
      case 'water': {
        const a = parseInt(value, 10);
        if (!isNaN(a) && a > 0) await logMetric(userId, 'water', { amount: a });
        break;
      }
      case 'exercise': {
        const d = parseInt(value, 10);
        if (!isNaN(d) && d > 0) {
          await logMetric(userId, 'exercise', { type: 'general', duration: d });
        }
        break;
      }
      case 'food': {
        const valid = ['breakfast', 'lunch', 'dinner', 'snack'];
        if (valid.includes(value)) {
          await logMetric(userId, 'food', { mealType: value });
        }
        break;
      }
    }
    setLogInput('');
    setLogModal((prev) => ({ ...prev, visible: false }));
  }, [userId, logModal, logInput, logMetric]);

  const completionPercent = completion.total > 0
    ? (completion.logged.length / completion.total) * 100
    : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {/* Header */}
      <Text style={[styles.title, { color: theme.colors.text }]}>
        🌸 Health Hub
      </Text>
      <View style={styles.lunaBubble}>
        <Text style={[styles.bubbleText, { color: theme.colors.text }]}>
          {isLoading
            ? 'Loading your stats...'
            : completion.logged.length === 0
              ? 'Good morning! Let\'s start tracking today! 🌟'
              : `You've logged ${completion.logged.length}/5 metrics! Keep going!`}
        </Text>
      </View>

      {/* Metric Cards Grid */}
      <View style={styles.grid}>
        {METRICS_CONFIG.map((cfg) => {
          const logs = todayLogs[cfg.key] || [];
          const lastLog = logs[logs.length - 1];
          const val = cfg.getValue(lastLog?.value);
          return (
            <HealthMetricCard
              key={cfg.key}
              icon={cfg.icon}
              label={cfg.label}
              value={val}
              target={cfg.target}
              logged={logs.length > 0}
              streak={streaks[cfg.key] || 0}
              onPress={() => handleLog(cfg.key)}
            />
          );
        })}
      </View>

      {/* Today's Progress */}
      <View
        style={[
          styles.section,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          📊 Today's Progress
        </Text>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${completionPercent}%`,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
          {completion.logged.length} of {completion.total} metrics logged
        </Text>
        <View style={styles.metricDots}>
          {METRICS_CONFIG.map((cfg) => (
            <Text key={cfg.key}>
              {cfg.icon}{' '}
              {completion.logged.includes(cfg.key) ? '✅' : '⬜'}
            </Text>
          ))}
        </View>
      </View>

      {/* Streaks */}
      <View
        style={[
          styles.section,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          🔥 Streaks
        </Text>
        <View style={styles.streakRow}>
          {METRICS_CONFIG.map((cfg) => (
            <StreakBadge
              key={cfg.key}
              metricType={cfg.label}
              count={streaks[cfg.key] || 0}
              icon={cfg.icon}
            />
          ))}
        </View>
      </View>
      {/* ── Cross-platform Log Modal ── */}
      <Modal
        visible={logModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogModal((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Log {logModal.label}
            </Text>
            <TextInput
              value={logInput}
              onChangeText={setLogInput}
              placeholder={logModal.placeholder}
              keyboardType={logModal.keyboardType || 'default'}
              autoFocus
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  borderColor: theme.colors.muted,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setLogInput('');
                  setLogModal((prev) => ({ ...prev, visible: false }));
                }}
                style={styles.modalBtn}
              >
                <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleLogSubmit} style={styles.modalBtn}>
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 16, marginBottom: 12 },
  lunaBubble: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#f0f8ff',
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: { height: '100%', borderRadius: 5 },
  progressText: { fontSize: 13, marginBottom: 8 },
  metricDots: { flexDirection: 'row', justifyContent: 'space-around' },
  streakRow: { flexDirection: 'row', flexWrap: 'wrap' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    width: '80%',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 8 },
});
```

**Note:** `Alert.prompt` is iOS-only. For Android, replace with a simple modal or BottomSheet in a later pass. The current implementation is functional for Phase 2 MVP.

---

## 4.2 Add Navigation — Home Stack

The `LunaOverlay` lives inside `HomeDashboardScreen`, which is inside `HomeStack`. Add `HealthHub` as a screen in `HomeStack`.

**File:** `src/navigation/types.ts`

```typescript
export type HomeStackParamList = {
  // ... existing screens ...
  HealthHub: undefined;
};
```

**File:** `src/navigation/HomeStack.tsx`

```typescript
import { HealthHubScreen } from 'src/screens/companion/HealthHubScreen';

// Inside the Stack.Navigator:
<Stack.Screen
  name="HealthHub"
  component={HealthHubScreen}
  options={{ title: 'Health Hub' }}
/>
```

---

## 4.3 Add Luna Long-Press Trigger in `LunaOverlay.tsx`

**File:** `src/screens/companion/LunaOverlay.tsx`

Modify the `Pressable` that handles pet interaction to also support `onLongPress`:

```typescript
// Inside LunaOverlay — add onLongPress to the pet Pressable:
import { useNavigation } from '@react-navigation/native';

// Inside the component:
const navigation = useNavigation<any>();

// In the JSX:
<Pressable
  onPress={handlePet}
  onLongPress={() => {
    // Navigate to Health Hub — HomeStack handles it directly
    navigation.navigate('HealthHub');
  }}
  delayLongPress={600}
>
  <LunaSprite animationState={currentAnimation} />
</Pressable>
```

`useNavigation` works inside `LunaOverlay` because it's rendered within a React Navigation context (inside `HomeDashboardScreen`).

---

## 4.4 Add `HealthHub` Entry in HomeDashboardScreen

**File:** `src/screens/home/HomeDashboardScreen.tsx`

Add a "Health Hub" entry or button in the dashboard:

```tsx
<Pressable
  onPress={() => navigation.navigate('HealthHub')}
  style={styles.toolRow}
>
  <Text style={styles.toolIcon}>🌸</Text>
  <View>
    <Text style={styles.toolTitle}>Health Hub</Text>
    <Text style={styles.toolSubtitle}>Track sleep, food, water & more</Text>
  </View>
  <Text style={styles.chevron}>›</Text>
</Pressable>
```

---

## 4.5 Validation

- [ ] `HealthHubScreen` renders 5 metric cards in a 2-column grid
- [ ] Tapping a card triggers the log prompt (iOS) or fallback
- [ ] Luna's speech bubble updates after logging
- [ ] Today's progress bar reflects X/5 completion
- [ ] StreakBadge components show non-zero streaks
- [ ] Long-press on Luna opens Health Hub (via `useNavigation` in `LunaOverlay`)
- [ ] HomeDashboardScreen has a "Health Hub" entry
- [ ] Navigation types updated (`HomeStackParamList`)
- [ ] Cross-platform modal works on both iOS and Android (no `Alert.prompt` crash)
- [ ] `tsc --noEmit` passes with 0 new errors
