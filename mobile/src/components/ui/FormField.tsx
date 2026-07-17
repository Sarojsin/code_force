/**
 * FormField — molecule: label + input + error message.
 * Supports optional inputRef prop for focus chaining (returnKeyType + onSubmitEditing).
 */

import React, { useState } from 'react';
import { useController, Control, FieldPath, FieldValues } from 'react-hook-form';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { useTheme } from 'src/theme';
import { Text as Txt } from './Text';

export interface FormFieldProps<T extends FieldValues>
  extends Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  hint?: string;
  inputRef?: React.RefObject<TextInput | null>;
}

export function FormField<T extends FieldValues>(props: FormFieldProps<T>) {
  const { control, name, label, hint, inputRef, ...inputProps } = props;
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { field: { onChange, onBlur, value }, fieldState: { error } } = useController({ control, name });

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
          ref={inputRef}
          {...inputProps}
          value={value ?? ''}
          onChangeText={onChange}
          onBlur={() => { setFocused(false); onBlur(); }}
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
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  labelRow: { marginBottom: 6 },
  inputWrapper: { borderWidth: 1.5 },
  input: { fontSize: 16, paddingVertical: 12 },
});
