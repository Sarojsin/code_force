import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Button, Calendar, Card, DatePickerField, BottomSheet, StickyCard, Text, Skeleton } from 'src/components/ui';
import { PredictionDetailCard } from 'src/components/ui/PredictionDetailCard';
import { useTheme, shadow } from 'src/theme';
import { useCycleCalendar, useLogCorrection, useLogSnooze } from 'src/services/queries';
import { globalModelClient } from 'src/services/ml/globalModel';
import type { CycleStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<CycleStackParamList, 'CycleDashboard'>;

const SNOOZE_KEY = 'shecare.sticky_snooze';

interface SnoozeState {
  predictionId: string;
  dayOffset: number;
  snoozedAt: string;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function CycleDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { data: calData, isLoading } = useCycleCalendar(3, 3);
  const logCorrection = useLogCorrection();
  const logSnooze = useLogSnooze();

  const [snoozeState, setSnoozeState] = useState<SnoozeState | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideDate, setOverrideDate] = useState(new Date());

  useEffect(() => {
    globalModelClient.ensureLatest().catch(() => null);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SNOOZE_KEY).then((val) => {
      if (val) {
        try {
          setSnoozeState(JSON.parse(val));
        } catch {}
      }
    });
  }, []);

  const persistSnooze = useCallback(async (state: SnoozeState | null) => {
    if (state) {
      await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(state));
    } else {
      await AsyncStorage.removeItem(SNOOZE_KEY);
    }
    setSnoozeState(state);
  }, []);

  const prediction = calData?.predictions ?? null;
  const today = new Date();

  const showStickyCard = (() => {
    if (!prediction) return false;
    const pDate = new Date(prediction.predicted_next_period_start);
    const windowStart = addDays(pDate, -3);
    const windowEnd = addDays(pDate, 6);
    if (today < windowStart || today > windowEnd) return false;
    if (snoozeState) {
      const snoozedAt = new Date(snoozeState.snoozedAt);
      const snoozedDay = toDateStr(snoozedAt);
      const todayStr = toDateStr(today);
      if (snoozedDay === todayStr) return false;
      const snoozeEnd = addDays(snoozedAt, snoozeState.dayOffset);
      if (today <= snoozeEnd) return false;
    }
    return true;
  })();

  const handleConfirm = useCallback(
    (predictionId: string, confirmedDate: string) => {
      const endDate = new Date(confirmedDate);
      endDate.setDate(endDate.getDate() + 5);
      logCorrection.mutate(
        {
          period_start_date: confirmedDate,
          period_end_date: toDateStr(endDate),
          corrected_prediction_id: predictionId,
        },
        { onSuccess: () => persistSnooze(null) },
      );
    },
    [logCorrection, persistSnooze],
  );

  const handleAdjust = useCallback(
    (predictionId: string, newDate: string) => {
      const endDate = new Date(newDate);
      endDate.setDate(endDate.getDate() + 5);
      logCorrection.mutate(
        {
          period_start_date: newDate,
          period_end_date: toDateStr(endDate),
          corrected_prediction_id: predictionId,
        },
        { onSuccess: () => persistSnooze(null) },
      );
    },
    [logCorrection, persistSnooze],
  );

  const handleSnooze = useCallback(
    (predictionId: string, _dayOffset: number) => {
      const currentOffset = snoozeState?.predictionId === predictionId ? snoozeState.dayOffset + 1 : 1;
      logSnooze.mutate(
        { predictedCycleId: predictionId, dayOffset: currentOffset },
        { onSuccess: () => persistSnooze({ predictionId, dayOffset: currentOffset, snoozedAt: toDateStr(today) }) },
      );
    },
    [logSnooze, persistSnooze, snoozeState, today],
  );

  const handlePermanentOverride = useCallback(() => {
    if (!overrideDate) return;
    const endDate = addDays(overrideDate, 5);
    logCorrection.mutate(
      {
        period_start_date: toDateStr(overrideDate),
        period_end_date: toDateStr(endDate),
        corrected_prediction_id: prediction?.id ?? null,
      },
      { onSuccess: () => setShowOverride(false) },
    );
  }, [overrideDate, logCorrection, prediction]);

  const nextPeriodDate = calData?.next_period_in_days != null
    ? addDays(new Date(), calData.next_period_in_days)
    : null;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Skeleton height={120} style={{ marginBottom: 16 }} />
          <Skeleton height={300} style={{ marginBottom: 16 }} />
          <Skeleton height={80} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="h1" style={{ paddingHorizontal: theme.spacing.xl, marginBottom: theme.spacing.sm }}>
          Your Cycle
        </Text>

        {prediction && nextPeriodDate && (
          <PredictionDetailCard prediction={prediction} />
        )}

        {prediction && (
          <StickyCard
            predictedDate={prediction.predicted_next_period_start}
            predictionId={prediction.id}
            visible={showStickyCard}
            loading={logCorrection.isPending || logSnooze.isPending}
            onConfirm={handleConfirm}
            onAdjust={handleAdjust}
            onSnooze={handleSnooze}
          />
        )}

        {nextPeriodDate && (
          <Card
            style={[
              styles.statCard,
              shadow.lg,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.xl,
                marginHorizontal: theme.spacing.lg,
              },
            ]}
          >
            <Text variant="h2" color="inverse" align="center">
              Next period in {calData!.next_period_in_days} days
            </Text>
            <Text variant="body" color="inverse" align="center" style={{ marginTop: 4, opacity: 0.85 }}>
              around {nextPeriodDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </Text>
          </Card>
        )}

        <View
          style={[
            styles.calCard,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              marginHorizontal: theme.spacing.lg,
              padding: theme.spacing.md,
            },
          ]}
        >
          <Calendar selectedDate={new Date()} onDateSelect={() => {}} encodedDays={calData?.days} />
        </View>

        <View style={styles.actions}>
          <Button
            label="Log Period"
            onPress={() => navigation.navigate('LogPeriod')}
            size="md"
            style={{ flex: 1 }}
          />
          <Button
            label="Predictions"
            onPress={() => navigation.navigate('CyclePredictions')}
            size="md"
            variant="outline"
            style={{ flex: 1 }}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label="History"
            onPress={() => navigation.navigate('CycleHistory')}
            size="md"
            variant="outline"
            style={{ flex: 1 }}
          />
          <Button
            label="Analytics"
            onPress={() => navigation.navigate('CycleAnalytics')}
            size="md"
            variant="outline"
            style={{ flex: 1 }}
          />
        </View>

        <Button
          label="Adjust Period Date"
          variant="outline"
          onPress={() => setShowOverride(true)}
          style={{ marginHorizontal: theme.spacing.xl, marginTop: theme.spacing.sm }}
        />
      </ScrollView>

      <BottomSheet
        visible={showOverride}
        onClose={() => setShowOverride(false)}
        title="Adjust Period Date"
      >
        <DatePickerField
          control={null as any}
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
  statCard: { padding: 24 },
  calCard: {},
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 24 },
});
