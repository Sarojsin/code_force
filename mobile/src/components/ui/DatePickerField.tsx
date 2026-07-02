import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form';

import { Text as Txt } from './Text';
import { useTheme } from 'src/theme';

export interface DatePickerFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  maximumDate?: Date;
}

export function DatePickerField<T extends FieldValues>({ control, name, label, maximumDate }: DatePickerFieldProps<T>) {
  const theme = useTheme();
  const [show, setShow] = useState(false);

  const formatDate = (d: Date): string => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleChange = (onChange: (v: string) => void) => (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      onChange(formatDate(selectedDate));
    }
    setShow(false);
  };

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <View style={styles.container}>
          <Txt variant="bodySmall" color="secondary" style={{ marginBottom: 6 }}>{label}</Txt>
          <TouchableOpacity
            onPress={() => setShow(true)}
            style={[styles.button, { borderColor: error ? theme.colors.danger : theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface }]}
            accessibilityLabel={label}
          >
            <Txt variant="body" color={value ? 'primary' : 'muted'}>
              {value || 'Tap to select date'}
            </Txt>
          </TouchableOpacity>
          {error ? <Text style={{ color: theme.colors.danger, fontSize: 12, marginTop: 4 }}>{error.message}</Text> : null}
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={value || ''}
              onChange={(e) => { onChange(e.target.value); }}
              max={maximumDate?.toISOString().split('T')[0]}
              style={{
                width: '100%',
                padding: 14,
                fontSize: 16,
                borderWidth: 1.5,
                borderColor: error ? theme.colors.danger : theme.colors.border,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                fontFamily: 'inherit',
              }}
            />
          ) : show && (
            <View>
              <DateTimePicker
                value={value ? new Date(value) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={maximumDate}
                onChange={handleChange(onChange)}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => setShow(false)} style={styles.doneButton} accessibilityLabel="Done">
                  <Txt variant="body" color="primary" align="center">Done</Txt>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  button: { borderWidth: 1.5, paddingVertical: 14, paddingHorizontal: 16 },
  doneButton: { paddingVertical: 12, alignItems: 'center' },
});