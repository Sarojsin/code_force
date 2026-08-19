import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { useTheme } from 'src/theme';
import { Text } from 'src/components/ui';
import { useCycleDays } from 'src/services/queries/cycle';
import type { DailyDay } from 'src/services/api/cycle';
import Svg, { Path } from 'react-native-svg';

const MOOD_EMOJI: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  anxious: '😰',
  calm: '😌',
  irritable: '😤',
  energetic: '⚡',
  tired: '😴',
  neutral: '😐',
};

const FLOW_LABEL: Record<string, string> = {
  spotting: '🟡',
  light: '🟠',
  medium: '🔴',
  heavy: '🔴🔴',
};

const DayCard = memo(function DayCard({ day, theme }: { day: DailyDay; theme: ReturnType<typeof useTheme> }) {
  const date = new Date(day.log_date + 'T00:00:00');
  const hasData =
    day.mood ||
    day.pain_level != null ||
    day.energy_level != null ||
    day.sleep_minutes != null ||
    day.water_glasses != null ||
    day.flow_level ||
    day.symptoms.length > 0 ||
    day.medications.length > 0 ||
    day.notes;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.cardHeader}>
        <Text variant="body" style={[styles.cardDate, { color: theme.colors.textPrimary }]}>
          {format(date, 'EEE, MMM d')}
        </Text>
        {day.mood && (
          <View style={[styles.badge, { backgroundColor: theme.colors.primary + '18' }]}>
            <Text style={styles.badgeText}>{MOOD_EMOJI[day.mood] || '💭'} {day.mood}</Text>
          </View>
        )}
        {day.flow_level && (
          <View style={[styles.badge, { backgroundColor: '#E5393518' }]}>
            <Text style={styles.badgeText}>{FLOW_LABEL[day.flow_level] || '🔴'} {day.flow_level}</Text>
          </View>
        )}
      </View>

      <View style={styles.metricsRow}>
        {day.pain_level != null && (
          <View style={[styles.metricChip, { backgroundColor: theme.colors.primaryMuted + '30' }]}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Pain</Text>
            <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>{day.pain_level}/10</Text>
          </View>
        )}
        {day.energy_level != null && (
          <View style={[styles.metricChip, { backgroundColor: '#FFB30018' }]}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Energy</Text>
            <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>{day.energy_level}/5</Text>
          </View>
        )}
        {day.sleep_minutes != null && (
          <View style={[styles.metricChip, { backgroundColor: '#7E57C218' }]}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Sleep</Text>
            <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
              {Math.floor(day.sleep_minutes / 60)}h {day.sleep_minutes % 60}m
            </Text>
          </View>
        )}
        {day.water_glasses != null && (
          <View style={[styles.metricChip, { backgroundColor: '#29B6F618' }]}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Water</Text>
            <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>{day.water_glasses}💧</Text>
          </View>
        )}
      </View>

      {day.symptoms.length > 0 && (
        <View style={styles.tagsRow}>
          {day.symptoms.map((s) => (
            <View key={s.id || s.name} style={[styles.tag, { backgroundColor: '#E91E6318', borderColor: '#E91E6330' }]}>
              <Text style={[styles.tagText, { color: '#E91E63' }]}>{s.name} ({s.severity})</Text>
            </View>
          ))}
        </View>
      )}

      {day.medications.length > 0 && (
        <View style={styles.tagsRow}>
          {day.medications.map((m) => (
            <View key={m.id || m.name} style={[styles.tag, { backgroundColor: '#43A04718', borderColor: '#43A04730' }]}>
              <Text style={[styles.tagText, { color: '#43A047' }]}>
                💊 {m.name}{m.dose ? ` ${m.dose}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {day.notes && (
        <Text variant="caption" style={[styles.notes, { color: theme.colors.textSecondary }]} numberOfLines={2}>
          📝 {day.notes}
        </Text>
      )}

      {!hasData && (
        <Text variant="caption" style={[styles.emptyNote, { color: theme.colors.textMuted }]}>
          No observations logged
        </Text>
      )}
    </View>
  );
});

export function DailyLogScreen() {
  const theme = useTheme();
  const [monthOffset, setMonthOffset] = useState(0);

  const targetDate = useMemo(() => {
    const now = new Date();
    return monthOffset === 0 ? now : addDays(now, monthOffset * 30);
  }, [monthOffset]);

  const range = useMemo(() => {
    const start = format(startOfMonth(targetDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(targetDate), 'yyyy-MM-dd');
    return { start, end };
  }, [targetDate]);

  const { data: days = [], isLoading } = useCycleDays(range);

  const sortedDays = useMemo(() => {
    return [...days].sort((a, b) => b.log_date.localeCompare(a.log_date));
  }, [days]);

  const monthLabel = format(targetDate, 'MMMM yyyy');

  const renderItem = useCallback(
    ({ item }: { item: DailyDay }) => <DayCard day={item} theme={theme} />,
    [theme],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.monthNav, { borderBottomColor: theme.colors.border }]}>
        <Pressable
          onPress={() => setMonthOffset((p) => p - 1)}
          style={[styles.navBtn, { backgroundColor: theme.colors.primary + '12' }]}
          accessibilityLabel="Previous month"
          accessibilityRole="button"
        >
          <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={theme.colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text variant="body" style={[styles.monthLabel, { color: theme.colors.textPrimary }]}>{monthLabel}</Text>
        <Pressable
          onPress={() => setMonthOffset((p) => Math.min(p + 1, 0))}
          style={[styles.navBtn, { backgroundColor: theme.colors.primary + '12' }, monthOffset >= 0 && styles.navBtnDisabled]}
          accessibilityLabel="Next month"
          accessibilityRole="button"
          disabled={monthOffset >= 0}
        >
          <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <Path d="M9 18l6-6-6-6" stroke={theme.colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : sortedDays.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="body" style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
            No day logs for this month.{'\n'}Tap a day on the calendar to start logging.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedDays}
          keyExtractor={(item) => item.id || item.log_date}
          renderItem={renderItem}
          initialNumToRender={7}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { padding: 16, paddingBottom: 48 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  cardDate: { fontSize: 15, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  metricChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, minWidth: 60, alignItems: 'center' },
  metricLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  metricValue: { fontSize: 13, fontWeight: '700' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  tagText: { fontSize: 12, fontWeight: '600' },
  notes: { marginTop: 4, fontStyle: 'italic' },
  emptyNote: { fontStyle: 'italic' },
});
