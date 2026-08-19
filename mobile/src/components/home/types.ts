export interface HomeHeaderProps {
  todayStr: string;
  firstName: string;
  onSos: () => void;
  onProfile: () => void;
}

export interface CycleHeroCardProps {
  cycleDay: number | null;
  phaseName: string;
  phaseEmoji: string;
  phaseDesc: string;
  phaseColor: string;
  nextPeriodDays: number | null;
  predictedCycleLength: number | null;
}

export interface CircleProps {
  cycleDay: number | null;
  predictedCycleLength: number | null;
}

export interface EmptyCycleCardProps {
  onLogPeriod: () => void;
}

export interface PhaseTimelineProps {
  phaseKey?: string;
}

export interface BentoGridProps {
  diaryAssetStatus: string;
  onJournal: () => void;
  onDiary: () => void;
  onVideos: () => void;
}