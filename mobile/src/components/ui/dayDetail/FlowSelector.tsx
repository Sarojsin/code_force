import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useTheme } from 'src/theme';
import { Text } from '../Text';

const FLOW_OPTIONS = [
  { key: 'spotting', label: 'Spotting', icon: '💧' },
  { key: 'light', label: 'Light', icon: '🩸' },
  { key: 'medium', label: 'Medium', icon: '🩸🩸' },
  { key: 'heavy', label: 'Heavy', icon: '🩸🩸🩸' },
] as const;

interface FlowSelectorProps {
  selected?: string | null;
  onSelect: (level: string) => void;
}

export function FlowSelector({ selected, onSelect }: FlowSelectorProps) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityLabel="Flow level" accessibilityRole="radiogroup">
      {FLOW_OPTIONS.map((opt) => {
        const isSel = selected === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            accessibilityLabel={`${opt.label} flow`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSel }}
            style={[
              styles.card,
              {
                backgroundColor: isSel ? theme.colors.primaryDeep : theme.colors.surface,
                borderWidth: isSel ? 0 : 1,
                borderColor: theme.colors.border,
              },
              isSel && theme.shadow.chip,
            ]}
          >
            <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
            <Text style={[styles.label, { color: isSel ? '#FFFFFF' : theme.colors.textStrong }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  card: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 16, minHeight: 64 },
  label: { fontSize: 11, fontWeight: '600', marginTop: 4 },
});
