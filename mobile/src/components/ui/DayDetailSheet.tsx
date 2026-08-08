import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'src/theme';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { MoodPicker } from './MoodPicker';
import { Text } from './Text';
import { DayHero } from './dayDetail/DayHero';
import { SelectedSymptomChips } from './dayDetail/SelectedSymptomChips';
import { SymptomAccordion } from './dayDetail/SymptomAccordion';
import { FlowSelector } from './dayDetail/FlowSelector';
import { PainSlider } from './dayDetail/PainSlider';
import { EnergySegmented } from './dayDetail/EnergySegmented';
import { MedicationSection } from './dayDetail/MedicationSection';
import { NotesSection } from './dayDetail/NotesSection';
import { AIInsightCard } from './dayDetail/AIInsightCard';
import { RecommendationCarousel } from './dayDetail/RecommendationCarousel';
import { SleepWheelPicker } from './dayDetail/SleepWheelPicker';
import { WaterChips } from './dayDetail/WaterChips';

import { useSymptoms, useMedications, useUpsertDay } from 'src/services/queries/cycle';
import { toLocalDateStr } from 'src/utils/date';
import { computeCycleDay, derivePhaseForDate } from 'src/utils/cyclePhases';
import { getDayInsight } from 'src/utils/dayInsights';
import { getRecommendations } from 'src/utils/expertRecommendations';
import { logger } from 'src/utils/logger';
import type { DayPhase } from 'src/utils/cyclePhases';
import type { DailyDay } from 'src/services/api';

export interface DayDetailSheetProps {
  visible: boolean;
  date: Date;
  phase: DayPhase;
  encodedDays: Record<string, string>;
  coveringEntry: { period_start_date: string; period_end_date?: string | null } | null;
  initialDayData?: DailyDay | null;
  onClose: () => void;
  onDone: () => void;
}

export interface DayObservation {
  mood: string | null;
  moodIntensity: number;
  painLevel: number;
  energyLevel: number | null;
  sleepMinutes: number;
  waterGlasses: number;
  flowLevel: string | null;
  symptoms: string[];
  /** Symptom name → severity 1/3/5 (default 3 when selected). */
  symptomSeverities: Record<string, number>;
  medications: string[];
  medicationDoses: Record<string, string>;
  notes: string;
  /** Recommendation ids the user has marked done. */
  recommendationsCompleted: string[];
}

const INITIAL: DayObservation = {
  mood: null,
  moodIntensity: 3,
  painLevel: 0,
  energyLevel: null,
  sleepMinutes: 0,
  waterGlasses: 0,
  flowLevel: null,
  symptoms: [],
  symptomSeverities: {},
  medications: [],
  medicationDoses: {},
  notes: '',
  recommendationsCompleted: [],
};

function buildInitialObs(data: DailyDay | null | undefined, coveringSymptoms: string[] | undefined): DayObservation {
  if (!data) {
    return { ...INITIAL, symptoms: coveringSymptoms ?? [] };
  }
  return {
    mood: data.mood ?? null,
    moodIntensity: data.mood_intensity ?? 3,
    painLevel: data.pain_level ?? 0,
    energyLevel: data.energy_level ?? null,
    sleepMinutes: data.sleep_minutes ?? 0,
    waterGlasses: data.water_glasses ?? 0,
    flowLevel: data.flow_level ?? null,
    symptoms: data.symptoms?.map((s) => s.name) ?? coveringSymptoms ?? [],
    symptomSeverities: Object.fromEntries(
      data.symptoms?.filter((s) => s.severity != null).map((s) => [s.name, s.severity!]) ?? [],
    ),
    medications: data.medications?.map((m) => m.name) ?? [],
    medicationDoses: Object.fromEntries(
      data.medications?.filter((m) => m.dose).map((m) => [m.name, m.dose!]) ?? [],
    ),
    notes: data.notes ?? '',
    recommendationsCompleted: data.recommendations_completed ?? [],
  };
}

function SectionHeader({ icon, title, theme }: { icon: string; title: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.sectionRow}>
      <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.primaryDeep + '18', borderRadius: theme.radius.md }]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <Text variant="body" style={{ fontWeight: '600' }}>{title}</Text>
    </View>
  );
}

export function DayDetailSheet({
  visible,
  date,
  phase,
  encodedDays,
  coveringEntry,
  initialDayData,
  onClose,
  onDone,
}: DayDetailSheetProps) {
  const theme = useTheme();
  const logDateStr = toLocalDateStr(date);

  const phaseKey = useMemo(() => derivePhaseForDate(encodedDays, logDateStr), [encodedDays, logDateStr]);
  const cycleDay = useMemo(() => computeCycleDay(encodedDays, date), [encodedDays, date]);
  const isPeriodDay = phaseKey === 'menstrual';

  const { data: masterSymptoms = [] } = useSymptoms();
  const { data: masterMedications = [] } = useMedications();
  const upsertDay = useUpsertDay();

  const [obs, setObs] = useState<DayObservation>(() =>
    buildInitialObs(initialDayData, coveringEntry && 'symptoms' in coveringEntry ? (coveringEntry as any).symptoms : undefined),
  );
  const [hasInput, setHasInput] = useState(false);

  useEffect(() => {
    if (visible) {
      setObs(buildInitialObs(initialDayData, coveringEntry && 'symptoms' in coveringEntry ? (coveringEntry as any).symptoms : undefined));
      setHasInput(false);
    }
  }, [visible, initialDayData]);

  const update = useCallback((patch: Partial<DayObservation>) => {
    setObs((prev) => {
      const next = { ...prev, ...patch };
      setHasInput(true);
      return next;
    });
  }, []);

  /** Cycle severity on tap: unselected → 3 → 5 → 1 → unselected (plan §6). */
  const toggleSymptom = useCallback((name: string) => {
    setObs((prev) => {
      setHasInput(true);
      if (!prev.symptoms.includes(name)) {
        return {
          ...prev,
          symptoms: [...prev.symptoms, name],
          symptomSeverities: { ...prev.symptomSeverities, [name]: 3 },
        };
      }
      const current = prev.symptomSeverities[name] ?? 3;
      if (current === 5) {
        const severities = { ...prev.symptomSeverities };
        delete severities[name];
        return {
          ...prev,
          symptoms: prev.symptoms.filter((s) => s !== name),
          symptomSeverities: severities,
        };
      }
      const bumped = current === 3 ? 5 : 3;
      return {
        ...prev,
        symptomSeverities: { ...prev.symptomSeverities, [name]: bumped },
      };
    });
  }, []);

  const removeSymptom = useCallback((name: string) => {
    setObs((prev) => {
      const severities = { ...prev.symptomSeverities };
      delete severities[name];
      return {
        ...prev,
        symptoms: prev.symptoms.filter((s) => s !== name),
        symptomSeverities: severities,
      };
    });
  }, []);

  const toggleMedication = useCallback((name: string) => {
    setObs((prev) => {
      const next = prev.medications.includes(name)
        ? prev.medications.filter((m) => m !== name)
        : [...prev.medications, name];
      setHasInput(true);
      return { ...prev, medications: next };
    });
  }, []);

  const handleDoseChange = useCallback((name: string, dose: string) => {
    setObs((prev) => ({ ...prev, medicationDoses: { ...prev.medicationDoses, [name]: dose } }));
  }, []);

  const toggleRecommendation = useCallback((id: string) => {
    setObs((prev) => ({
      ...prev,
      recommendationsCompleted: prev.recommendationsCompleted.includes(id)
        ? prev.recommendationsCompleted.filter((r) => r !== id)
        : [...prev.recommendationsCompleted, id],
    }));
  }, []);

  const recCards = useMemo(
    () => getRecommendations({ phaseKey, painLevel: obs.painLevel, selectedSymptoms: obs.symptoms }),
    [phaseKey, obs.painLevel, obs.symptoms],
  );

  const handleDone = useCallback(() => {
    const safety = getDayInsight(obs, phaseKey);
    if (safety.tier === 'seek_care') {
      // Reserved hook (plan §7): log only, no visual change this PR.
      logger.warn('day_safety.seek_care', {
        painLevel: obs.painLevel,
        phaseKey,
        symptoms: obs.symptoms,
      });
    }
    upsertDay.mutate(
      {
        logDate: logDateStr,
        data: {
          mood: obs.mood ?? undefined,
          mood_intensity: obs.moodIntensity,
          pain_level: obs.painLevel,
          energy_level: obs.energyLevel ?? undefined,
          sleep_minutes: obs.sleepMinutes,
          water_glasses: obs.waterGlasses,
          flow_level: obs.flowLevel ?? undefined,
          notes: obs.notes,
          symptoms: obs.symptoms.map((name) => ({
            symptom: name,
            severity: obs.symptomSeverities[name] ?? 3,
          })),
          medications: obs.medications.map((name) => ({
            name,
            dose: obs.medicationDoses[name] || undefined,
          })),
          recommendations_completed: obs.recommendationsCompleted,
        },
      },
      { onSuccess: () => onDone() },
    );
  }, [obs, logDateStr, phaseKey, upsertDay, onDone]);

  const insight = getDayInsight(obs, phaseKey);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <DayHero
          date={date}
          phase={phase}
          cycleDay={cycleDay > 0 ? cycleDay : undefined}
        />

        {isPeriodDay && (
          <View style={styles.section}>
            <SectionHeader icon="🩸" title="Flow" theme={theme} />
            <FlowSelector
              selected={obs.flowLevel}
              onSelect={(level) => update({ flowLevel: level })}
            />
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader icon="💫" title="How are you feeling?" theme={theme} />
          <MoodPicker
            selected={obs.mood}
            onSelect={(m) => update({ mood: m })}
            variant="circular"
          />
        </View>

        <View style={styles.section}>
          <SectionHeader icon="🌡️" title="Pain" theme={theme} />
          <PainSlider
            value={obs.painLevel}
            onChange={(v) => update({ painLevel: v })}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader icon="⚡" title="Energy" theme={theme} />
          <EnergySegmented
            value={obs.energyLevel}
            onChange={(v) => update({ energyLevel: v })}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader icon="🌙" title="Sleep" theme={theme} />
          <SleepWheelPicker
            totalMinutes={obs.sleepMinutes}
            onChange={(v) => update({ sleepMinutes: v })}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader icon="💧" title="Water" theme={theme} />
          <WaterChips
            value={obs.waterGlasses}
            onChange={(v) => update({ waterGlasses: v })}
          />
        </View>

        {obs.symptoms.length > 0 && (
          <SelectedSymptomChips
            symptoms={obs.symptoms}
            onRemove={removeSymptom}
            onClearAll={() => update({ symptoms: [] })}
          />
        )}

        <View style={styles.section}>
          <SectionHeader icon="🤍" title="Symptoms" theme={theme} />
          <SymptomAccordion
            masterSymptoms={masterSymptoms}
            selected={obs.symptoms}
            severities={obs.symptomSeverities}
            onToggle={toggleSymptom}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader icon="💊" title="Medications" theme={theme} />
          <MedicationSection
            masterMedications={masterMedications}
            selected={obs.medications}
            onToggle={toggleMedication}
            doses={obs.medicationDoses}
            onDoseChange={handleDoseChange}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader icon="📝" title="Notes" theme={theme} />
          <NotesSection
            value={obs.notes}
            onChange={(text) => update({ notes: text })}
          />
        </View>

        {insight.tier === 'recommendation' && recCards.length > 0 ? (
          <RecommendationCarousel
            cards={recCards}
            completed={obs.recommendationsCompleted}
            onToggle={toggleRecommendation}
          />
        ) : (
          <AIInsightCard tier={insight.tier} text={insight.motivation} />
        )}

        <Button
          label="Done"
          onPress={handleDone}
          disabled={!hasInput || upsertDay.isPending}
          loading={upsertDay.isPending}
          fullWidth
          size="lg"
          style={styles.doneBtn}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  section: { gap: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  doneBtn: { marginTop: 4 },
});
