import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

interface ReadinessScoreCardProps {
  score: number | null;
  breakdown: { sleep: number; mood: number; water: number; activity: number } | null;
}

export function ReadinessScoreCard({ score, breakdown }: ReadinessScoreCardProps) {
  const theme = useTheme();
  const radius = 52;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;

  if (score === null) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.cardLg }]}>
        <Txt variant="h3" color="secondary" align="center">No data yet</Txt>
        <Txt variant="caption" color="muted" style={styles.noDataText}>
          Log your day in the Cycle tab to see your readiness score.
        </Txt>
      </View>
    );
  }

  const progress = score / 100;
  const strokeDashoffset = circumference * (1 - progress);
  const scoreColor = score >= 70 ? theme.colors.mint : score >= 40 ? theme.colors.accent : theme.colors.danger;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.cardLg }]}>
      <Svg width={160} height={160}>
        <Defs>
          <LinearGradient id="readinessGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={scoreColor} stopOpacity="0.8" />
            <Stop offset="100%" stopColor={scoreColor} stopOpacity="0.2" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={80} cy={80} r={radius}
          fill="none"
          stroke={theme.colors.border}
          strokeWidth={strokeWidth}
          strokeOpacity={0.2}
        />
        <Circle
          cx={80} cy={80} r={radius}
          fill="none"
          stroke="url(#readinessGrad)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
        />
        <SvgText
          x={80} y={85}
          textAnchor="middle"
          fontSize={32}
          fontWeight="700"
          fill={scoreColor}
        >
          {score}
        </SvgText>
        <SvgText
          x={80} y={105}
          textAnchor="middle"
          fontSize={11}
          fill={theme.colors.textMuted}
        >
          Readiness
        </SvgText>
      </Svg>

      {breakdown && (
        <View style={styles.breakdown}>
          <MetricDot label="Sleep" value={breakdown.sleep} color={theme.colors.accent} />
          <MetricDot label="Mood" value={breakdown.mood} color={theme.colors.primary} />
          <MetricDot label="Water" value={breakdown.water} color={theme.colors.mint} />
          <MetricDot label="Activity" value={breakdown.activity} color={theme.colors.roseQuartz} />
        </View>
      )}
    </View>
  );
}

function MetricDot({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.metricDot}>
    <View style={[styles.metricDot, styles.dot, { backgroundColor: color }]}>
      <Txt variant="caption" style={styles.metricDotText}>{value}</Txt>
    </View>
      <Txt variant="caption" color="muted" style={styles.metricLabel}>{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    padding: 24,
    minHeight: 200,
  },
  breakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  metricDot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricDotText: {
    color: '#fff',
    fontWeight: '700',
  },
  metricLabel: {
    marginLeft: 4,
  },
  noDataText: {
    marginTop: 4,
  },
});
