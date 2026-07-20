import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'src/theme';
import { Card } from './Card';
import { Text } from './Text';
import { Button } from './Button';

interface EndDatePromptCardProps {
  visible: boolean;
  periodStartDate: string;
  daysSinceStart: number;
  onConfirmEndDate: () => void;
  onSkip: () => void;
  loading?: boolean;
}

export function EndDatePromptCard({
  visible,
  periodStartDate,
  daysSinceStart,
  onConfirmEndDate,
  onSkip,
  loading,
}: EndDatePromptCardProps) {
  const theme = useTheme();

  if (!visible) return null;

  const startLabel = new Date(periodStartDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card
      elevated
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.warning,
          borderWidth: 1,
        },
      ]}
    >
      <View style={styles.header}>
        <Text variant="body" style={{ fontWeight: '600' }}>
          Confirm End Date
        </Text>
      </View>

      <Text variant="bodySmall" color="secondary" style={styles.message}>
        Your period started {daysSinceStart} day{daysSinceStart !== 1 ? 's' : ''} ago on{' '}
        {startLabel}. Has it ended?
      </Text>

      <View style={styles.actions}>
        <Button
          label="Yes, it ended"
          size="sm"
          onPress={onConfirmEndDate}
          loading={loading}
          style={styles.actionBtn}
        />
        <Button
          label="Skip"
          size="sm"
          variant="outline"
          onPress={onSkip}
          style={styles.actionBtn}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  header: { marginBottom: 4 },
  message: { marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, minHeight: 44 },
});
