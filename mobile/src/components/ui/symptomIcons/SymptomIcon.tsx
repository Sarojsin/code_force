import React from 'react';
import { Text } from 'react-native';
import {
  Flame,
  Lock,
  Waves,
  Utensils,
  Cookie,
  SprayCan,
  Wind,
  BatteryLow,
  Droplets,
  Droplet,
  Snowflake,
  MoonStar,
  BedDouble,
  Bone,
  Scale,
  HeartCrack,
  Footprints,
  BicepsFlexed,
  CornerDownLeft,
  CircleX,
  Scissors,
  Leaf,
  Cloud,
  CloudMoon,
  HeartPulse,
  Eye,
  Target,
  DoorClosed,
  CircleDot,
  Ban,
  MapPin,
  HeartOff,
  CloudLightning,
  CloudRainWind,
  CloudFog,
  Repeat,
  AlertCircle,
  type LucideProps,
} from 'lucide-react-native';

import { useTheme } from 'src/theme';
import { CUSTOM_ICON_BY_NAME } from './CustomSymptomIcons';

/** Lucide token per symptom name (fallback tier, §5.1). */
export const LUCIDE_ICON_BY_NAME: Record<string, React.FC<LucideProps>> = {
  'Upper Stomach Pain': Flame,
  'Leg / Thigh Pain': Footprints,
  'Joint Pain': Bone,
  'Muscle Aches': BicepsFlexed,
  'Painful Sex': HeartCrack,
  Constipation: Lock,
  Diarrhea: Waves,
  Vomiting: CornerDownLeft,
  'Increased Appetite': Utensils,
  'Food Cravings': Cookie,
  'Acne / Pimples': CircleX,
  'Oily Skin': SprayCan,
  'Greasy Hair': Wind,
  'Low Energy': BatteryLow,
  'Increased Discharge': Droplets,
  'Fluid Retention': Droplet,
  'Weight Gain': Scale,
  Chills: Snowflake,
  'Trouble Sleeping': MoonStar,
  'Sleeping Too Much': BedDouble,
  'Hair Thinning / Loss': Scissors,
  'Excess Facial / Body Hair': Leaf,
  'Dry / Itchy Skin': Cloud,
  'Night Sweats': CloudMoon,
  'Heart Palpitations': HeartPulse,
  'Vision Changes': Eye,
  'Difficulty Concentrating': Target,
  'Feeling Overwhelmed': Waves,
  'Social Withdrawal': DoorClosed,
  'Reduced Libido': HeartOff,
  'Severe Depression / Self-Harm': AlertCircle,
  'Irregular Cycles': Repeat,
  'Bleeding / Spotting Between Periods': CircleDot,
  'Absent Period / Amenorrhea': Ban,
  'Painful Ovulation': MapPin,
  'PMS Symptoms': CloudLightning,
  'PMDD (Severe PMS)': CloudRainWind,
  'Brain Fog': CloudFog,
};

/**
 * Dispatcher: custom SVG → Lucide → emoji fallback.
 * Decorative glyphs are `accessible={false}` (theme §2.10); the icon source is
 * the symptom name — used by the symptom master accordion and chips feed.
 */
export function SymptomIcon({
  name,
  size,
  color,
  emoji,
}: {
  name: string;
  size: number;
  color?: string | null;
  emoji?: string | null;
}) {
  const theme = useTheme();
  const tone = color ?? theme.colors.textStrong;
  const CustomGlyph = CUSTOM_ICON_BY_NAME[name];
  if (CustomGlyph) {
    return <CustomGlyph size={size} color={tone} />;
  }
  const Token = LUCIDE_ICON_BY_NAME[name];
  if (Token) {
    return <Token width={size} height={size} color={tone} accessible={false} />;
  }
  return (
    <Text style={{ fontSize: Math.round(size * 0.9) }} accessible={false}>
      {emoji ?? '🌿'}
    </Text>
  );
}
