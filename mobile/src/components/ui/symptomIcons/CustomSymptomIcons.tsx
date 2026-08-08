import React from 'react';
import Svg, { Path, Circle, Ellipse, G } from 'react-native-svg';
/**
 * Custom 24×24 (viewBox) symptom glyphs — friendly, round, on-tone vectors per
 * DayDetailSheet plan §5.1. Only the ~10 "hero" symptoms get bespoke shapes;
 * everything else resolves via `SymptomIcon` → Lucide → emoji fallback.
 * Glyphs are decorative: `accessible={false}` handled by the dispatcher.
 */

export type CustomSvgProps = {
  size: number;
  color: string;
};

export const CUSTOM_ICON_BY_NAME: Record<string, React.FC<CustomSvgProps>> = {
  'Abdominal Cramps': CrampsFlare,
  'Lower Back Pain': LowerBackPainCurve,
  'Breast Tenderness': BreastTendernessIcon,
  Headache: HeadacheHaloIcon,
  Migraine: MigraineHaloIcon,
  Bloating: BloatingCrescentIcon,
  Nausea: NauseaWaveIcon,
  Fatigue: FatigueMoonIcon,
  Dizziness: DizzinessSpiralIcon,
  'Hot Flashes': HotFlashSunIcon,
};

/** Cramps / lower-abdominal flare — radiating heat above the pubic line. */
function CrampsFlare({ size, color }: CustomSvgProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G fill={color}>
        <Path d="M8 3h1.6m2.4 0h1.6m2.4 0h1.6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </G>
      <Path
        d="M12 4c1.7 2.1 2.5 4.4 2.5 6.6 0 1.7-.5 3.1-1.4 4.3a3 3 0 0 1-.5.6h-1.2a3 3 0 0 1-.5-.6c-.9-1.2-1.4-2.6-1.4-4.3 0-2.2.8-4.5 2.5-6.6Z"
        fill={color}
        opacity={0.9}
      />
      <Path
        d="M7.6 14.6c1.5 1.1 3 1.6 4.4 1.6 1.4 0 2.9-.5 4.4-1.6M9.2 17.2c.9 1 1.8 1.5 2.8 1.5s1.9-.5 2.8-1.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Lower-back pain — a curve hugging the lumbar spine. */
function LowerBackPainCurve({ size, color }: CustomSvgProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6.5c5.5-.8 10 .4 16 2.5M5.5 11c4.5-.6 8.5.4 12.5 1.4M7 14.8c3.6-.6 6.6 0 9 1.2M8.4 18c2 .2 3.9.1 5.4-.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path d="M4.5 3.5h2m2 0h2m2 0h2" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Breast tenderness — paired soft marks. */
function BreastTendernessIcon({ color }: CustomSvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Ellipse cx="8.5" cy="12.5" rx="4" ry="6" fill={color} opacity={0.35} />
      <Ellipse cx="15.5" cy="12.5" rx="4" ry="6" fill={color} opacity={0.35} />
      <Path d="M12 8.5c-.5-.8-1.2-1.2-1.2-1.2s-.7.4-.8 1.2" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Headache halo — head with a pulsing ring. */
function HeadacheHaloIcon({ color }: CustomSvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={1.4} />
      <Path
        d="M12 6.5v1M12 16.5v1M6.5 12h1M16.5 12h1M8.6 8.6l.7.7M14.7 14.7l.7.7M15.4 8.6l-.7.7M9.3 14.7l-.7.7"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Migraine halo — same head with a stronger burst (severity variant). */
function MigraineHaloIcon({ color }: CustomSvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="9" r="7.5" stroke={color} strokeWidth={1.4} />
      <Path d="M12 5.5v1M12 11.5v1" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M8.6 8.6l.7.7M14.7 14.7l.7.7M15.4 8.6l-.7.7M9.3 14.7l-.7.7" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M12 4V2.8M12 21.2V20" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Bloating — a crescent of abdominal distension. */
function BloatingCrescentIcon({ color }: CustomSvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4c4 2.5 6 6 6 9.5 0 2-1 3.8-3.5 4.5-3 .8-7 .3-8.5-1-.8-.8-1-2-.2-3 1.4-1.8 2.6-3.4 3.4-5.2C10 8.2 10.9 6.4 12 4Z"
        fill={color}
        opacity={0.85}
      />
      <Path
        d="M8.5 12.5c-.5 2.2-1.2 4.4 0 6M13.5 11.5c1 1.6 2 3.5 2 5.3"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Nausea wave — a wavy quease. */
function NauseaWaveIcon({ color }: CustomSvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 14c1.6 0 2.6 2.2 4 2.2S13 10 15.5 10s2.5 2 4.5 4"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path d="M4 8c1.2 1.8 3 1.6 4.4.4 1.5-.1 2.5 1.3 3.6 1.3s2.4-.8 3-1.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Fatigue moon — half-moon with drooping lid. */
function FatigueMoonIcon({ color }: CustomSvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M17.5 3.5A9 9 0 1 0 20.5 16a7.2 7.2 0 0 1-3-12.5Z" fill={color} opacity={0.9} />
      <Path d="M7.5 13.5c1c .5 2 .5 3 0M12 12.5c1c .5 2 .5 3 0" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Dizziness spiral — neutral vortex. */
function DizzinessSpiralIcon({ color }: CustomSvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12a1.2 1.2 0 1 1 1.2 1.2M12 12a3.4 3.4 0 1 0 3.4 3.4M12 9.2A6.6 6.6 0 1 1 18.6 12"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Hot flash sun — sun with radiating heat lines. */
function HotFlashSunIcon({ color }: CustomSvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4.5" fill={color} opacity={0.85} />
      <G stroke={color} strokeWidth={1.4} strokeLinecap="round">
        <Path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
      </G>
    </Svg>
  );
}