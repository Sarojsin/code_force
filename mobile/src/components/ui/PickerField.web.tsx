import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form';

import { useTheme } from 'src/theme';
import { Text as Txt } from './Text';

export interface PickerFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  items: { label: string; value: string | number }[];
}

export function PickerField<T extends FieldValues>({ control, name, label, items }: PickerFieldProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        const selected = items.find((i) => i.value === value);
        return (
          <View style={styles.container}>
            <Txt variant="bodySmall" color="secondary" style={{ marginBottom: 6 }}>{label}</Txt>
            <TouchableOpacity
              onPress={() => setOpen(!open)}
              style={[styles.button, { borderColor: error ? theme.colors.danger : theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface }]}
              accessibilityLabel={label}
              activeOpacity={0.7}
            >
              <Txt variant="body" color={value ? 'primary' : 'muted'}>{selected?.label ?? `Select ${label}...`}</Txt>
            </TouchableOpacity>
            {open && (
              <View style={[styles.dropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
                {items.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    onPress={() => { onChange(item.value); setOpen(false); }}
                    style={[styles.option, { backgroundColor: item.value === value ? theme.colors.primaryMuted : 'transparent' }]}
                  >
                    <Txt variant="body" color={item.value === value ? 'primary' : 'secondary'}>{item.label}</Txt>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {error ? <Text style={{ color: theme.colors.danger, fontSize: 12, marginTop: 4 }}>{error.message}</Text> : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16, zIndex: 1 },
  button: { borderWidth: 1.5, paddingVertical: 14, paddingHorizontal: 16 },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, borderWidth: 1, marginTop: 4, zIndex: 1000, elevation: 6 },
  option: { paddingVertical: 12, paddingHorizontal: 16 },
});
