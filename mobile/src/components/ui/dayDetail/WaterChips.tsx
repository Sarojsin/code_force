import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { GlassWater } from 'lucide-react-native';
import { useTheme } from 'src/theme';
import { Text } from '../Text';

const WATER_PRESETS = [0, 2, 4, 6, 8, 10, 12];

interface WaterChipsProps {
  value: number;
  onChange: (val: number) => void;
}

export function WaterChips({ value, onChange }: WaterChipsProps) {
  const theme = useTheme();
  return (
    <View>
      <View style={styles.display}>
        <Text variant="h3" style={{ color: theme.colors.primaryDeep }}>{value}</Text>
        <Text variant="caption" color="muted" style={{ marginLeft: 4 }}>glasses</Text>
      </View>
      <View style={styles.row} accessibilityLabel="Water intake" accessibilityRole="radiogroup">
        {WATER_PRESETS.map((preset) => {
          const isSel = value === preset;
          return (
            <Pressable
              key={preset}
              onPress={() => onChange(preset)}
              accessibilityLabel={`${preset} glasses`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSel }}
              style={[
                styles.chip,
                {
                  backgroundColor: isSel ? theme.colors.primaryDeep : theme.colors.surface,
                  borderWidth: isSel ? 0 : 1,
                  borderColor: theme.colors.border,
                },
                isSel && theme.shadow.chip,
              ]}
            >
              <GlassWater size={16} color={isSel ? '#FFFFFF' : theme.colors.textStrong} accessible={false} />
              <Text style={[styles.chipLabel, { color: isSel ? '#FFFFFF' : theme.colors.textStrong }]}>
                {preset}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  display: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, minWidth: 56, gap: 2 },
  chipLabel: { fontSize: 11, fontWeight: '600' },
});
