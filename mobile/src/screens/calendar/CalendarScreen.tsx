import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Svg, { Path } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { format, addMonths, subMonths } from 'date-fns';

import { Text, Button, BottomSheet, DatePickerField, Calendar, DayDetailSheet, Skeleton } from 'src/components/ui';
import { useTheme } from 'src/theme';
import {
  useCycleCalendar,
  useCycleEntries,
  useLogCorrection,
  useCreateMoodLog,
  useCreateJournalEntry,
  useUpdateCycleEntry,
} from 'src/services/queries';
import { computeCycleDay, computePhaseRanges, PHASE_META, toLocalDateStr } from 'src/utils';
import { LinearGradient } from 'expo-linear-gradient';
import { useEndDateStore } from 'src/stores/endDateStore';
import { cancelEndDateNotification } from 'src/services/endDateNotifications';
import type { PhaseRange } from 'src/utils/cyclePhases';

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

function getPhaseForDate(encodedDay: string | undefined): { emoji: string; label: string; color: string; description: string } {
  if (!encodedDay) return { emoji: '🌸', label: 'Unknown', color: '#f0f0f0', description: '' };
  const phaseMatch = encodedDay.toUpperCase();
  if (phaseMatch === 'P') return { emoji: '🩸', label: 'Period', color: '#F48FB1', description: 'Rest and recharge' };
  if (phaseMatch === 'FL') return { emoji: '🌱', label: 'Follicular', color: '#FFDAB9', description: 'Rising energy' };
  if (phaseMatch === 'F') return { emoji: '💮', label: 'Fertile', color: '#CE93D8', description: 'Conception window' };
  if (phaseMatch === 'O') return { emoji: '🌟', label: 'Ovulation', color: '#81C784', description: 'Peak vitality' };
  if (phaseMatch === 'L') return { emoji: '🌙', label: 'Luteal', color: '#90CAF9', description: 'Slow down' };
  return { emoji: '🌸', label: 'Transition', color: '#E8E8E8', description: '' };
}

function getPhaseAccent(encodedDay: string | undefined): string {
  if (!encodedDay) return '#f0f0f0';
  const map: Record<string, string> = {
    P: '#F48FB1', p: '#F48FB1', u: '#F48FB1', pw: '#B83058',
    Fl: '#FFDAB9', fl: '#FFDAB9',
    F: '#CE93D8', f: '#CE93D8',
    O: '#81C784', o: '#81C784',
    L: '#90CAF9', l: '#90CAF9',
  };
  return map[encodedDay] ?? '#f0f0f0';
}

export function CalendarScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [activePhaseFilter, setActivePhaseFilter] = useState<string | null>(null);

  const [showDaySheet, setShowDaySheet] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodIntensity, setMoodIntensity] = useState(5);

  const [noteText, setNoteText] = useState('');

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  const { control, handleSubmit, reset } = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { overrideDate: toDateStr(new Date()) },
  });

  const { data: calData, isLoading } = useCycleCalendar(3, 3);
  const { data: cycleEntries = [] } = useCycleEntries({ months_back: 6 });
  const logCorrection = useLogCorrection();
  const createMoodLog = useCreateMoodLog();
  const createJournal = useCreateJournalEntry();
  const updateCycleEntry = useUpdateCycleEntry();
  const encodedDays = useMemo(() => calData?.days ?? {}, [calData]);
  const prediction = calData?.predictions ?? null;
  const endDateStore = useEndDateStore();

  const today = useMemo(() => new Date(), []);
  const cycleDay = computeCycleDay(calData?.days, today);
  const todaysEncoded = encodedDays[format(today, 'yyyy-MM-dd')];
  const currentPhase = getPhaseForDate(todaysEncoded);

  const selectedStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedEncoded = encodedDays[selectedStr] ?? '';
  const selectedPhase = getPhaseForDate(selectedEncoded);

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
    setSelectedMood(null);
    setMoodIntensity(5);
    setNoteText('');
    setSelectedSymptoms(coveringEntry?.symptoms ?? []);
    setShowDaySheet(true);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedMood(null);
    setMoodIntensity(5);
    setNoteText('');
    setSelectedSymptoms([]); // reset; repopulated on open via coveringEntry
    setShowDaySheet(true);
  };

  const handleSaveMood = () => {
    if (!selectedMood) return;
    createMoodLog.mutate(
      { mood: selectedMood, intensity: moodIntensity },
      {
        onSuccess: () => {
          setSelectedMood(null);
          setMoodIntensity(5);
          Toast.show({ type: 'success', text1: 'Mood logged' });
        },
      },
    );
  };

  const handleSaveNote = () => {
    const content = noteText.trim();
    if (!content) return;
    createJournal.mutate(
      { content, entry_date: selectedStr },
      {
        onSuccess: () => {
          setNoteText('');
          Toast.show({ type: 'success', text1: 'Note saved' });
        },
      },
    );
  };

  const handleSaveSymptoms = () => {
    if (!coveringEntry) return;
    updateCycleEntry.mutate(
      { id: coveringEntry.id, data: { symptoms: selectedSymptoms } },
      {
        onSuccess: () => {
          Toast.show({ type: 'success', text1: 'Symptoms updated' });
        },
      },
    );
  };

  const handleFlagStart = (date: Date) => {
    const dateStr = toDateStr(date);
    if (encodedDays[dateStr] === 'P') {
      Toast.show({ type: 'info', text1: 'Period already logged for this date' });
      return;
    }
    logCorrection.mutate(
      { period_start_date: dateStr, corrected_prediction_id: prediction?.id ?? null },
      {
        onSuccess: () => {
          setShowDaySheet(false);
          setSelectedDate(null);
        },
      },
    );
  };

  const handleFlagEnd = (date: Date) => {
    const openEntry = cycleEntries.find((e) => !e.period_end_date);
    if (!openEntry) {
      Toast.show({ type: 'info', text1: 'No active period to end' });
      return;
    }
    const endStr = toDateStr(date);
    if (endStr <= openEntry.period_start_date) {
      Toast.show({ type: 'error', text1: 'End date must be after start date' });
      return;
    }
    updateCycleEntry.mutate(
      { id: openEntry.id, data: { period_end_date: endStr } },
      {
        onSuccess: () => {
          if (endDateStore.notificationId) {
            cancelEndDateNotification(endDateStore.notificationId);
          }
          endDateStore.clearPending();
          setShowDaySheet(false);
          setSelectedDate(null);
          Toast.show({ type: 'success', text1: 'Period end saved' });
        },
      },
    );
  };

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
                    backgroundColor: isActive ? p.color + '66' : p.color + '22',
                    borderRadius: 100,
                    borderWidth: isActive ? 1.5 : 0,
                    borderColor: p.color,
                  },
                ]}
              >
                <Text style={{ fontSize: 14 }}>{p.emoji}</Text>
                <Text style={[styles.phasePillLabel, { color: p.color }]}>{p.label}</Text>
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
          phaseAccentForDate={getPhaseAccent}
          dimmedDates={dimmedDates}
          showHeader={false}
          isLoading={isLoading}
        />

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
              const badge =
                range.startDay === null
                  ? 'Upcoming'
                  : range.startDay === range.endDay
                    ? `Day ${range.startDay}`
                    : `Day ${range.startDay}–${range.endDay}`;
              return (
                <View
                  key={range.key}
                  style={[styles.phaseOverviewCard, { backgroundColor: meta.bg + '66', borderRadius: 16 }]}
                >
                  <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text variant="body" style={{ fontWeight: '600' }}>{meta.label}</Text>
                      <View style={[styles.dateBadge, { backgroundColor: meta.fg + '22', borderRadius: 100 }]}>
                        <Text style={{ color: meta.fg, fontSize: 10, fontWeight: '600' }}>{badge}</Text>
                      </View>
                    </View>
                    <Text variant="caption" color="muted" style={{ marginTop: 2 }}>{meta.desc}</Text>
                  </View>
                </View>
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
            coveringEntry={coveringEntry}
            onClose={() => setShowDaySheet(false)}
            onFlagStart={handleFlagStart}
            onFlagEnd={handleFlagEnd}
            symptoms={selectedSymptoms}
            onToggleSymptom={(s) =>
              setSelectedSymptoms((prev) =>
                prev.includes(s) ? prev.filter((i) => i !== s) : [...prev, s],
              )}
            onSaveSymptoms={handleSaveSymptoms}
            symptomsLoading={updateCycleEntry.isPending}
            mood={selectedMood}
            onSelectMood={setSelectedMood}
            onSaveMood={handleSaveMood}
            moodLoading={createMoodLog.isPending}
            noteText={noteText}
            onChangeNote={setNoteText}
            onSaveNote={handleSaveNote}
            noteLoading={createJournal.isPending}
          />
        )}
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
