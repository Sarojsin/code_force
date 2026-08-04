export interface PhaseContent {
  key: string;
  emoji: string;
  label: string;
  bg: string;
  fg: string;
  desc: string;
  energyTag: string;
  physicalCue: string;
  action: string;
  hormones: { name: string; level: number }[];
  typicalEnergy: number;
  typicalMood: number;
  nutrition: string[];
  exercise: string[];
  actionableSigns: string[];
  infoSigns: string[];
}

export const PHASE_CONTENT: Record<string, PhaseContent> = {
  menstrual: {
    key: 'menstrual',
    emoji: '🩸',
    label: 'Menstrual',
    bg: '#FFE4EC',
    fg: '#B83058',
    desc: 'Rest & restore. Honour your body.',
    energyTag: '⚡ Low Energy',
    physicalCue: 'Menstrual flow, cramps, lower energy levels.',
    action: 'Prioritize rest and warmth.',
    hormones: [
      { name: 'Estrogen', level: 1 },
      { name: 'Progesterone', level: 1 },
    ],
    typicalEnergy: 1,
    typicalMood: 2,
    nutrition: [
      'Iron-rich foods (spinach, red meat)',
      'Vitamin C for absorption',
      'Stay hydrated',
      'Warm meals',
    ],
    exercise: [
      'Gentle yoga',
      'Light walking',
      'Avoid high intensity',
    ],
    actionableSigns: ['Cramps', 'Headache', 'Fatigue', 'Nausea'],
    infoSigns: ['Menstrual flow (color & intensity)', 'Energy levels'],
  },
  follicular: {
    key: 'follicular',
    emoji: '🌱',
    label: 'Follicular',
    bg: '#FFF4E3',
    fg: '#A0621A',
    desc: 'Rising energy. Fresh beginnings.',
    energyTag: '⚡ Rising Energy',
    physicalCue: 'Cervical mucus becomes wet & stretchy.',
    action: 'Great time for cardio & socializing.',
    hormones: [
      { name: 'Estrogen', level: 4 },
      { name: 'Progesterone', level: 1 },
    ],
    typicalEnergy: 4,
    typicalMood: 5,
    nutrition: [
      'Complex carbs',
      'Leafy greens',
      'Omega-3 fatty acids',
    ],
    exercise: [
      'Cardio',
      'Strength training',
      'Dance',
    ],
    actionableSigns: ['Fatigue'],
    infoSigns: [
      'Cervical mucus (dry/sticky)',
      'Basal body temperature (lower)',
      'Skin clearing up',
      'Increased energy',
    ],
  },
  fertile: {
    key: 'fertile',
    emoji: '💮',
    label: 'Fertile',
    bg: '#F3E5F5',
    fg: '#7B1FA2',
    desc: 'Peak fertility. Conception window.',
    energyTag: '⚡ High Energy',
    physicalCue: 'Egg-white cervical mucus (stretchy, clear), increased libido.',
    action: 'Prioritize connection and communication.',
    hormones: [
      { name: 'Estrogen', level: 5 },
      { name: 'LH', level: 3 },
    ],
    typicalEnergy: 4,
    typicalMood: 5,
    nutrition: [
      'Healthy fats (avocado, nuts)',
      'Lean protein',
    ],
    exercise: [
      'Moderate exercise',
      'Yoga',
      'Walking',
    ],
    actionableSigns: [],
    infoSigns: ['Egg-white cervical mucus', 'Increased libido', 'Mild pelvic ache'],
  },
  ovulation: {
    key: 'ovulation',
    emoji: '🌟',
    label: 'Ovulation',
    bg: '#E5F9F0',
    fg: '#1A6B45',
    desc: 'Peak vitality. Magnetic energy.',
    energyTag: '⚡ Peak Energy',
    physicalCue: 'Light spotting, sharp pelvic pain (Mittelschmerz).',
    action: 'Schedule important meetings. Try new activities.',
    hormones: [
      { name: 'LH', level: 5 },
      { name: 'FSH', level: 5 },
    ],
    typicalEnergy: 5,
    typicalMood: 5,
    nutrition: [
      'Antioxidant-rich berries',
      'Lean protein',
      'Hydrating fruits',
    ],
    exercise: [
      'HIIT',
      'Running',
      'Swimming',
    ],
    actionableSigns: [],
    infoSigns: [
      'Light spotting',
      'Sharp pelvic pain (Mittelschmerz)',
      'BBT spike',
      'Peak energy',
    ],
  },
  luteal: {
    key: 'luteal',
    emoji: '🌙',
    label: 'Luteal',
    bg: '#EFE8FA',
    fg: '#5A35A0',
    desc: 'Wind down. Nurture yourself.',
    energyTag: '⚡ Lower Energy',
    physicalCue: 'Breast tenderness, bloating, mood shifts.',
    action: 'Switch to strength training. Prioritize sleep.',
    hormones: [
      { name: 'Progesterone', level: 5 },
      { name: 'Estrogen', level: 3 },
    ],
    typicalEnergy: 2,
    typicalMood: 2,
    nutrition: [
      'Magnesium-rich foods',
      'Dark chocolate',
      'Herbal teas',
      'Complex carbs',
    ],
    exercise: [
      'Pilates',
      'Stretching',
      'Light yoga',
    ],
    actionableSigns: ['Cramps', 'Bloating', 'Breast tenderness', 'Fatigue'],
    infoSigns: ['Mood shifts', 'Increased appetite', 'BBT stays high'],
  },
};

export const PHASE_KEYS = ['menstrual', 'follicular', 'fertile', 'ovulation', 'luteal'] as const;
