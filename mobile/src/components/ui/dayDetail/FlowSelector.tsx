import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Droplet, Droplets } from 'lucide-react-native';
import { useTheme } from 'src/theme';
import { Text } from '../Text';

const FLOW_OPTIONS = [
  { key: 'spotting', label: 'Spotting', count: 1 },
  { key: 'light', label: 'Light', count: 1 },
  { key: 'medium', label: 'Medium', count: 2 },
  { key: 'heavy', label: 'Heavy', count: 3 },
] as const;

interface FlowSelectorProps {
  selected?: string | null;
  onSelect: (level: string) => void;
}

function FlowIcon({ count, color }: { count: number; color: string }) {
  if (count >= 2) {
    return <Droplets size={18} color={color} accessible={false} />;
  }
  return <Droplet size={18} color={color} accessible={false} />;
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
            <FlowIcon count={opt.count} color={isSel ? '#FFFFFF' : theme.colors.textStrong} />
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
