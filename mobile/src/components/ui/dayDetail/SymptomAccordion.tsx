import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from 'src/theme';
import { Text } from '../Text';
import type { SymptomMaster } from 'src/services/api';

const CATEGORIES = ['pain', 'body', 'mood', 'energy', 'reproductive'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  pain: '🔥 Pain',
  body: '🩺 Body',
  mood: '🎭 Mood',
  energy: '⚡ Energy',
  reproductive: '🩸 Reproductive',
};

interface SymptomAccordionProps {
  masterSymptoms: SymptomMaster[];
  selected: string[];
  onToggle: (name: string) => void;
}

function CategorySection({
  category,
  symptoms,
  selected,
  onToggle,
  theme,
}: {
  category: string;
  symptoms: SymptomMaster[];
  selected: string[];
  onToggle: (name: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    maxHeight: withTiming(open ? 200 : 0, { duration: 250 }),
    opacity: withTiming(open ? 1 : 0, { duration: 200 }),
  }));

  const toggle = useCallback(() => {
    rotation.value = open ? 0 : 90;
    setOpen((p) => !p);
  }, [open, rotation]);

  const count = symptoms.filter((s) => selected.includes(s.name)).length;

  return (
    <View style={styles.section}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${CATEGORY_LABELS[category] ?? category}, ${count} selected`}
        style={[styles.sectionHeader, { borderBottomColor: theme.colors.border }]}
      >
        <Text variant="body" style={{ fontWeight: '600', flex: 1 }}>
          {CATEGORY_LABELS[category] ?? category}
        </Text>
        {count > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.colors.primaryDeep }]}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        )}
        <Animated.Text style={[styles.arrow, { transform: [{ rotate: `${rotation.value}deg` }] }]}>
          ›
        </Animated.Text>
      </Pressable>
      <Animated.View style={animStyle}>
        <View style={styles.chipsWrap}>
          {symptoms.map((s) => {
            const isSel = selected.includes(s.name);
            return (
              <Pressable
                key={s.name}
                onPress={() => onToggle(s.name)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={s.name}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSel ? theme.colors.primaryDeep : theme.colors.surface,
                    borderWidth: isSel ? 0 : 1,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 14 }}>{s.icon}</Text>
                <Text style={[styles.chipLabel, { color: isSel ? '#FFFFFF' : theme.colors.textStrong }]}>
                  {s.name}
                </Text>
                {isSel && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

export function SymptomAccordion({ masterSymptoms, selected, onToggle }: SymptomAccordionProps) {
  const theme = useTheme();
  return (
    <View style={styles.container} accessibilityLabel="Symptom categories" accessibilityRole="list">
      {CATEGORIES.map((cat) => {
        const catSymptoms = masterSymptoms.filter((s) => s.category === cat);
        if (catSymptoms.length === 0) return null;
        return (
          <CategorySection
            key={cat}
            category={cat}
            symptoms={catSymptoms}
            selected={selected}
            onToggle={onToggle}
            theme={theme}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  section: { overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  arrow: { fontSize: 18, color: '#999', fontWeight: '600' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  chipLabel: { fontSize: 12, fontWeight: '600' },
  check: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
});
