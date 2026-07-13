import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button, DatePickerField, BottomSheet, Skeleton, Text } from 'src/components/ui';
import { PredictionDetailCard } from 'src/components/ui/PredictionDetailCard';
import { useTheme } from 'src/theme';
import { useCyclePredictions, useLogCorrection } from 'src/services/queries/cycle';

const overrideSchema = z.object({
  overrideDate: z.string().min(1, 'Please select a date'),
});

type OverrideForm = z.infer<typeof overrideSchema>;

const DATA_QUALITY_LABELS: Record<string, { label: string; color: string }> = {
  insufficient: { label: 'Insufficient data — predictions will improve as you log more cycles', color: '#E53935' },
  minimal: { label: 'Minimal data — we need a few more cycles for better accuracy', color: '#FB8C00' },
  good: { label: 'Good data — predictions are becoming more reliable', color: '#43A047' },
  excellent: { label: 'Excellent data — predictions are highly reliable', color: '#1B5E20' },
};

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function CyclePredictionsScreen() {
  const theme = useTheme();
  const { data, isLoading } = useCyclePredictions();
  const logCorrection = useLogCorrection();
  const { control, handleSubmit } = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { overrideDate: toDateStr(new Date()) },
  });

  const prediction = data?.prediction ?? null;
  const daysUntil = data?.days_until ?? null;
  const dataQuality = data?.data_quality ?? '';

  const [showOverride, setShowOverride] = useState(false);

  const handlePermanentOverride = handleSubmit((data) => {
    const endDate = addDays(new Date(data.overrideDate), 5);
    logCorrection.mutate(
      {
        period_start_date: data.overrideDate,
        period_end_date: toDateStr(endDate),
        corrected_prediction_id: prediction?.id ?? null,
      },
      { onSuccess: () => setShowOverride(false) },
    );
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Skeleton height={160} style={{ marginBottom: 16 }} />
          <Skeleton height={80} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const qualityInfo = DATA_QUALITY_LABELS[dataQuality] || DATA_QUALITY_LABELS.insufficient;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="h1" style={{ paddingHorizontal: 24, marginBottom: 8 }}>
          Predictions
        </Text>

        <View style={[styles.qualityBanner, { backgroundColor: qualityInfo.color + '20', borderLeftColor: qualityInfo.color, borderRadius: theme.radius.md, marginHorizontal: theme.spacing.lg }]}>
          <Text variant="bodySmall" style={{ color: qualityInfo.color }}>
            {qualityInfo.label}
          </Text>
        </View>

        {prediction && daysUntil != null && (
          <View style={[styles.countdownCard, { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary + '30', borderRadius: theme.radius.xl }]}>
            <Text variant="bodySmall" color="secondary" align="center">
              Next period starts in
            </Text>
            <Text variant="h1" color="primary" align="center" style={{ fontSize: 48, marginVertical: 4 }}>
              {daysUntil}
            </Text>
            <Text variant="bodySmall" color="secondary" align="center">
              {daysUntil === 1 ? 'day' : 'days'}
            </Text>
          </View>
        )}

        {prediction && (
          <View style={{ marginHorizontal: 16 }}>
            <PredictionDetailCard prediction={prediction} />
          </View>
        )}

        {prediction && (
          <Button
            label="Adjust Period Date"
            variant="outline"
            onPress={() => setShowOverride(true)}
            style={{ marginHorizontal: theme.spacing.xl }}
          />
        )}

        {!prediction && (
          <Text variant="body" color="muted" align="center" style={{ paddingHorizontal: 32 }}>
            No predictions available yet. Log your first period to get started.
          </Text>
        )}
      </ScrollView>

      <BottomSheet
        visible={showOverride}
        onClose={() => setShowOverride(false)}
        title="Adjust Period Date"
      >
        <DatePickerField
          control={control}
          name="overrideDate"
          label="When did your period start?"
        />
        <Button
          label="Confirm"
          fullWidth
          onPress={handlePermanentOverride}
          loading={logCorrection.isPending}
          style={{ marginTop: theme.spacing.lg }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingVertical: 16, gap: 16 },
  qualityBanner: { padding: 12, borderLeftWidth: 4, marginBottom: 8 },
  countdownCard: { marginHorizontal: 16, padding: 20, borderWidth: 1, alignItems: 'center' },
});
