/**
 * CalendarScreen — Minimal Material Design per UI_UX Calendar spec.
 * Phase color coding, bottom sheet with details, animated day selection.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  addMonths, subMonths,
} from 'date-fns';

import { Text, Button, BottomSheet, DatePickerField } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { cycleService } from 'src/services/api/cycle';
import { useLogCorrection } from 'src/services/queries';

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


// Phase colors per UI_UX Calendar spec
const PHASE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  menstrual: { bg: '#FF5252', text: '#FFFFFF', label: 'Menstrual' },
  follicular: { bg: '#FFD54F', text: '#1A1D26', label: 'Follicular' },
  ovulation: { bg: '#4CAF50', text: '#FFFFFF', label: 'Ovulation' },
  luteal: { bg: '#42A5F5', text: '#FFFFFF', label: 'Luteal' },
};

// Legacy encoded day types
const DAY_TYPE_MAP: Record<string, string> = {
  P: 'menstrual',
  p: 'menstrual',
  F: 'follicular',
  f: 'follicular',
  O: 'ovulation',
  o: 'ovulation',
  L: 'luteal',
  l: 'luteal',
};

function SelectedDaySheet({
  date,
  phase,
  onClose,
  onViewPhase,
}: {
  date: Date;
  phase: string;
  onClose: () => void;
  onViewPhase: (phase: string) => void;
}) {
  const theme = useTheme();
  const translateY = useSharedValue(300);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    opacity.value = withSpring(1, { damping: 20, stiffness: 200 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const phaseInfo = PHASE_COLORS[phase] || PHASE_COLORS.menstrual;

  return (
    <Animated.View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl }, animStyle]}>
      <View style={styles.sheetHandle}>
        <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
      </View>

      <ScrollView contentContainerStyle={styles.sheetContent}>
        <View style={styles.sheetHeader}>
          <Text variant="h3">{format(date, 'MMMM d, yyyy')}</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close" style={{ padding: 4 }}>
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>

        <View style={[styles.phaseBadge, { backgroundColor: phaseInfo.bg, borderRadius: theme.radius.pill }]}>
          <Text variant="bodySmall" style={{ color: phaseInfo.text }}>{phaseInfo.label} Phase</Text>
        </View>

        <Text variant="bodySmall" color="secondary" style={{ marginTop: 16, marginBottom: 8 }}>Quick Log</Text>
        <View style={styles.chipRow}>
          {['😊 Happy', '😴 Tired', '😰 Anxious', '💪 Motivated'].map(chip => (
            <Pressable key={chip} style={[styles.chip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderRadius: theme.radius.pill }]}>
              <Text variant="bodySmall">{chip}</Text>
            </Pressable>
          ))}
        </View>

        <Text variant="bodySmall" color="secondary" style={{ marginTop: 12, marginBottom: 8 }}>Symptoms</Text>
        <View style={styles.chipRow}>
          {['Cramps', 'Bloating', 'Headache', 'Fatigue', 'Nausea'].map(s => (
            <Pressable key={s} style={[styles.chip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderRadius: theme.radius.pill }]}>
              <Text variant="bodySmall">{s}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: 16, gap: 8 }}>
          <Button label="Log Period" onPress={() => {}} size="md" />
          <Button label={`View ${phaseInfo.label} Details`} onPress={() => onViewPhase(phase)} size="md" variant="outline" />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

export function CalendarScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  const { control, handleSubmit } = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { overrideDate: toDateStr(new Date()) },
  });

  const logCorrection = useLogCorrection();

  const handlePermanentOverride = handleSubmit((data) => {
    const endDate = addDays(new Date(data.overrideDate), 5);
    logCorrection.mutate(
      {
        period_start_date: data.overrideDate,
        period_end_date: toDateStr(endDate),
        corrected_prediction_id: null,
      },
      { onSuccess: () => setShowOverride(false) },
    );
  });
  const [encodedDays, setEncodedDays] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const cal = await cycleService.getCalendar(3, 3);
      setEncodedDays(cal?.days ?? {});
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const days = React.useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const selectedPhase = selectedDate
    ? DAY_TYPE_MAP[encodedDays[format(selectedDate, 'yyyy-MM-dd')] ?? ''] ?? 'menstrual'
    : 'menstrual';

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

          {/* Month navigation */}
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

          {/* Weekday headers */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map(day => (
              <View key={day} style={styles.dayCell}>
                <Text variant="caption" color="muted" align="center">{day}</Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIdx) => (
            <View key={weekIdx} style={styles.weekRow}>
              {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, dayIdx) => {
                const inMonth = isSameMonth(day, currentMonth);
                const selected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);
                const dateStr = format(day, 'yyyy-MM-dd');
                const encoded = encodedDays[dateStr];
                const phaseKey = DAY_TYPE_MAP[encoded ?? ''] ?? '';
                const phaseColor = PHASE_COLORS[phaseKey];

                const bgColor = selected
                  ? theme.colors.primary
                  : phaseColor
                    ? phaseColor.bg
                    : 'transparent';
                const txtColor = selected
                  ? '#fff'
                  : phaseColor
                    ? phaseColor.text
                    : today
                      ? theme.colors.primary
                      : inMonth
                        ? theme.colors.textPrimary
                        : theme.colors.textMuted;

                return (
                  <Pressable
                    key={dayIdx}
                    onPress={() => inMonth && setSelectedDate(day)}
                    disabled={!inMonth}
                    accessibilityLabel={`${format(day, 'MMMM d, yyyy')}${phaseKey ? `, ${phaseKey}` : ''}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !!selected }}
                    style={[
                      styles.dayCell,
                      { minHeight: theme.minTouchTarget, minWidth: theme.minTouchTarget },
                      { backgroundColor: bgColor, borderRadius: theme.radius.pill },
                      selected && { backgroundColor: theme.colors.primary, transform: [{ scale: 1.1 }] },
                    ]}
                  >
                    <Text variant="body" align="center" style={{ color: txtColor }}>
                      {format(day, 'd')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* Phase legend */}
          <View style={[styles.legend, { marginTop: theme.spacing.lg }]}>
            {Object.entries(PHASE_COLORS).map(([key, val]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: val.bg, borderRadius: theme.radius.pill }]} />
                <Text variant="caption" color="muted">{val.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.md }}>
            <Button label="Cycle Dashboard" onPress={() => (navigation as any).navigate('CycleDashboard')} size="md" />
            <Button label="Adjust Period Date" onPress={() => setShowOverride(true)} size="md" variant="outline" />
          </View>
        </View>

        {/* Bottom sheet for selected day */}
        {selectedDate && (
          <SelectedDaySheet
            date={selectedDate}
            phase={selectedPhase}
            onClose={() => setSelectedDate(null)}
            onViewPhase={(p) => (navigation as any).navigate('PhaseDetail', { phase: p })}
          />
        )}

        {/* Adjust Period Date Override */}
        <BottomSheet visible={showOverride} onClose={() => setShowOverride(false)}>
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            <Text variant="h3">Adjust Period Date</Text>
            <Text variant="bodySmall" color="secondary">
              When did your last period start? We'll use this to recalculate your predictions.
            </Text>
            <DatePickerField
              control={control}
              name="overrideDate"
              label="Period start date"
            />
            <Button
              label="Save & Recalculate"
              onPress={handlePermanentOverride}
              size="lg"
              loading={logCorrection.isPending}
            />
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
  // Bottom sheet
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 30, height: 4, borderRadius: 2 },
  sheetContent: { padding: 24, paddingTop: 8 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  phaseBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth },
});
