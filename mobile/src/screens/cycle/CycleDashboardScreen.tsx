import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Toast from 'react-native-toast-message';

import { BackfillCard, Button, Calendar, Card, DatePickerField, BottomSheet, EndDatePromptCard, MarkEndDateModal, StickyCard, Text, Skeleton } from 'src/components/ui';
import { PredictionDetailCard } from 'src/components/ui/PredictionDetailCard';
import { useTheme, shadow } from 'src/theme';
import { useCycleCalendar, useCycleEntries, useCreateCycleEntry, useLogCorrection, useLogSnooze, useUpdateCycleEntry } from 'src/services/queries';
import { useEndDateStore } from 'src/stores/endDateStore';
import { cancelEndDateNotification } from 'src/services/endDateNotifications';
import { globalModelClient } from 'src/services/ml/globalModel';
import { modelUpdater } from 'src/services/ml';
import { useNetworkStatus } from 'src/services/sync';
import type { CycleStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<CycleStackParamList, 'CycleDashboard'>;

const SNOOZE_KEY = 'shecare.sticky_snooze';

interface SnoozeState {
  predictionId: string;
  dayOffset: number;
  snoozedAt: string;
}

const overrideSchema = z.object({ overrideDate: z.string().min(1, 'Please select a date') });

type OverrideForm = z.infer<typeof overrideSchema>;

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
  const updateEntry = useUpdateCycleEntry();
  const { isConnected } = useNetworkStatus();
  const { data: entries } = useCycleEntries({ limit: 1 });
  const createEntry = useCreateCycleEntry();

  const [snoozeState, setSnoozeState] = useState<SnoozeState | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [showEndDateModal, setShowEndDateModal] = useState(false);
  const [backfillDone, setBackfillDone] = useState<string[]>([]);
  const [backfillSkipped, setBackfillSkipped] = useState<string[]>([]);
  const [backfillBusy, setBackfillBusy] = useState<string | null>(null);
  const route = useRoute<any>();

  // ---- Backfill detection ----
  const backfillCards = (() => {
    const lastEntry = entries?.[0];
    if (!lastEntry) return [];
    if (lastEntry.cycle_type === 'anovulatory') return [];
    const lastStart = new Date(lastEntry.period_start_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSince = Math.round((today.getTime() - lastStart.getTime()) / 86400000);
    if (daysSince < 56) return []; // < 2 missed cycles → no cards

    const avgCycle = 28;
    const missedCycles = Math.min(3, Math.floor(daysSince / avgCycle) - 1);
    if (missedCycles <= 0) return [];

    const cards: Array<{ monthLabel: string; expectedStart: string; expectedEnd: string }> = [];
    for (let i = 0; i < missedCycles; i++) {
      const cycleStart = new Date(lastStart.getTime() + (missedCycles - i) * avgCycle * 86400000);
      const cycleEnd = new Date(cycleStart.getTime() + 4 * 86400000);
      const monthLabel = cycleStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      cards.push({
        monthLabel,
        expectedStart: cycleStart.toISOString().split('T')[0],
        expectedEnd: cycleEnd.toISOString().split('T')[0],
      });
    }
    return cards;
  })();

  const handleBackfillFill = useCallback(
    (expectedStart: string, expectedEnd: string, monthLabel: string) => {
      setBackfillBusy(monthLabel);
      createEntry.mutate(
        {
          period_start_date: expectedStart,
          period_end_date: expectedEnd,
          cycle_type: 'menstrual',
        },
        {
          onSuccess: () => {
            setBackfillDone((prev) => [...prev, monthLabel]);
            setBackfillBusy(null);
          },
          onError: () => setBackfillBusy(null),
        },
      );
    },
    [createEntry],
  );

  const handleBackfillSkip = useCallback(
    (expectedStart: string, expectedEnd: string, monthLabel: string) => {
      setBackfillBusy(monthLabel);
      createEntry.mutate(
        {
          period_start_date: expectedStart,
          period_end_date: expectedEnd,
          cycle_type: 'anovulatory',
        },
        {
          onSuccess: () => {
            setBackfillSkipped((prev) => [...prev, monthLabel]);
            setBackfillBusy(null);
          },
          onError: () => setBackfillBusy(null),
        },
      );
    },
    [createEntry],
  );

  const doneOrSkipped = (ml: string) => backfillDone.includes(ml) || backfillSkipped.includes(ml);
  const endDateStore = useEndDateStore();

  useEffect(() => {
    if (route.params?.markEndDate && endDateStore.periodStartDate) {
      setShowEndDateModal(true);
    }
  }, [route.params?.markEndDate, endDateStore.periodStartDate]);
  const overrideForm = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { overrideDate: toDateStr(new Date()) },
  });

  useEffect(() => {
    globalModelClient.ensureLatest().catch(() => null);
  }, []);

  useEffect(() => {
    if (isConnected) {
      modelUpdater.checkForUpdate().then((result) => {
        if (result.wellness || result.minilm) {
          Toast.show({ type: 'success', text1: 'Wellness model updated — predictions improved' });
        }
      }).catch(() => {});
    }
  }, [isConnected]);

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
    if (!calData?.needs_checkin) return false;
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
      logCorrection.mutate(
        { period_start_date: confirmedDate, corrected_prediction_id: predictionId },
        { onSuccess: () => persistSnooze(null) },
      );
    },
    [logCorrection, persistSnooze],
  );

  const handleAdjust = useCallback(
    (predictionId: string, newDate: string) => {
      logCorrection.mutate(
        { period_start_date: newDate, corrected_prediction_id: predictionId },
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

  const handleConfirmEndDate = useCallback(
    (endDate: string) => {
      if (!endDateStore.entryId) return;
      updateEntry.mutate(
        { id: endDateStore.entryId, data: { period_end_date: endDate } },
        { onSuccess: () => {
          if (endDateStore.notificationId) cancelEndDateNotification(endDateStore.notificationId).catch(() => {});
          endDateStore.clearPending();
          setShowEndDateModal(false);
        }},
      );
    },
    [updateEntry, endDateStore],
  );

  const handleSkipEndDate = useCallback(() => {
    if (endDateStore.notificationId) cancelEndDateNotification(endDateStore.notificationId).catch(() => {});
    endDateStore.clearPending();
    setShowEndDateModal(false);
  }, [endDateStore]);

  const daysSinceStart = endDateStore.periodStartDate
    ? Math.max(0, Math.round((today.getTime() - new Date(endDateStore.periodStartDate + 'T00:00:00').getTime()) / 86400000))
    : 0;

  const handlePermanentOverride = overrideForm.handleSubmit((data) => {
    logCorrection.mutate(
      {
        period_start_date: data.overrideDate,
        corrected_prediction_id: prediction?.id ?? null,
      },
      { onSuccess: () => setShowOverride(false) },
    );
  });

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

        {backfillCards.map((card, idx) => {
          const filled = doneOrSkipped(card.monthLabel);
          const previousDone = idx === 0 || doneOrSkipped(backfillCards[idx - 1].monthLabel);
          return (
            <BackfillCard
              key={card.monthLabel}
              monthLabel={card.monthLabel}
              cardNumber={idx + 1}
              disabled={!previousDone && !filled}
              isSkipped={backfillSkipped.includes(card.monthLabel)}
              onFill={(s, e) => handleBackfillFill(s, e, card.monthLabel)}
              onSkip={() => handleBackfillSkip(card.expectedStart, card.expectedEnd, card.monthLabel)}
              loading={backfillBusy === card.monthLabel}
            />
          );
        })}

        {prediction && nextPeriodDate && (
          <PredictionDetailCard prediction={prediction} />
        )}

        {!prediction && (
          <Card
            style={[
              styles.statCard,
              shadow.lg,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.xl,
                marginHorizontal: theme.spacing.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text variant="h2" align="center" color="textSecondary">
              No active prediction
            </Text>
            <Text variant="body" align="center" style={{ marginTop: 8, opacity: 0.7 }}>
              We'll start predicting again when you log your next period.
            </Text>
          </Card>
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

        {endDateStore.periodStartDate && (
          <EndDatePromptCard
            visible
            periodStartDate={endDateStore.periodStartDate}
            daysSinceStart={daysSinceStart}
            onConfirmEndDate={() => setShowEndDateModal(true)}
            onSkip={handleSkipEndDate}
            loading={logCorrection.isPending}
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
          control={overrideForm.control}
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

      {endDateStore.periodStartDate && (
        <MarkEndDateModal
          visible={showEndDateModal}
          onClose={() => setShowEndDateModal(false)}
          onConfirm={handleConfirmEndDate}
          onSkip={handleSkipEndDate}
          loading={logCorrection.isPending}
          periodStartDate={endDateStore.periodStartDate}
        />
      )}
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
