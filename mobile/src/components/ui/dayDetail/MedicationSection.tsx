import React from 'react';
import { StyleSheet, View, Pressable, TextInput } from 'react-native';
import { useTheme } from 'src/theme';
import { Text } from '../Text';
import type { MedicationMaster } from 'src/services/api';

interface MedicationSectionProps {
  masterMedications: MedicationMaster[];
  selected: string[];
  onToggle: (name: string) => void;
  doses?: Record<string, string>;
  onDoseChange?: (name: string, dose: string) => void;
}

export function MedicationSection({
  masterMedications,
  selected,
  onToggle,
  doses = {},
  onDoseChange,
}: MedicationSectionProps) {
  const theme = useTheme();
  if (masterMedications.length === 0) return null;
  return (
    <View>
      <View style={styles.chips}>
        {masterMedications.map((med) => {
          const isSel = selected.includes(med.name);
          return (
            <Pressable
              key={med.name}
              onPress={() => onToggle(med.name)}
              accessibilityLabel={med.name}
              accessibilityRole="button"
              accessibilityState={{ selected: isSel }}
              style={[
                styles.chip,
                {
                  backgroundColor: isSel ? theme.colors.primaryDeep : theme.colors.surface,
                  borderWidth: isSel ? 0 : 1,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : theme.colors.textStrong }]}>
                {med.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {selected.map((name) => (
        <View key={name} style={styles.doseRow}>
          <Text variant="caption" color="secondary" style={{ flex: 1 }}>{name}</Text>
          <TextInput
            value={doses[name] ?? ''}
            onChangeText={(t) => onDoseChange?.(name, t)}
            placeholder="dose (e.g. 200mg)"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.doseInput, {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.textPrimary,
            }]}
            accessibilityLabel={`Dose for ${name}`}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  chipText: { fontSize: 13, fontWeight: '600' },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  doseInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, minWidth: 120 },
});
