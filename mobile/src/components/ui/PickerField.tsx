import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
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
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <View style={styles.container}>
          <Txt variant="bodySmall" color="secondary" style={{ marginBottom: 6 }}>{label}</Txt>
          <View style={[styles.pickerWrapper, { borderColor: error ? theme.colors.danger : theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface }]}>
            <Picker
              selectedValue={value}
              onValueChange={onChange}
              style={{ color: theme.colors.textPrimary }}
            >
              <Picker.Item label={`Select ${label}...`} value={null} color={theme.colors.textMuted} />
              {items.map((item) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>
          {error ? <Text style={{ color: theme.colors.danger, fontSize: 12, marginTop: 4 }}>{error.message}</Text> : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  pickerWrapper: { borderWidth: 1.5, overflow: 'hidden' },
});