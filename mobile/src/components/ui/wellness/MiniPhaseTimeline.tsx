import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import type { CurrentCycleState } from 'src/hooks/useCurrentCycleState';
import type { PredictionListResponse } from 'src/services/api/cycle';

interface MiniPhaseTimelineProps {
  cycleState: CurrentCycleState;
  predictions: PredictionListResponse | undefined;
}

interface PhaseSegment {
  key: string;
  emoji: string;
  label: string;
  bg: string;
  fg: string;
  isToday: boolean;
  isUpcoming: boolean;
}

const PHASE_ORDER = ['menstrual', 'follicular', 'fertile', 'ovulation', 'luteal'];
const PHASE_EMOJIS: Record<string, string> = {
  menstrual: '🩸',
  follicular: '🌱',
  fertile: '🌱',
  ovulation: '🌟',
  luteal: '🌙',
};

export function MiniPhaseTimeline({ cycleState, predictions }: MiniPhaseTimelineProps) {
  const theme = useTheme();

  const segments: PhaseSegment[] = React.useMemo(() => {
    if (!cycleState.hasCycleData) {
      return [{
        key: 'no-data',
        emoji: '🌙',
        label: 'Track your cycle',
        bg: theme.colors.surface,
        fg: theme.colors.textMuted,
        isToday: true,
        isUpcoming: false,
      }];
    }

    const all: PhaseSegment[] = [];
    let foundCurrent = false;

    PHASE_ORDER.forEach((key, idx) => {
      const isCurrent = key === cycleState.phaseKey;
      const isAfterCurrent = idx > PHASE_ORDER.indexOf(cycleState.phaseKey ?? '');

      all.push({
        key,
        emoji: PHASE_EMOJIS[key] ?? '○',
        label: key.charAt(0).toUpperCase() + key.slice(1),
        bg: theme.colors.surface,
        fg: theme.colors.textSecondary,
        isToday: isCurrent,
        isUpcoming: isAfterCurrent,
      });
      if (isCurrent) foundCurrent = true;
    });

    // Add "Period" at the end if prediction exists
    if (predictions?.prediction && !foundCurrent) {
      all.push({
        key: 'next-period',
        emoji: '🩸',
        label: 'Period',
        bg: theme.colors.surface,
        fg: theme.colors.textSecondary,
        isToday: false,
        isUpcoming: true,
      });
    }

    return all;
  }, [cycleState, predictions, theme]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {segments.map((segment, idx) => (
        <React.Fragment key={segment.key}>
          <PhasePill segment={segment} theme={theme} isLast={idx === segments.length - 1} />
          {idx < segments.length - 1 && (
            <View style={[styles.arrow, { backgroundColor: theme.colors.textMuted }]}>
              <Txt style={styles.arrowText}>›</Txt>
            </View>
          )}
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

function PhasePill({
  segment,
  theme,
  isLast,
}: {
  segment: PhaseSegment;
  theme: any;
  isLast: boolean;
}) {
  const isHighlighted = segment.isToday;

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: segment.bg,
          borderColor: isHighlighted ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radius.pill,
        },
        !isLast && styles.pillSpacing,
      ]}
    >
      <Txt variant="emoji" style={[styles.pillEmoji, isHighlighted && styles.pillEmojiActive]}>{segment.emoji}</Txt>
      <Txt
        variant="caption"
        style={[
          styles.pillLabel,
          { color: isHighlighted ? theme.colors.primary : segment.fg },
          isHighlighted && styles.pillLabelActive,
        ]}
      >
        {segment.label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillEmoji: {
    fontSize: 14,
  },
  pillEmojiActive: {
    fontSize: 16,
  },
  pillLabel: {
    marginLeft: 6,
    fontSize: 10,
    fontWeight: '500',
  },
  pillLabelActive: {
    fontWeight: '700',
  },
  pillSpacing: {
    marginRight: 4,
  },
  arrow: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 10,
  },
});
