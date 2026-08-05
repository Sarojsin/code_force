import React, { useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { safeStep, buildAreaPath, buildSmoothPath } from 'src/utils/svg';
import type { MoodLog } from 'src/services/api';

export const MOOD_EMOJI_MAP: Record<string, string> = {
  Happy: '😊',
  Calm: '😌',
  Sad: '😢',
  Angry: '😠',
  Anxious: '😰',
  Tired: '😴',
  Loved: '🥰',
  Motivated: '💪',
  Radiant: '✨',
  Neutral: '😐',
};

interface MoodAreaChartProps {
  moodLogs: MoodLog[];
  phaseColor: string;
  phaseBg: string;
  onPointPress?: (log: MoodLog) => void;
  onEmptyStatePress?: () => void;
}

const CHART_WIDTH = 280;
const CHART_HEIGHT = 140;
const PADDING = { top: 20, bottom: 30, left: 10, right: 10 };
const MAX_INTENSITY = 10;
const MIN_POINTS_FOR_CHART = 2;

export function MoodAreaChart({ moodLogs, phaseColor, phaseBg, onPointPress, onEmptyStatePress }: MoodAreaChartProps) {
  const theme = useTheme();

  const last7 = useMemo(() => {
    return moodLogs.slice(-7).sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
  }, [moodLogs]);

  const isEmpty = last7.length === 0;
  const hasEnoughData = last7.length >= MIN_POINTS_FOR_CHART;

  if (isEmpty) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: `${phaseBg}22`, borderRadius: theme.radius.xl }]}>
        <Txt variant="emoji" style={styles.emojiLarge}>📊</Txt>
        <Txt variant="body" color="secondary" style={styles.centerText}>
          Mood data is building.
        </Txt>
        <Txt variant="caption" color="muted" style={styles.centerMuted}>
          Check back in a few days to see your pattern.
        </Txt>
        {onEmptyStatePress && (
          <Pressable
            onPress={onEmptyStatePress}
            style={[styles.emptyBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill }]}
          >
            <Txt variant="caption" style={styles.emptyBtnText}>Log your first mood</Txt>
          </Pressable>
        )}
      </View>
    );
  }

  if (!hasEnoughData) {
    const entry = last7[0];
    const emoji = MOOD_EMOJI_MAP[entry.mood] ?? '😊';
    return (
      <View style={[styles.emptyContainer, { backgroundColor: `${phaseBg}22`, borderRadius: theme.radius.xl }]}>
        <Txt variant="emoji" style={styles.emojiLarge}>{emoji}</Txt>
        <Txt variant="body" color="secondary" style={styles.centerText}>
          Mood data is building.
        </Txt>
        <Txt variant="caption" color="muted" style={styles.centerMuted}>
          Log your mood daily for the best insights.
        </Txt>
        {onEmptyStatePress && (
          <Pressable
            onPress={onEmptyStatePress}
            style={[styles.emptyBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill }]}
          >
            <Txt variant="caption" style={styles.emptyBtnText}>Log your first mood</Txt>
          </Pressable>
        )}
      </View>
    );
  }

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const stepX = safeStep(plotW, last7.length);

  const points = last7.map((entry, i) => {
    const x = PADDING.left + i * stepX;
    const intensity = Number.isFinite(entry.intensity) ? entry.intensity : 5;
    const y = PADDING.top + plotH - (intensity / MAX_INTENSITY) * plotH;
    return { x, y, entry, intensity };
  });

  const smoothPath = buildSmoothPath(points);
  const areaPath = buildAreaPath(
    smoothPath,
    points[points.length - 1].x,
    points[0].x,
    CHART_HEIGHT - 10,
  );

  const today = new Date();
  const todayStr = today.toDateString();

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <SvgGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={phaseColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={phaseColor} stopOpacity="0.02" />
          </SvgGradient>
        </Defs>
        <Path d={areaPath} fill="url(#moodGradient)" />
        <Path
          d={smoothPath}
          fill="none"
          stroke={phaseColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          const isToday = new Date(p.entry.logged_at).toDateString() === todayStr;
          return (
            <React.Fragment key={i}>
              <Circle
                cx={p.x}
                cy={p.y}
                r={isToday ? 5 : 3.5}
                fill={theme.colors.surface}
                stroke={phaseColor}
                strokeWidth={isToday ? 2.5 : 1.5}
              />
              <SvgText
                x={p.x}
                y={p.y - 12}
                textAnchor="middle"
                fontSize={14}
              >
                {MOOD_EMOJI_MAP[p.entry.mood] ?? '😊'}
              </SvgText>
              {onPointPress && (
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={20}
                  fill="transparent"
                  stroke="transparent"
                  onPress={() => onPointPress(p.entry)}
                />
              )}
            </React.Fragment>
          );
        })}
        {[0, 2.5, 5, 7.5, 10].map((val) => (
          <Path
            key={val}
            d={`M${PADDING.left} ${PADDING.top + plotH - (val / MAX_INTENSITY) * plotH} H${PADDING.left + plotW}`}
            stroke={theme.colors.border}
            strokeWidth={0.5}
            strokeOpacity={0.3}
            strokeDasharray="4 4"
          />
        ))}
      </Svg>

      <View style={styles.dayLabels}>
        {last7.map((entry, i) => {
          const date = new Date(entry.logged_at);
          const isToday = date.toDateString() === todayStr;
          return (
            <Txt
              key={i}
              variant="caption"
              // eslint-disable-next-line react-native/no-inline-styles
              style={{ fontSize: 9, fontWeight: isToday ? '700' : '500', color: isToday ? theme.colors.primary : theme.colors.textMuted }}
            >
              {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}
            </Txt>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
    minHeight: 140,
    justifyContent: 'center',
  },
  emojiLarge: {
    fontSize: 36,
  },
  centerText: {
    marginTop: 8,
    textAlign: 'center',
  },
  centerMuted: {
    marginTop: 4,
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  dayLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 260,
    marginTop: 4,
  },
});
