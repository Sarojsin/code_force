import React from 'react';
import { StyleSheet, View, TextInput } from 'react-native';
import { useTheme } from 'src/theme';
import { Text } from '../Text';

const MAX_CHARS = 300;

interface NotesSectionProps {
  value: string;
  onChange: (text: string) => void;
}

export function NotesSection({ value, onChange }: NotesSectionProps) {
  const theme = useTheme();
  const remaining = MAX_CHARS - value.length;
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={(t) => { if (t.length <= MAX_CHARS) onChange(t); }}
        placeholder="Write a note for this day..."
        placeholderTextColor={theme.colors.textMuted}
        multiline
        accessibilityLabel="Note for this day"
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            color: theme.colors.textPrimary,
            borderRadius: theme.radius.lg,
          },
        ]}
      />
      <Text
        variant="helper"
        color="muted"
        style={[styles.counter, { color: remaining < 0 ? theme.colors.danger : theme.colors.textMuted }]}
      >
        {remaining} characters remaining
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1.5, padding: 14, fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
  counter: { textAlign: 'right', marginTop: 4 },
});
