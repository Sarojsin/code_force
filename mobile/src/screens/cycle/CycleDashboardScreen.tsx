import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { BackfillCard, Button, Calendar, Card, DatePickerField, BottomSheet, EndDatePromptCard, MarkEndDateModal, StickyCard, Text, Skeleton } from 'src/components/ui';
import { PredictionDetailCard } from 'src/components/ui/PredictionDetailCard';
import { useTheme, shadow } from 'src/theme';
import { useCycleCalendar, useLogCorrection } from 'src/services/queries';
import { useEndDateStore } from 'src/stores/endDateStore';
import { useCatchUp } from 'src/hooks/useCatchUp';
import { usePeriodCheckIn } from 'src/hooks/usePeriodCheckIn';
import { globalModelClient } from 'src/services/ml/globalModel';
import type { CycleStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<CycleStackParamList, 'CycleDashboard'>;

const overrideSchema = z.object({ overrideDate: z.string().min(1, 'Please select a date') });

type OverrideForm = z.infer<typeof overrideSchema>;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function CycleDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { data: calData, isLoading } = useCycleCalendar(3, 3);
  const logCorrection = useLogCorrection();
  const {
    backfillCards,
    busyMonth,
    isDoneOrSkipped,
    isSkipped,
    handleFill,
    handleSkip,
    endDate,
    confirmEndDate,
    skipEndDate,
    endDateLoading,
  } = useCatchUp();
  const checkIn = usePeriodCheckIn(calData);

  const todayRef = useRef(new Date());
  const noopRef = useRef(() => {});
  const [showOverride, setShowOverride] = useState(false);
  const [showEndDateModal, setShowEndDateModal] = useState(false);
  const route = useRoute<any>();

  const periodStartDate = useEndDateStore((s) => s.periodStartDate);

  useEffect(() => {
    if (route.params?.markEndDate && periodStartDate) {
      setShowEndDateModal(true);
    }
  }, [route.params?.markEndDate, periodStartDate]);

  const overrideForm = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { overrideDate: new Date().toISOString().split('T')[0] },
  });

  useEffect(() => {
    globalModelClient.ensureLatest().catch(() => null);
  }, []);

  const prediction = calData?.predictions ?? null;

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
          const filled = isDoneOrSkipped(card.monthLabel);
          const previousDone = idx === 0 || isDoneOrSkipped(backfillCards[idx - 1].monthLabel);
          return (
            <BackfillCard
              key={card.monthLabel}
              monthLabel={card.monthLabel}
              cardNumber={idx + 1}
              disabled={!previousDone && !filled}
              isSkipped={isSkipped(card.monthLabel)}
              onFill={(s, e) => handleFill(s, e, card.monthLabel)}
              onSkip={() => handleSkip(card.expectedStart, card.expectedEnd, card.monthLabel)}
              loading={busyMonth === card.monthLabel}
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
            <Text variant="h2" align="center" color="secondary">
              No active prediction
            </Text>
            <Text variant="body" align="center" style={{ marginTop: 8, opacity: 0.7 }}>
              We'll start predicting again when you log your next period.
            </Text>
          </Card>
        )}

        {prediction && (
          <StickyCard
            predictedDate={checkIn.predictedDate}
            predictionId={checkIn.predictionId}
            visible={checkIn.visible}
            loading={checkIn.loading}
            onConfirm={checkIn.onConfirm}
            onAdjust={checkIn.onAdjust}
            onSnooze={checkIn.onSnooze}
          />
        )}

        {endDate && (
          <EndDatePromptCard
            visible
            periodStartDate={endDate.periodStartDate ?? ''}
            daysSinceStart={endDate.daysSinceStart}
            onConfirmEndDate={() => setShowEndDateModal(true)}
            onSkip={skipEndDate}
            loading={endDateLoading}
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
          <Calendar selectedDate={todayRef.current} onDateSelect={noopRef.current} encodedDays={calData?.days} />
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

      {endDate && endDate.periodStartDate && (
        <MarkEndDateModal
          visible={showEndDateModal}
          onClose={() => setShowEndDateModal(false)}
          onConfirm={confirmEndDate}
          onSkip={skipEndDate}
          loading={endDateLoading}
          periodStartDate={endDate.periodStartDate}
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
