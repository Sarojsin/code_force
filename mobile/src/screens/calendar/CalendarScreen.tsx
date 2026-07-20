import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Animated, { useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  addMonths, subMonths,
} from 'date-fns';

import { Text, Button, BottomSheet, DatePickerField, Skeleton } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCycleCalendar, useLogCorrection } from 'src/services/queries';

const overrideSchema = z.object({
  overrideDate: z.string().min(1, 'Please select a date'),
});

type OverrideForm = z.infer<typeof overrideSchema>;

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

type Nav = any;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DAY_TYPE_MAP: Record<string, { bg: string; text: string; label: string }> = {
  P: { bg: '#F48FB1', text: '#FFFFFF', label: 'Period' },
  p: { bg: '#FCE4EC', text: '#C62828', label: 'Predicted Period' },
  u: { bg: '#FFB3C1', text: '#CC3355', label: 'Unconfirmed' },
  c: { bg: '#E0E0E0', text: '#9E9E9E', label: 'Cancelled' },
  F: { bg: '#CE93D8', text: '#FFFFFF', label: 'Fertile' },
  f: { bg: '#F3E5F5', text: '#7B1FA2', label: 'Predicted Fertile' },
  O: { bg: '#81C784', text: '#FFFFFF', label: 'Ovulation' },
  o: { bg: '#E8F5E9', text: '#2E7D32', label: 'Predicted Ovulation' },
  L: { bg: '#90CAF9', text: '#FFFFFF', label: 'Luteal' },
  l: { bg: '#E3F2FD', text: '#1565C0', label: 'Predicted Luteal' },
  T: { bg: '#42A5F5', text: '#FFFFFF', label: 'Today' },
};

const LEGEND_KEYS = ['P', 'p', 'u', 'F', 'O', 'L'];

function LoadingSkeleton() {
  const skeletonDays = useMemo(() => Array.from({ length: 35 }), []);

  return (
    <View style={styles.weekRow}>
      {skeletonDays.map((_, i) => {
        const animStyle = useAnimatedStyle(() => ({
          opacity: withDelay(i * 30, withSpring(1, { damping: 20 })),
        }));
        return (
          <View key={i} style={styles.dayCell}>
            <Animated.View style={animStyle}>
              <Skeleton width={32} height={32} style={{ borderRadius: 16 }} />
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

export function CalendarScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  const { control, handleSubmit, reset } = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { overrideDate: toDateStr(new Date()) },
  });

  const { data: calData, isLoading } = useCycleCalendar(3, 3);
  const logCorrection = useLogCorrection();

  const encodedDays = calData?.days ?? {};

  const handlePermanentOverride = handleSubmit((data) => {
    const endDate = addDays(new Date(data.overrideDate), 5);
    logCorrection.mutate(
      {
        period_start_date: data.overrideDate,
        period_end_date: toDateStr(endDate),
        corrected_prediction_id: null,
      },
      {
        onSuccess: () => {
          setShowOverride(false);
          reset();
        },
      },
    );
  });

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const selectedPhase = selectedDate
    ? DAY_TYPE_MAP[encodedDays[format(selectedDate, 'yyyy-MM-dd')] ?? ''] ?? DAY_TYPE_MAP.P
    : DAY_TYPE_MAP.P;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]}>
      <View style={styles.container}>
        <View style={styles.calendarSection}>
          <View style={styles.calHeader}>
            <Text variant="h1">Calendar</Text>
            <Pressable
              onPress={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}
              accessibilityLabel="Today"
              style={[styles.todayBtn, { borderColor: theme.colors.primary, borderRadius: theme.radius.pill }]}
            >
              <Text variant="bodySmall" color="primary">Today</Text>
            </Pressable>
          </View>

          <View style={[styles.monthNav, { marginTop: theme.spacing.lg }]}>
            <Pressable
              onPress={() => setCurrentMonth(m => subMonths(m, 1))}
              accessibilityLabel="Previous month"
              style={[styles.navBtn, { minHeight: theme.minTouchTarget, minWidth: theme.minTouchTarget }]}
            >
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <Path d="M15 18l-6-6 6-6" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <Text variant="h3">{format(currentMonth, 'MMMM yyyy')}</Text>
            <Pressable
              onPress={() => setCurrentMonth(m => addMonths(m, 1))}
              accessibilityLabel="Next month"
              style={[styles.navBtn, { minHeight: theme.minTouchTarget, minWidth: theme.minTouchTarget }]}
            >
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map(day => (
              <View key={day} style={styles.dayCell}>
                <Text variant="caption" color="muted" align="center">{day}</Text>
              </View>
            ))}
          </View>

          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIdx) => (
              <View key={weekIdx} style={styles.weekRow}>
                {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, dayIdx) => {
                  const inMonth = isSameMonth(day, currentMonth);
                  const selected = selectedDate && isSameDay(day, selectedDate);
                  const today = isToday(day);
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const encoded = encodedDays[dateStr];
                  const typeColor = DAY_TYPE_MAP[encoded ?? ''] ?? null;

                  const bgColor = selected
                    ? theme.colors.primary
                    : typeColor
                      ? typeColor.bg
                      : 'transparent';
                  const txtColor = selected
                    ? '#fff'
                    : typeColor
                      ? typeColor.text
                      : today
                        ? theme.colors.primary
                        : inMonth
                          ? theme.colors.textPrimary
                          : theme.colors.textMuted;

                  const isCancelled = encoded === 'c';

                  return (
                      <Pressable
                        key={dateStr}
                        onPress={() => inMonth && setSelectedDate(day)}
                        disabled={!inMonth}
                        accessibilityLabel={`${format(day, 'MMMM d, yyyy')}${encoded ? `, ${DAY_TYPE_MAP[encoded]?.label ?? encoded}` : ''}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: !!selected }}
                        style={[
                          styles.dayCell,
                          { minHeight: theme.minTouchTarget, minWidth: theme.minTouchTarget },
                          { backgroundColor: bgColor, borderRadius: theme.radius.pill },
                          selected && { backgroundColor: theme.colors.primary, transform: [{ scale: 1.1 }] },
                        ]}
                      >
                        <Text
                          variant="body"
                          align="center"
                          style={[
                            { color: txtColor },
                            isCancelled && { opacity: 0.5, textDecorationLine: 'line-through' },
                          ]}
                        >
                          {format(day, 'd')}
                        </Text>
                      </Pressable>
                  );
                })}
              </View>
            ))
          )}

          <View style={[styles.legend, { marginTop: theme.spacing.lg }]}>
            {LEGEND_KEYS.map((key) => {
              const val = DAY_TYPE_MAP[key];
              return (
                <View key={key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: val.bg, borderRadius: theme.radius.pill }]} />
                  <Text variant="caption" color="muted">{val.label}</Text>
                </View>
              );
            })}
          </View>

          <View style={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.md }}>
            <Button label="Cycle Dashboard" onPress={() => (navigation as any).navigate('CycleDashboard')} size="md" />
            <Button label="Adjust Period Date" onPress={() => setShowOverride(true)} size="md" variant="outline" />
          </View>
        </View>

        <BottomSheet
          visible={selectedDate != null}
          onClose={() => setSelectedDate(null)}
          title={selectedDate ? format(selectedDate, 'MMMM d, yyyy') : ''}
          snapPoints={[0.3, 0.65, 0.9]}
        >
          <View style={{ gap: 12 }}>
            <View style={[styles.phaseBadge, { backgroundColor: selectedPhase.bg, borderRadius: theme.radius.pill, alignSelf: 'flex-start' }]}>
              <Text variant="bodySmall" style={{ color: selectedPhase.text }}>{selectedPhase.label} Phase</Text>
            </View>

            <Text variant="bodySmall" color="secondary">Quick Log</Text>
            <View style={styles.chipRow}>
              {['😊 Happy', '😴 Tired', '😰 Anxious', '💪 Motivated'].map(chip => (
                <Pressable key={chip} style={[styles.chip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderRadius: theme.radius.pill }]}>
                  <Text variant="bodySmall">{chip}</Text>
                </Pressable>
              ))}
            </View>

            <Text variant="bodySmall" color="secondary">Symptoms</Text>
            <View style={styles.chipRow}>
              {['Cramps', 'Bloating', 'Headache', 'Fatigue', 'Nausea'].map(s => (
                <Pressable key={s} style={[styles.chip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderRadius: theme.radius.pill }]}>
                  <Text variant="bodySmall">{s}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Button label="Log Period" onPress={() => {}} size="md" style={{ flex: 1 }} />
              <Button label={`View ${selectedPhase.label}`} onPress={() => (navigation as any).navigate('PhaseDetail', { phase: selectedPhase.label.toLowerCase() })} size="md" variant="outline" style={{ flex: 1 }} />
            </View>
          </View>
        </BottomSheet>

        <BottomSheet visible={showOverride} onClose={() => setShowOverride(false)}>
          <View style={{ gap: 12 }}>
            <Text variant="h3">Adjust Period Date</Text>
            <Text variant="bodySmall" color="secondary">
              When did your last period start? We'll use this to recalculate your predictions.
            </Text>
            <DatePickerField control={control} name="overrideDate" label="Period start date" />
            <Button label="Save & Recalculate" onPress={handlePermanentOverride} size="lg" loading={logCorrection.isPending} />
          </View>
        </BottomSheet>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, justifyContent: 'space-between' },
  calendarSection: { paddingHorizontal: 24, paddingTop: 16 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8 },
  phaseBadge: { paddingHorizontal: 12, paddingVertical: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth },
});
