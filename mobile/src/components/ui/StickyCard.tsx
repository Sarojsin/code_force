import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from 'src/theme';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Card } from './Card';
import { DatePickerField } from './DatePickerField';
import { Text } from './Text';

export interface StickyCardProps {
  predictedDate: string;
  predictionId: string;
  visible: boolean;
  loading?: boolean;
  onConfirm: (predictionId: string, confirmedDate: string) => void;
  onAdjust: (predictionId: string, newDate: string) => void;
  onSnooze: (predictionId: string, dayOffset: number) => void;
}

export function StickyCard({
  predictedDate,
  predictionId,
  visible,
  loading,
  onConfirm,
  onAdjust,
  onSnooze,
}: StickyCardProps) {
  const theme = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  if (!visible) return null;

  const predictedLabel = new Date(predictedDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

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
          We expected your period around {predictedLabel}. Did it arrive?
        </Text>

        <View style={styles.actions}>
          <Button
            label={`Yes, on ${predictedLabel}`}
            size="sm"
            onPress={() => onConfirm(predictionId, predictedDate)}
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
          control={null as any}
          name="adjustDate"
          label="When did your period start?"
          maximumDate={new Date()}
        />
        <Button
          label="Confirm"
          fullWidth
          onPress={() => {
            const iso = selectedDate.toISOString().split('T')[0];
            onAdjust(predictionId, iso);
            setShowPicker(false);
          }}
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
  actions: { gap: 8 },
  actionBtn: { minHeight: 44 },
});
