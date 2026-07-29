import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
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
import { LinearGradient } from 'expo-linear-gradient';

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

const PHASES = [
  { key: 'P', emoji: '🩸', label: 'Period', color: '#F48FB1' },
  { key: 'F', emoji: '🌱', label: 'Fertile', color: '#CE93D8' },
  { key: 'O', emoji: '🌟', label: 'Ovulation', color: '#81C784' },
  { key: 'L', emoji: '🌙', label: 'Luteal', color: '#90CAF9' },
];

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

function getPhaseAccent(encodedDay: string | undefined): string {
  if (!encodedDay) return '#f0f0f0';
  const map: Record<string, string> = {
    P: '#F48FB1', p: '#F48FB1',
    F: '#CE93D8', f: '#CE93D8',
    O: '#81C784', o: '#81C784',
    L: '#90CAF9', l: '#90CAF9',
  };
  return map[encodedDay] ?? '#f0f0f0';
}

function getPhaseForDate(encodedDay: string | undefined): { emoji: string; label: string; color: string; description: string } {
  if (!encodedDay) return { emoji: '🌸', label: 'Unknown', color: '#f0f0f0', description: '' };
  const phaseMatch = encodedDay.toUpperCase();
  if (phaseMatch === 'P') return { emoji: '🩸', label: 'Period', color: '#F48FB1', description: 'Rest and recharge' };
  if (phaseMatch === 'F') return { emoji: '🌱', label: 'Fertile', color: '#CE93D8', description: 'Energy rising' };
  if (phaseMatch === 'O') return { emoji: '🌟', label: 'Ovulation', color: '#81C784', description: 'Peak vitality' };
  if (phaseMatch === 'L') return { emoji: '🌙', label: 'Luteal', color: '#90CAF9', description: 'Slow down' };
  return { emoji: '🌸', label: 'Transition', color: '#E8E8E8', description: '' };
}

function LoadingSkeleton() {
  return (
    <View style={styles.weekRow}>
      {Array.from({ length: 35 }).map((_, i) => {
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

  const cycleDay = calData?.days ? Object.keys(calData.days).length % 28 + 1 : 1;
  const todaysEncoded = encodedDays[format(new Date(), 'yyyy-MM-dd')];
  const currentPhase = getPhaseForDate(todaysEncoded);

  const selectedStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedEncoded = encodedDays[selectedStr] ?? '';
  const selectedPhase = getPhaseForDate(selectedEncoded);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={[theme.colors.accentLight + '59', 'transparent']}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.calHeader}>
          <Pressable
            onPress={() => setCurrentMonth(m => subMonths(m, 1))}
            accessibilityLabel="Previous month"
            style={[styles.navBtn, { borderRadius: 22 }]}
          >
            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={theme.colors.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text variant="h2">{format(currentMonth, 'MMMM yyyy')}</Text>
            <Text style={{ fontSize: 12, color: theme.colors.textSoft, marginTop: 2 }}>
              Cycle Day {cycleDay} · {currentPhase.label}
            </Text>
          </View>
          <Pressable
            onPress={() => setCurrentMonth(m => addMonths(m, 1))}
            accessibilityLabel="Next month"
            style={[styles.navBtn, { borderRadius: 22 }]}
          >
            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke={theme.colors.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>

        <View style={styles.phaseLegendRow}>
          {PHASES.map((p) => (
                <Pressable key={p.key} style={[styles.phasePill, { backgroundColor: p.color + '22', borderRadius: 100 }]} accessibilityLabel={`Phase: ${p.label}`} accessibilityRole="button" accessibilityHint={`${p.label} phase filter`}>
                  <Text style={{ fontSize: 14 }}>{p.emoji}</Text>
                  <Text style={[styles.phasePillLabel, { color: p.color }]}>{p.label}</Text>
                </Pressable>
          ))}
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
              {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day) => {
                const inMonth = isSameMonth(day, currentMonth);
                const selected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);
                const dateStr = format(day, 'yyyy-MM-dd');
                const encoded = encodedDays[dateStr];
                const typeColor = DAY_TYPE_MAP[encoded ?? ''] ?? null;
                const phaseAccent = getPhaseAccent(encoded);

                const bgColor = selected
                  ? phaseAccent
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
                        ? '#1A1A2E'
                        : theme.colors.mauve;

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
                    ]}
                  >
                    <View
                      style={[
                        styles.dayCellInner,
                        { backgroundColor: bgColor, borderRadius: 14 },
                        selected && { shadowColor: phaseAccent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
                        today && !selected && { borderWidth: 2, borderColor: theme.colors.primary },
                      ]}
                    >
                      <Text
                        variant="body"
                        align="center"
                        style={[
                          { color: txtColor, width: 46, height: 46, lineHeight: 46, textAlign: 'center' },
                          encoded === 'c' && { opacity: 0.5, textDecorationLine: 'line-through' },
                        ]}
                      >
                        {format(day, 'd')}
                      </Text>
                      {today && !selected && (
                        <View style={[styles.todayDot, { backgroundColor: '#EF4444' }]} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}

        {selectedDate && (
          <View style={[styles.dayDetailCard, { backgroundColor: '#fff', borderRadius: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="h3">{format(selectedDate, 'MMMM d')}</Text>
              <View style={[styles.phaseBadge, { backgroundColor: selectedPhase.color + '22', borderRadius: 100 }]}>
                <Text style={{ fontSize: 14 }}>{selectedPhase.emoji}</Text>
                <Text style={[styles.phaseBadgeLabel, { color: selectedPhase.color }]}>{selectedPhase.label}</Text>
              </View>
            </View>
            <Text variant="body" color="secondary" style={{ marginTop: 8 }}>{selectedPhase.description}</Text>
            <View style={styles.detailActions}>
              <Pressable style={[styles.detailChip, { backgroundColor: theme.colors.primary, borderRadius: 100 }]}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Log symptoms</Text>
              </Pressable>
              <Pressable style={styles.detailChip}>
                <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '600' }}>Add note</Text>
              </Pressable>
              <Pressable style={[styles.detailChip, { backgroundColor: theme.colors.accentMuted, borderRadius: 100 }]}>
                <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '600' }}>Log mood</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.phaseOverview}>
          <Text variant="h3" style={{ marginBottom: 12 }}>Phase Overview</Text>
          {PHASES.map((p) => (
            <View key={p.key} style={[styles.phaseOverviewCard, { backgroundColor: p.color + '15', borderRadius: 16 }]}>
              <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text variant="body" style={{ fontWeight: '600' }}>{p.label}</Text>
                  <View style={[styles.dateBadge, { backgroundColor: p.color + '33', borderRadius: 100 }]}>
                    <Text style={{ color: p.color, fontSize: 10, fontWeight: '600' }}>Day 1–5</Text>
                  </View>
                </View>
                <Text variant="caption" color="muted" style={{ marginTop: 2 }}>Brief description of the {p.label.toLowerCase()} phase.</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ gap: 8, paddingTop: 16 }}>
          <Button label="Cycle Dashboard" onPress={() => (navigation as any).navigate('CycleDashboard')} size="md" />
          <Button label="Adjust Period Date" onPress={() => setShowOverride(true)} size="md" variant="outline" />
        </View>

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  phaseLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  phasePillLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dayCellInner: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dayDetailCard: {
    padding: 16,
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  phaseBadgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  detailChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  phaseOverview: {
    marginTop: 24,
  },
  phaseOverviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  dateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
