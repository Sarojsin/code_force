import React from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
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

function CategoryRow({
  label,
  symptoms,
  selected,
  onToggle,
  theme,
}: {
  label: string;
  symptoms: SymptomMaster[];
  selected: string[];
  onToggle: (name: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const count = symptoms.filter((s) => selected.includes(s.name)).length;
  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text variant="caption" style={{ fontWeight: '600', color: theme.colors.textSecondary }}>
          {label}
        </Text>
        {count > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.colors.primaryDeep }]}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScroll}
        accessibilityLabel={`${label} options`}
        accessibilityRole="list"
      >
        {symptoms.map((s) => {
          const isSel = selected.includes(s.name);
          return (
            <Pressable
              key={s.name}
              onPress={() => onToggle(s.name)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSel }}
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
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SymptomAccordion({ masterSymptoms, selected, onToggle }: SymptomAccordionProps) {
  const theme = useTheme();
  return (
    <View style={styles.container} accessibilityLabel="Symptom categories">
      {CATEGORIES.map((cat) => {
        const catSymptoms = masterSymptoms.filter((s) => s.category === cat);
        if (catSymptoms.length === 0) return null;
        return (
          <CategoryRow
            key={cat}
            label={CATEGORY_LABELS[cat] ?? cat}
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
  container: { gap: 12 },
  row: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  chipScroll: { gap: 8, paddingVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  chipLabel: { fontSize: 12, fontWeight: '600' },
});
