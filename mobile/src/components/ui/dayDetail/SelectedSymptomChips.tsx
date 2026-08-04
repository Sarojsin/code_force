import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useTheme } from 'src/theme';
import { Text } from '../Text';

interface SelectedSymptomChipsProps {
  symptoms: string[];
  onRemove: (symptom: string) => void;
  onClearAll: () => void;
}

export function SelectedSymptomChips({ symptoms, onRemove, onClearAll }: SelectedSymptomChipsProps) {
  const theme = useTheme();
  if (symptoms.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {symptoms.map((s) => (
          <View key={s} style={[styles.chip, { backgroundColor: theme.colors.primaryDeep }]}>
            <Text style={styles.chipText}>{s}</Text>
            <Pressable
              onPress={() => onRemove(s)}
              accessibilityLabel={`Remove ${s}`}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.xBtn}
            >
              <Text style={styles.x}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Pressable onPress={onClearAll} hitSlop={8} accessibilityLabel="Clear all symptoms" accessibilityRole="button">
        <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '600' }}>Clear All</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 4 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  xBtn: { paddingLeft: 2 },
  x: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
});
