import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, Calendar, Card, Text, Skeleton } from 'src/components/ui';
import { PredictionDetailCard } from 'src/components/ui/PredictionDetailCard';
import { useTheme, shadow } from 'src/theme';
import { cycleService, CalendarResponse } from 'src/services/api/cycle';
import { globalModelClient } from 'src/services/ml/globalModel';
import type { CycleStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<CycleStackParamList, 'CycleDashboard'>;

export function CycleDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [calData, setCalData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cal, _model] = await Promise.all([
        cycleService.getCalendar(3, 3),
        globalModelClient.ensureLatest().catch(() => null),
      ]);
      setCalData(cal);
    } catch (err) {
      console.warn('Failed to load cycle dashboard', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const nextPeriodDate = calData?.next_period_in_days != null
    ? new Date(Date.now() + calData.next_period_in_days * 86400000)
    : null;

  if (loading) {
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
        <Text variant="h1" style={{ paddingHorizontal: 24, marginBottom: 8 }}>
          Your Cycle
        </Text>

        {nextPeriodDate && calData?.predictions && (
          <PredictionDetailCard prediction={calData.predictions} />
        )}

        {nextPeriodDate && (
          <Card style={[styles.statCard, shadow.lg, { backgroundColor: palette.primary500, borderRadius: theme.radius.xl, marginHorizontal: theme.spacing.lg }]}>
            <Text variant="h2" color="inverse" align="center">
              Next period in {calData!.next_period_in_days} days
            </Text>
            <Text variant="body" color="inverse" align="center" style={{ marginTop: 4, opacity: 0.85 }}>
              around {nextPeriodDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </Text>
          </Card>
        )}

        <View style={[styles.calCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, marginHorizontal: theme.spacing.lg, padding: theme.spacing.md }]}>
          <Calendar
            selectedDate={new Date()}
            onDateSelect={() => {}}
            encodedDays={calData?.days}
          />
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
      </ScrollView>
    </SafeAreaView>
  );
}

import { palette } from 'src/theme';

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingVertical: 16, gap: 16 },
  statCard: { padding: 24 },
  calCard: {},
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 24 },
});
