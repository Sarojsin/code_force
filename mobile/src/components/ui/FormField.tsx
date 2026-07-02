/**
 * FormField — molecule: label + input + error message.
 * Pairs react-hook-form's Controller with native TextInput.
 */

import React, { useState } from 'react';
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { logger } from 'src/utils';
import { useTheme } from 'src/theme';
import { Text as Txt } from './Text';

export interface FormFieldProps<T extends FieldValues>
  extends Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  hint?: string;
}

export function FormField<T extends FieldValues>(props: FormFieldProps<T>) {
  if (!props) {
    logger.error('FormField.render_null_props');
    return null;
  }
  const { control, name, label, hint, ...inputProps } = props;
  if (!control) {
    logger.error('FormField.render_missing_control', { name, label });
    return null;
  }
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => {
        const handleBlur = () => {
          setFocused(false);
          onBlur();
        };
        return (
          <View style={styles.container}>
            <View style={[styles.labelRow]}>
              <Txt variant="bodySmall" color="secondary">
                {label}
              </Txt>
            </View>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: focused ? theme.colors.primaryMuted + '18' : theme.colors.surface,
                  borderColor: error
                    ? theme.colors.danger
                    : focused
                      ? theme.colors.primary
                      : theme.colors.border,
                  borderRadius: theme.radius.lg,
                },
              ]}
            >
              <TextInput
                {...inputProps}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={handleBlur}
                onFocus={() => setFocused(true)}
                accessibilityLabel={label}
                accessibilityHint={hint}
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.input,
                  {
                    color: theme.colors.textPrimary,
                    borderRadius: theme.radius.lg,
                    paddingHorizontal: theme.spacing.md,
                    minHeight: 48,
                  },
                  inputProps.style,
                ]}
              />
            </View>
            {error ? (
              <Text style={{ color: theme.colors.danger, fontSize: 12, marginTop: 4, marginLeft: 4 }}>
                {error.message}
              </Text>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  labelRow: { marginBottom: 6 },
  inputWrapper: { borderWidth: 1.5 },
  input: { fontSize: 16, paddingVertical: 12 },
});
