import React from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import { useTheme } from 'src/theme';
import { Text } from '../Text';
import type { SymptomMaster } from 'src/services/api';
import { SymptomIcon } from '../symptomIcons/SymptomIcon';

const CATEGORIES = ['pain', 'digestive', 'skin', 'general'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  pain: 'Pain',
  digestive: 'Digestive',
  skin: 'Skin',
  general: 'General',
};

const SEVERITY_LABEL: Record<number, string> = {
  1: 'light',
  3: 'moderate',
  5: 'severe',
};

interface SymptomAccordionProps {
  masterSymptoms: SymptomMaster[];
  selected: string[];
  /** Symptom name → severity 1/3/5 (default 3 when selected). */
  severities?: Record<string, number>;
  onToggle: (name: string) => void;
}

function CategoryRow({
  label,
  symptoms,
  selected,
  severities,
  onToggle,
  theme,
}: {
  label: string;
  symptoms: SymptomMaster[];
  selected: string[];
  severities: Record<string, number>;
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
          const severity = severities[s.name] ?? 3;
          return (
            <Pressable
              key={s.name}
              onPress={() => onToggle(s.name)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSel }}
              accessibilityLabel={s.name}
              accessibilityValue={
                isSel ? { now: severity, min: 1, max: 5 } : undefined
              }
              accessibilityHint={isSel ? `Tap to change severity (${SEVERITY_LABEL[severity]})` : 'Tap to log this symptom'}
              style={[
                styles.chip,
                {
                  backgroundColor: isSel ? theme.colors.primaryDeep : theme.colors.surface,
                  borderWidth: isSel ? 0 : 1,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <SymptomIcon name={s.name} size={14} color={isSel ? '#FFFFFF' : theme.colors.textStrong} emoji={s.icon} />
              <Text style={[styles.chipLabel, { color: isSel ? '#FFFFFF' : theme.colors.textStrong }]}>
                {s.name}
              </Text>
              {isSel && (
                <View style={styles.severityDots} accessibilityElementsHidden>
                  {[1, 3, 5].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.dot,
                        { backgroundColor: severity >= level ? '#FFFFFF' : 'rgba(255,255,255,0.35)' },
                      ]}
                    />
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SymptomAccordion({
  masterSymptoms,
  selected,
  severities = {},
  onToggle,
}: SymptomAccordionProps) {
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
            severities={severities}
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
  severityDots: { flexDirection: 'row', gap: 2, marginLeft: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});