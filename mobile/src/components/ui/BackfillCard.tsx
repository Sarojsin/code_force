import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme } from 'src/theme';
import { Card } from './Card';
import { Text } from './Text';
import { Button } from './Button';

interface BackfillCardProps {
  monthLabel: string;
  cardNumber: number;
  disabled: boolean;
  isSkipped: boolean;
  onFill: (startDate: string, endDate: string) => void;
  onSkip: () => void;
  loading?: boolean;
}

export function BackfillCard({
  monthLabel,
  cardNumber,
  disabled,
  isSkipped,
  onFill,
  onSkip,
  loading,
}: BackfillCardProps) {
  const theme = useTheme();
  const [showForm, setShowForm] = useState(false);

  if (disabled && !showForm) return null;

  return (
    <Card
      elevated
      style={[
        styles.card,
        {
          backgroundColor: isSkipped ? theme.colors.surface : theme.colors.surface,
          borderColor: isSkipped ? theme.colors.border : theme.colors.primary,
          borderWidth: isSkipped ? 1 : 1.5,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isSkipped ? theme.colors.border : theme.colors.primary,
              borderRadius: theme.radius.pill,
            },
          ]}
        >
          <Text variant="bodySmall" color="inverse" style={styles.badgeText}>
            {cardNumber}
          </Text>
        </View>
        <Text variant="body" style={{ fontWeight: '600', marginLeft: 8, flex: 1 }}>
          Did you have a period in {monthLabel}?
        </Text>
      </View>

      {isSkipped ? (
        <Text variant="bodySmall" color="secondary" style={{ marginTop: 8 }}>
          Skipped — no period this month
        </Text>
      ) : disabled ? (
        <Text variant="bodySmall" color="secondary" style={{ marginTop: 8 }}>
          Fill the previous card first
        </Text>
      ) : showForm ? (
        <View style={styles.form}>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text variant="bodySmall" color="secondary">Start date</Text>
              <DateInput
                label="Start"
                onSubmit={(d) => {
                  const end = new Date(d);
                  end.setDate(end.getDate() + 4);
                  onFill(d, end.toISOString().split('T')[0]);
                }}
              />
            </View>
          </View>
          <View style={styles.actionRow}>
            <Button
              label="Skip — No period"
              size="sm"
              variant="outline"
              onPress={onSkip}
              loading={loading}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : (
        <Button
          label="Log period"
          size="sm"
          onPress={() => setShowForm(true)}
          style={{ marginTop: 12 }}
        />
      )}
    </Card>
  );
}

function DateInput({ label, onSubmit }: { label: string; onSubmit: (date: string) => void }) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  return (
    <View>
      <Pressable
        onPress={() => {
          const d = new Date();
          d.setMonth(d.getMonth() - 1);
          const iso = d.toISOString().split('T')[0];
          setValue(iso);
          onSubmit(iso);
        }}
        style={[
          styles.dateButton,
          {
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.surface,
          },
        ]}
        accessibilityLabel={label}
      >
        <Text variant="body" color={value ? 'primary' : 'muted'}>
          {value || `Tap (e.g. ${new Date().toISOString().split('T')[0]})`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center' },
  badge: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '700', fontSize: 14 },
  form: { marginTop: 12 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateField: { flex: 1 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dateButton: { borderWidth: 1.5, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4 },
});
