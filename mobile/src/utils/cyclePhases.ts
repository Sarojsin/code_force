export interface PhaseMeta {
  bg: string;
  fg: string;
  accent: string;
  label: string;
  emoji: string;
  desc: string;
}

export const PHASE_META: Record<string, PhaseMeta> = {
  menstrual: {
    bg: '#FFE4EC', fg: '#B83058', accent: '#FF6B8A',
    label: 'Menstrual', emoji: '🩸',
    desc: 'Rest & restore. Honour your body.',
  },
  follicular: {
    bg: '#FFF4E3', fg: '#A0621A', accent: '#F5A623',
    label: 'Follicular', emoji: '🌱',
    desc: 'Rising energy. Fresh beginnings.',
  },
  ovulation: {
    bg: '#E5F9F0', fg: '#1A6B45', accent: '#3CC87A',
    label: 'Ovulation', emoji: '🌟',
    desc: 'Peak vitality. Magnetic energy.',
  },
  luteal: {
    bg: '#EFE8FA', fg: '#5A35A0', accent: '#9B6BD4',
    label: 'Luteal', emoji: '🌙',
    desc: 'Wind down. Nurture yourself.',
  },
};

export function getPhaseMeta(phase: string): PhaseMeta {
  return PHASE_META[phase] ?? PHASE_META.luteal;
}
