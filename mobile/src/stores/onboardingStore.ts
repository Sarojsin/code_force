import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { onboardingService } from 'src/services/api/onboarding';
import type {
  OnboardingActions,
  OnboardingState,
  PastCycle,
} from 'src/types/onboarding';

const initialState: OnboardingState = {
  age: null,
  heightCm: null,
  weightKg: null,
  stressLevel: null,
  exerciseFrequency: null,
  sleepHours: null,
  diet: null,
  currentCycleStart: null,
  currentCycleLength: null,
  currentPeriodLength: null,
  currentSymptoms: [],
  pastCycles: [],
  isSubmitting: false,
  isCompleted: false,
};

type Store = OnboardingState & OnboardingActions;

export const useOnboardingStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState,

      setPersonalInfo: ({ age, heightCm, weightKg }) => set({ age, heightCm, weightKg }),

      setLifestyle: ({ stressLevel, exerciseFrequency, sleepHours, diet }) =>
        set({ stressLevel, exerciseFrequency, sleepHours, diet }),

      setCurrentCycle: ({ currentCycleStart, currentCycleLength, currentPeriodLength, currentSymptoms }) =>
        set({ currentCycleStart, currentCycleLength, currentPeriodLength, currentSymptoms }),

      addPastCycle: (data: PastCycle) => {
        const { pastCycles } = get();
        if (pastCycles.length >= 3) return;
        set({ pastCycles: [...pastCycles, data] });
      },

      setSubmitting: (v) => set({ isSubmitting: v }),

      setCompleted: (v) => set({ isCompleted: v }),

      reset: () => set({ ...initialState, isCompleted: get().isCompleted }),
    }),
    {
      name: 'shecare.onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ isCompleted: state.isCompleted }),
    },
  ),
);

export async function submitOnboarding(): Promise<void> {
  const state = useOnboardingStore.getState();
  if (state.isSubmitting) return;

  useOnboardingStore.getState().setSubmitting(true);
  try {
    await onboardingService.upsert({
      age: state.age!,
      height_cm: state.heightCm!,
      weight_kg: state.weightKg!,
      stress_level: state.stressLevel!,
      exercise_frequency: state.exerciseFrequency!,
      sleep_hours: state.sleepHours!,
      diet: state.diet!,
      current_cycle_start: state.currentCycleStart!,
      current_cycle_length: state.currentCycleLength!,
      current_period_length: state.currentPeriodLength!,
      current_symptoms: state.currentSymptoms,
      past_cycles: state.pastCycles.map(p => ({
        cycle_start: p.cycle_start,
        cycle_length: p.cycle_length,
        period_length: p.period_length,
        symptoms: p.symptoms,
      })),
    });
    useOnboardingStore.getState().setCompleted(true);
  } finally {
    useOnboardingStore.getState().setSubmitting(false);
  }
}
