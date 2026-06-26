export interface PastCycle {
  cycle_start: string;
  cycle_length: number;
  period_length: number;
  symptoms: string[];
}

export interface OnboardingData {
  age: number;
  height_cm: number;
  weight_kg: number;
  stress_level: 'low' | 'moderate' | 'high';
  exercise_frequency: 'low' | 'moderate' | 'high';
  sleep_hours: number;
  diet: 'balanced' | 'normal' | 'junk';
  current_cycle_start: string;
  current_cycle_length: number;
  current_period_length: number;
  current_symptoms: string[];
  past_cycles: PastCycle[];
}

export interface OnboardingResponse extends OnboardingData {
  id: string;
  user_id: string;
  onboarding_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingStatusResponse {
  completed: boolean;
}

/* Zustand store shape */
export interface OnboardingState {
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  stressLevel: 'low' | 'moderate' | 'high' | null;
  exerciseFrequency: 'low' | 'moderate' | 'high' | null;
  sleepHours: number | null;
  diet: 'balanced' | 'normal' | 'junk' | null;
  currentCycleStart: string | null;
  currentCycleLength: number | null;
  currentPeriodLength: number | null;
  currentSymptoms: string[];
  pastCycles: PastCycle[];
  isSubmitting: boolean;
  isCompleted: boolean;
}

export interface OnboardingActions {
  setPersonalInfo: (data: { age: number; heightCm: number; weightKg: number }) => void;
  setLifestyle: (data: {
    stressLevel: 'low' | 'moderate' | 'high';
    exerciseFrequency: 'low' | 'moderate' | 'high';
    sleepHours: number;
    diet: 'balanced' | 'normal' | 'junk';
  }) => void;
  setCurrentCycle: (data: {
    currentCycleStart: string;
    currentCycleLength: number;
    currentPeriodLength: number;
    currentSymptoms: string[];
  }) => void;
  addPastCycle: (data: PastCycle) => void;
  reset: () => void;
  setSubmitting: (v: boolean) => void;
  setCompleted: (v: boolean) => void;
}