export type LunaAnimation = 'idle' | 'walk-right' | 'walk-left' | 'bounce';
export type LunaScreen = 'home' | 'calendar' | 'journal' | 'sos' | 'wellness' | 'chat' | 'settings' | 'onboarding';

export interface LunaContext {
  animation: LunaAnimation;
  message: string;
  actionLabel?: string;
}

export interface LunaContextOpts {
  lunaEnabled: boolean;
  pregnancyMode: boolean;
  currentPhase?: string;
  selectedDate?: number | null;
  selectedPhase?: string | null;
  mood?: string | null;
  energy?: number;
  wellnessTab?: string;
  week?: number;
  trimester?: number;
  babySize?: string;
}

export function getLunaContext(
  screen: LunaScreen,
  opts: LunaContextOpts,
): LunaContext {
  if (!opts.lunaEnabled) {
    return { animation: 'idle', message: '' };
  }

  switch (screen) {
    case 'home':
      if (opts.pregnancyMode && opts.week !== undefined) {
        return {
          animation: 'bounce',
          message: `Baby is ${opts.babySize ?? 'growing'} this week! You're in trimester ${opts.trimester ?? 1} \u{1F476}`,
          actionLabel: 'View milestones',
        };
      }
      return {
        animation: 'idle',
        message: opts.currentPhase
          ? `You're in the ${opts.currentPhase} phase \u{1F33C}`
          : 'Track your cycle to see phase insights \u{1F338}',
      };
    case 'calendar':
      return {
        animation: 'idle',
        message: opts.selectedDate
          ? opts.selectedPhase
            ? `${formatDate(opts.selectedDate)} — ${opts.selectedPhase} phase`
            : `Selected ${formatDate(opts.selectedDate)}`
          : 'Log your period to get predictions \u{1F4C5}',
      };
    case 'journal':
      return {
        animation: 'walk-left',
        message: opts.mood
          ? `Feeling ${opts.mood}${opts.energy ? ` with ${opts.energy}% energy` : ''} \u{1F4DD}`
          : 'How was your day? Write a journal entry \u{2728}',
      };
    case 'wellness':
      return {
        animation: 'bounce',
        message: opts.wellnessTab === 'breathing'
          ? 'Take a deep breath with me \u{1F9D8}\u{200D}\u{2640}\u{FE0F}'
          : opts.wellnessTab === 'water'
            ? 'Stay hydrated! \u{1F4A7}'
            : 'Your wellness journey matters \u{1F33F}',
      };
    case 'chat':
      return {
        animation: 'idle',
        message: 'Ask about cramps, sleep, or nutrition \u{1F338}',
      };
    case 'sos':
      return {
        animation: 'bounce',
        message: 'Emergency contacts ready \u{1F6E1}\u{FE0F}',
      };
    case 'settings':
      return {
        animation: 'idle',
        message: `Luna insights ${opts.lunaEnabled ? 'on' : 'off'} \u{B7} Pregnancy mode ${opts.pregnancyMode ? 'on' : 'off'} \u{1F4A1}`,
      };
    case 'onboarding':
      return {
        animation: 'walk-right',
        message: 'Complete setup to unlock insights \u{2728}',
      };
    default:
      return { animation: 'idle', message: '' };
  }
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
