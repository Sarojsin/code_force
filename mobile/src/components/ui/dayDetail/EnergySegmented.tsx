import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useTheme } from 'src/theme';
import { Text } from '../Text';

const ENERGY_OPTIONS = [
  { key: 1, label: 'Low', icon: '😴' },
  { key: 2, label: 'Medium', icon: '😊' },
  { key: 3, label: 'High', icon: '⚡' },
] as const;

interface EnergySegmentedProps {
  value?: number | null;
  onChange: (val: number) => void;
}

export function EnergySegmented({ value, onChange }: EnergySegmentedProps) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityLabel="Energy level" accessibilityRole="radiogroup">
      {ENERGY_OPTIONS.map((opt) => {
        const isSel = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityLabel={`${opt.label} energy`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSel }}
            style={[
              styles.seg,
              {
                backgroundColor: isSel ? theme.colors.accentGreen : theme.colors.surface,
                borderWidth: isSel ? 0 : 1,
                borderColor: theme.colors.border,
              },
              isSel && theme.shadow.chip,
            ]}
          >
            <Text style={{ fontSize: 16 }}>{opt.icon}</Text>
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
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14, minHeight: 56 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
