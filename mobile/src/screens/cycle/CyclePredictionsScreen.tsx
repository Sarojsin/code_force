import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Svg, { Path, Circle as SvgCircle, Rect } from 'react-native-svg';

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

const MOCK_HISTORY = [
  { month: 'May', predicted: 'May 12', actual: 'May 14', delta: 2, onTime: false },
  { month: 'Jun', predicted: 'Jun 9', actual: 'Jun 10', delta: 1, onTime: false },
  { month: 'Jul', predicted: 'Jul 7', actual: 'Jul 7', delta: 0, onTime: true },
  { month: 'Aug', predicted: 'Aug 4', actual: 'Aug 6', delta: 2, onTime: false },
  { month: 'Sep', predicted: 'Sep 1', actual: 'Sep 2', delta: 1, onTime: false },
  { month: 'Oct', predicted: 'Oct 6', actual: 'Oct 5', delta: 1, onTime: false },
];

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
  const { data, isLoading, isError, refetch } = useCyclePredictions();
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

        {!prediction && (
          <View style={styles.emptyContainer}>
            <Svg width="140" height="120" viewBox="0 0 140 120" fill="none">
              <Rect x="20" y="30" width="100" height="70" rx="8" stroke={theme.colors.textMuted} strokeWidth="2" fill={theme.colors.surface} />
              <Path d="M20 45 H120" stroke={theme.colors.border} strokeWidth="1" />
              <SvgCircle cx="35" cy="38" r="4" fill={theme.colors.primary} />
              <SvgCircle cx="50" cy="38" r="4" fill={theme.colors.accent} />
              <SvgCircle cx="65" cy="38" r="4" fill={theme.colors.warning} />
              <Path d="M40 65 H80" stroke={theme.colors.primary} strokeWidth="2" strokeLinecap="round" />
              <Path d="M40 75 H70" stroke={theme.colors.accent} strokeWidth="2" strokeLinecap="round" />
              <Path d="M40 85 H90" stroke={theme.colors.warning} strokeWidth="2" strokeLinecap="round" />
              <SvgCircle cx="110" cy="70" r="12" fill={theme.colors.primaryMuted} />
              <Path d="M106 70 H114 M110 66 V74" stroke={theme.colors.primary} strokeWidth="2" strokeLinecap="round" />
            </Svg>
            <Text variant="h2" align="center" style={{ marginTop: 24 }}>Your cycle story begins here</Text>
            <Text variant="body" color="secondary" align="center" style={{ marginTop: 8, paddingHorizontal: 32 }}>
              Log your first period and unlock personalized cycle predictions
            </Text>
            <Button label="Log Your Period" variant="primary" fullWidth style={{ marginTop: 24, marginHorizontal: 32 }} />
          </View>
        )}

        {prediction && (
          <>
            {isError && (
              <Pressable onPress={() => refetch()} style={[styles.errorRefreshBar, { backgroundColor: theme.colors.warning + '20', borderColor: theme.colors.warning, borderRadius: theme.radius.md, marginHorizontal: theme.spacing.lg }]}>
                <Text variant="bodySmall" style={{ color: theme.colors.warning, flex: 1 }}>
                  Showing cached data — tap to refresh
                </Text>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <Path d="M1 4v6h6M23 20v-6h-6" stroke={theme.colors.warning} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke={theme.colors.warning} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
            )}
            <View style={[styles.qualityBanner, { backgroundColor: qualityInfo.color + '20', borderLeftColor: qualityInfo.color, borderRadius: theme.radius.md, marginHorizontal: theme.spacing.lg }]}>
              <Text variant="bodySmall" style={{ color: qualityInfo.color }}>
                {qualityInfo.label}
              </Text>
            </View>

            {daysUntil != null && (
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

            <View style={{ marginHorizontal: 16 }}>
              <PredictionDetailCard prediction={prediction} />
            </View>

            <Button
              label="Adjust Period Date"
              variant="outline"
              onPress={() => setShowOverride(true)}
              style={{ marginHorizontal: theme.spacing.xl }}
            />

            {/* Prediction History Table */}
            <View style={[styles.historyCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, marginHorizontal: theme.spacing.xl }]}>
              <Text variant="h3" style={{ marginBottom: 12 }}>Prediction History</Text>
              <View style={styles.historyHeader}>
                <Text variant="caption" color="muted" style={{ flex: 1 }}>Month</Text>
                <Text variant="caption" color="muted" style={{ flex: 1 }}>Predicted</Text>
                <Text variant="caption" color="muted" style={{ flex: 1 }}>Actual</Text>
                <Text variant="caption" color="muted" style={{ width: 50, textAlign: 'center' }}>Δ</Text>
              </View>
              {MOCK_HISTORY.map((row, i) => (
                <View
                  key={row.month}
                  style={[styles.historyRow, { backgroundColor: row.onTime ? theme.colors.success + '12' : i % 2 === 0 ? 'transparent' : theme.colors.border + '40' }]}
                >
                  <Text variant="bodySmall" style={{ flex: 1 }}>{row.month}</Text>
                  <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.textSecondary }}>{row.predicted}</Text>
                  <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.textSecondary }}>{row.actual}</Text>
                  <Text variant="bodySmall" style={{ width: 50, textAlign: 'center', color: row.onTime ? theme.colors.success : theme.colors.warning }}>
                    {row.delta > 0 ? `+${row.delta}` : '0'}
                  </Text>
                </View>
              ))}
              <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Last 6 cycles — green rows are exact matches</Text>
            </View>
          </>
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
  historyCard: { padding: 16, marginTop: 8 },
  historyHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF0F4' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 4 },
  errorRefreshBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, marginBottom: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
});
