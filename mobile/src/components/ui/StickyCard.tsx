import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useTheme } from 'src/theme';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Card } from './Card';
import { DatePickerField } from './DatePickerField';
import { Text } from './Text';
import { toLocalDateStr } from 'src/utils/date';

const adjustSchema = z.object({
  adjustDate: z.string().min(1, 'Please select a date'),
});

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface StickyCardProps {
  predictedDate: string;
  predictionId: string;
  visible: boolean;
  loading?: boolean;
  checkinPhase: 'expectation' | 'day_of' | 'delay';
  daysOffset: number;
  onConfirm: (predictionId: string, confirmedDate: string) => void;
  onAdjust: (predictionId: string, newDate: string) => void;
  onSnooze: (predictionId: string, dayOffset: number) => void;
}

export function StickyCard({
  predictedDate,
  predictionId,
  visible,
  loading,
  checkinPhase,
  daysOffset: _daysOffset,
  onConfirm,
  onAdjust,
  onSnooze,
}: StickyCardProps) {
  const theme = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const today = new Date();
  const todayStr = toLocalDateStr(today);

  const { control, handleSubmit } = useForm({
    resolver: zodResolver(adjustSchema),
    defaultValues: { adjustDate: todayStr },
  });

  // Quick-select date options for delay phase
  const quickDateOptions = [0, 1, 2, 3].map((offset) => {
    const date = addDays(today, -offset);
    const label = offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : `${offset} days ago`;
    return { label, dateStr: toLocalDateStr(date) };
  });

  const [selectedDate, setSelectedDate] = useState(todayStr);

  const selectedDateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const predictedLabel = new Date(predictedDate + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  if (!visible) return null;

  const getMessage = (): string => {
    switch (checkinPhase) {
      case 'expectation':
        return `We expect your period around ${predictedLabel}.`;
      case 'day_of':
        return 'We predicted your period for today.';
      case 'delay':
        return 'Your period is a bit late. Did it start today?';
    }
  };

  return (
    <>
      <Card
        elevated
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.primaryMuted,
            borderColor: theme.colors.primary,
            borderWidth: 1,
          },
        ]}
      >
        <View style={styles.header}>
          <Text variant="body" style={{ fontWeight: '600' }}>
            Period Check-in
          </Text>
        </View>

        <Text variant="bodySmall" color="secondary" style={styles.message}>
          {getMessage()}
        </Text>

        {/* Delay phase: quick-select chips */}
        {checkinPhase === 'delay' && (
          <View style={styles.chipRow}>
            {quickDateOptions.map((opt) => (
              <Pressable
                key={opt.label}
                onPress={() => setSelectedDate(opt.dateStr)}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      selectedDate === opt.dateStr
                        ? theme.colors.primary
                        : theme.colors.surface,
                    borderColor:
                      selectedDate === opt.dateStr
                        ? theme.colors.primary
                        : theme.colors.border,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: selectedDate === opt.dateStr ? '#fff' : theme.colors.textSecondary,
                    fontWeight: selectedDate === opt.dateStr ? '600' : '400',
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <Button
            label={`Yes, on ${selectedDateLabel}`}
            size="sm"
            onPress={() => onConfirm(predictionId, selectedDate)}
            loading={loading}
            style={styles.actionBtn}
          />
          <Button
            label="No, adjust date"
            size="sm"
            variant="outline"
            onPress={() => setShowPicker(true)}
            style={styles.actionBtn}
          />
          <Button
            label="Not yet"
            size="sm"
            variant="outline"
            onPress={() => onSnooze(predictionId, 1)}
            style={styles.actionBtn}
          />
        </View>
      </Card>

      <BottomSheet
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        title="Adjust Period Date"
      >
        <DatePickerField
          control={control}
          name="adjustDate"
          label="When did your period start?"
          maximumDate={new Date()}
        />
        <Button
          label="Confirm"
          fullWidth
          onPress={handleSubmit((data) => {
            onAdjust(predictionId, data.adjustDate);
            setShowPicker(false);
          })}
          style={{ marginTop: theme.spacing.lg }}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  header: { marginBottom: 4 },
  message: { marginBottom: 12 },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  actions: { gap: 8 },
  actionBtn: { minHeight: 44 },
});
