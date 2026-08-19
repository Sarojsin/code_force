import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Svg, { Path } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { format, addMonths, subMonths } from 'date-fns';

import { Text, Button, BottomSheet, DatePickerField, Calendar, DayDetailSheet, Skeleton } from 'src/components/ui';
import { ScreenContainer } from 'src/components/core';
import { useTheme } from 'src/theme';
import {
  useCycleCalendar,
  useCycleEntries,
  useLogCorrection,
  useCycleDays,
  CYCLE_ENTRIES_WINDOW,
} from 'src/services/queries';
import { computeCycleDay, computePhaseRanges, PHASE_META, toLocalDateStr, derivePhaseForDate, getPhaseMeta } from 'src/utils';
import { LinearGradient } from 'expo-linear-gradient';
import { PhaseDetailSheet } from 'src/components/calendar/PhaseDetailSheet';
import { PHASE_CONTENT } from 'src/constants/phaseContent';
import type { PhaseRange } from 'src/utils/cyclePhases';
import type { DailyDay } from 'src/services/api';

const overrideSchema = z.object({
  overrideDate: z.string().min(1, 'Please select a date'),
});
type OverrideForm = z.infer<typeof overrideSchema>;

function toDateStr(date: Date): string {
  return toLocalDateStr(date);
}
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

type Nav = any;

const PHASES = [
  { key: 'P', emoji: '🩸', label: 'Period', color: '#F48FB1', letters: 'Ppw' },
  { key: 'Fl', emoji: '🌱', label: 'Follicular', color: '#FFDAB9', letters: 'Flfl' },
  { key: 'F', emoji: '💮', label: 'Fertile', color: '#CE93D8', letters: 'Ff' },
  { key: 'O', emoji: '🌟', label: 'Ovulation', color: '#81C784', letters: 'Oo' },
  { key: 'L', emoji: '🌙', label: 'Luteal', color: '#90CAF9', letters: 'Ll' },
];

const OVERVIEW_META: Record<PhaseRange['key'], (typeof PHASE_META)['menstrual']> = {
  menstrual: PHASE_META.menstrual,
  follicular: PHASE_META.follicular,
  fertile: PHASE_META.fertile,
  ovulation: PHASE_META.ovulation,
  luteal: PHASE_META.luteal,
};

function getPhaseForDate(days: Record<string, string>, dateStr: string): { emoji: string; label: string; color: string; description: string } {
  const phaseKey = derivePhaseForDate(days, dateStr);
  const meta = getPhaseMeta(phaseKey);
  return { emoji: meta.emoji, label: meta.label, color: meta.accent, description: meta.desc };
}

function getPhaseAccent(days: Record<string, string>, dateStr: string): string {
  const phaseKey = derivePhaseForDate(days, dateStr);
  return getPhaseMeta(phaseKey).accent;
}

function computeCycleLengthStats(
  entries: { period_start_date: string; period_end_date?: string | null }[],
): { lengths: number[]; stdDev: number; irregularCount: number } {
  const completed = entries.filter((e) => e.period_end_date);
  if (completed.length < 2) return { lengths: [], stdDev: 0, irregularCount: 0 };
  const sorted = [...completed].sort((a, b) => a.period_start_date.localeCompare(b.period_start_date));
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff =
      (new Date(sorted[i].period_start_date).getTime() -
        new Date(sorted[i - 1].period_start_date).getTime()) /
      86_400_000;
    if (diff >= 20 && diff <= 45) lengths.push(Math.round(diff));
  }
  if (lengths.length < 2) return { lengths, stdDev: 0, irregularCount: 0 };
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
  const irregularCount = lengths.filter((l) => l < 21 || l > 35).length;
  return { lengths, stdDev, irregularCount };
}

export function CalendarScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [activePhaseFilter, setActivePhaseFilter] = useState<string | null>(null);

  const [showDaySheet, setShowDaySheet] = useState(false);
  const [selectedPhaseDetail, setSelectedPhaseDetail] = useState<PhaseRange['key'] | null>(null);
  const sheetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (sheetTimerRef.current) {
        clearTimeout(sheetTimerRef.current);
        sheetTimerRef.current = null;
      }
    };
  }, []);

  const { control, handleSubmit, reset } = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { overrideDate: toDateStr(new Date()) },
  });

  const { data: calData, isLoading } = useCycleCalendar(3, 3);
  const { data: cycleEntries = [] } = useCycleEntries({ ...CYCLE_ENTRIES_WINDOW });
  const logCorrection = useLogCorrection();
  const encodedDays = useMemo(() => calData?.days ?? {}, [calData]);

  const today = useMemo(() => new Date(), []);
  const cycleDay = useMemo(() => computeCycleDay(calData?.days, today), [calData, today]);
  const todaysStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);
  const currentPhase = useMemo(
    () => getPhaseForDate(encodedDays, todaysStr),
    [encodedDays, todaysStr],
  );

  const selectedStr = useMemo(
    () => (selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''),
    [selectedDate],
  );
  const selectedPhase = useMemo(
    () => getPhaseForDate(encodedDays, selectedStr),
    [encodedDays, selectedStr],
  );

  const { data: selectedDayData } = useCycleDays(
    selectedDate
      ? { start: toLocalDateStr(selectedDate), end: toLocalDateStr(selectedDate) }
      : undefined,
    { enabled: !!selectedDate },
  );
  const dayDataForSheet: DailyDay | null = useMemo(() => {
    if (!selectedDate || !selectedDayData) return null;
    return selectedDayData.find((d) => d.log_date === toLocalDateStr(selectedDate)) ?? null;
  }, [selectedDate, selectedDayData]);

  const coveringEntry = useMemo(() => {
    if (!selectedDate) return null;
    const dateStr = toDateStr(selectedDate);
    return (
      cycleEntries.find(
        (e) =>
          e.period_start_date <= dateStr &&
          (e.period_end_date ?? e.period_start_date) >= dateStr,
      ) ?? null
    );
  }, [selectedDate, cycleEntries]);

  const dimmedDates = useMemo(() => {
    if (!activePhaseFilter) return undefined;
    const letters = PHASES.find((p) => p.key === activePhaseFilter)?.letters ?? '';
    const set = new Set<string>();
    for (const [key, code] of Object.entries(encodedDays)) {
      if (!letters.includes(code)) set.add(key);
    }
    return set;
  }, [activePhaseFilter, encodedDays]);

  const phaseRanges = useMemo(() => computePhaseRanges(calData?.days, today), [calData, today]);
  const predictedCycleLength = calData?.predictions?.predicted_cycle_length ?? 28;
  const cycleStats = useMemo(() => computeCycleLengthStats(cycleEntries), [cycleEntries]);

  const openDaySheetFromPhase = useCallback(() => {
    setSelectedPhaseDetail(null);
    if (sheetTimerRef.current) {
      clearTimeout(sheetTimerRef.current);
    }
    sheetTimerRef.current = setTimeout(() => {
      setSelectedDate(today);
      setShowDaySheet(true);
    }, 300);
  }, [today]);

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

  const openDaySheet = () => {
    setShowDaySheet(true);
  };

  const closeDaySheet = () => {
    if (sheetTimerRef.current) {
      clearTimeout(sheetTimerRef.current);
      sheetTimerRef.current = null;
    }
    setShowDaySheet(false);
  };

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setShowDaySheet(true);
  }, []);

  const phaseAccentForDate = useCallback(
    (dateStr: string) => getPhaseAccent(encodedDays, dateStr),
    [encodedDays],
  );

  return (
    <ScreenContainer
      scroll
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
    >
      <LinearGradient
        colors={[theme.colors.accentLight + '59', 'transparent']}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.calHeader}>
          <Pressable
            onPress={() => setCurrentMonth((m) => subMonths(m, 1))}
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
            onPress={() => setCurrentMonth((m) => addMonths(m, 1))}
            accessibilityLabel="Next month"
            style={[styles.navBtn, { borderRadius: 22 }]}
          >
            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke={theme.colors.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>

        <View style={styles.phaseLegendRow}>
          {PHASES.map((p) => {
            const isActive = activePhaseFilter === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => setActivePhaseFilter(isActive ? null : p.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Filter: ${p.label}`}
                style={[
                  styles.phasePill,
                  {
                    backgroundColor: isActive ? p.color : p.color + '22',
                    borderRadius: 100,
                    borderWidth: isActive ? 0 : 1,
                    borderColor: p.color + '55',
                  },
                  isActive && theme.shadow.chip,
                ]}
              >
                <Text variant="emoji">{p.emoji}</Text>
                <Text style={[styles.phasePillLabel, { color: isActive ? '#fff' : '#5A3A47' }]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Calendar
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          selectedDate={selectedDate ?? undefined}
          onDateSelect={handleDateSelect}
          encodedDays={encodedDays}
          phaseAccentForDate={phaseAccentForDate}
          dimmedDates={dimmedDates}
          showHeader={false}
          isLoading={isLoading}
        />

        {selectedDate && (
          <View style={[styles.dayDetailCard, { backgroundColor: '#fff', borderRadius: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="h3">{format(selectedDate, 'MMMM d')}</Text>
              <View style={[styles.phaseBadge, { backgroundColor: selectedPhase.color + '22', borderRadius: 100 }]}>
                <Text variant="emoji">{selectedPhase.emoji}</Text>
                <Text style={[styles.phaseBadgeLabel, { color: selectedPhase.color }]}>{selectedPhase.label}</Text>
              </View>
            </View>
            <Text variant="body" color="secondary" style={{ marginTop: 8 }}>{selectedPhase.description}</Text>
            <View style={styles.detailActions}>
              <Pressable
                onPress={openDaySheet}
                accessibilityRole="button"
                style={[
                  styles.detailChip,
                  { backgroundColor: theme.colors.primary, borderRadius: 100 },
                ]}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Log period & details</Text>
              </Pressable>
            </View>
            {!coveringEntry && (
              <Text variant="caption" color="muted" style={{ marginTop: 8 }}>
                Symptoms can only be logged on days within a logged period.
              </Text>
            )}
          </View>
        )}

        <View style={styles.phaseOverview}>
          <Text variant="h3" style={{ marginBottom: 12 }}>Phase Overview</Text>
          {isLoading ? (
            <>
              <Skeleton height={64} style={{ marginBottom: 8, borderRadius: 16 }} />
              <Skeleton height={64} style={{ marginBottom: 8, borderRadius: 16 }} />
              <Skeleton height={64} style={{ marginBottom: 8, borderRadius: 16 }} />
              <Skeleton height={64} style={{ borderRadius: 16 }} />
            </>
          ) : (
            phaseRanges.map((range) => {
              const meta = OVERVIEW_META[range.key];
              const content = PHASE_CONTENT[range.key];
              const badge =
                range.startDay === null
                  ? 'Upcoming'
                  : range.startDay === range.endDay
                    ? `Day ${range.startDay}`
                    : `Day ${range.startDay}–${range.endDay}`;
              return (
                <Pressable
                  key={range.key}
                  onPress={() => {
                    setSelectedPhaseDetail(range.key);
                  }}
                  style={[styles.phaseOverviewCard, { backgroundColor: meta.bg + '66', borderRadius: 16 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${content.label} phase, ${badge}`}
                >
                  <Text variant="emoji">{meta.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text variant="body" style={{ fontWeight: '600' }}>{meta.label}</Text>
                      <View style={[styles.dateBadge, { backgroundColor: meta.fg + '22', borderRadius: 100 }]}>
                        <Text style={{ color: meta.fg, fontSize: 10, fontWeight: '600' }}>{badge}</Text>
                      </View>
                    </View>
                    <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                      {content.energyTag} · {content.desc}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <View style={{ gap: 8, paddingTop: 16 }}>
          <Button label="Cycle Dashboard" onPress={() => (navigation as any).navigate('CycleDashboard')} size="md" />
          <Button label="Adjust Period Date" onPress={() => setShowOverride(true)} size="md" variant="outline" />
        </View>

        <BottomSheet visible={showOverride} onClose={() => setShowOverride(false)} title="Adjust Period Date">
          <View style={{ gap: 12 }}>
            <Text variant="bodySmall" color="secondary">
              When did your last period start? We'll use this to recalculate your predictions.
            </Text>
            <DatePickerField control={control} name="overrideDate" label="Period start date" />
            <Button label="Save & Recalculate" onPress={handlePermanentOverride} size="lg" loading={logCorrection.isPending} />
          </View>
        </BottomSheet>

        {selectedDate && (
          <DayDetailSheet
            visible={showDaySheet}
            date={selectedDate}
            phase={selectedPhase}
            encodedDays={encodedDays}
            coveringEntry={coveringEntry}
            initialDayData={dayDataForSheet}
            onClose={() => {
              closeDaySheet();
              setSelectedDate(null);
            }}
            onDone={() => {
              closeDaySheet();
              setSelectedDate(null);
              Toast.show({ type: 'success', text1: 'Day logged' });
            }}
          />
        )}

        {selectedPhaseDetail && (
          <BottomSheet
            visible={!!selectedPhaseDetail}
            onClose={() => setSelectedPhaseDetail(null)}
            title=""
            snapPoints={[0.7, 0.9]}
          >
            <PhaseDetailSheet
              phaseKey={selectedPhaseDetail}
              phaseStartDay={phaseRanges.find((r) => r.key === selectedPhaseDetail)?.startDay ?? null}
              phaseEndDay={phaseRanges.find((r) => r.key === selectedPhaseDetail)?.endDay ?? null}
              predictedCycleLength={predictedCycleLength}
              cycleDay={cycleDay}
              todayMood={null}
              cycleStats={cycleStats}
              onLogToday={openDaySheetFromPhase}
              onPreFill={() => undefined}
            />
          </BottomSheet>
        )}
      </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24 },
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
    minHeight: 44,
    justifyContent: 'center',
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
