/**
 * PredictionDetailCard — Glassmorphism card per UI_UX Prediction_Screen spec.
 * Circular confidence, timeline, next events, AI insight.
 */

import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Circle as SvgCircle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from 'src/theme';
import { Card } from './Card';
import { Text } from './Text';
import type { PredictionDetail } from 'src/services/api/cycle';

interface Props {
  prediction: PredictionDetail;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

function CircularConfidence({ score }: { score: number }) {
  const theme = useTheme();
  const size = 72;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.round((score ?? 0.86) * 100);
  const progress = circumference * (1 - pct / 100);
  const color = pct >= 80 ? theme.colors.success : pct >= 60 ? theme.colors.warning : theme.colors.danger;

  return (
    <View style={styles.circularWrap}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="confGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={theme.colors.primary} stopOpacity="1" />
            <Stop offset="100%" stopColor={theme.colors.accent} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <SvgCircle cx={size / 2} cy={size / 2} r={radius} stroke={theme.colors.border} strokeWidth={strokeWidth} fill="none" />
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#confGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <SvgCircle cx={size / 2} cy={size / 2} r={radius - 2} fill="rgba(255,255,255,0.05)" />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <Text variant="h2" color="primary" align="center" style={{ marginTop: 22 }}>{pct}%</Text>
      </View>
    </View>
  );
}

function TimelineBar({ phase }: { phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | string }) {
  const theme = useTheme();
  const colors = { menstrual: '#FF5252', follicular: '#FFD54F', ovulation: '#4CAF50', luteal: '#42A5F5' };
  const phases = ['menstrual', 'follicular', 'ovulation', 'luteal'];
  const activeIdx = phases.indexOf(phase as any);
  const segW = (CARD_WIDTH - 48) / 4;

  return (
    <View style={styles.timelineRow}>
      {phases.map((p, i) => (
        <View key={p} style={{ alignItems: 'center' }}>
          <View style={[styles.timelineSeg, { backgroundColor: i <= activeIdx ? (colors as any)[p] : theme.colors.border, width: segW - 4, height: 6, borderRadius: 3 }]} />
          <Text variant="caption" color={i <= activeIdx ? 'primary' : 'muted'} style={{ marginTop: 4, fontSize: 9 }}>
            {p === 'menstrual' ? 'D1' : p === 'follicular' ? 'D6' : p === 'ovulation' ? 'D14' : 'D17'}
          </Text>
        </View>
      ))}
      {activeIdx >= 0 && activeIdx < phases.length && (
        <View style={[styles.timelineMarker, { backgroundColor: (colors as any)[phases[activeIdx]], left: activeIdx * segW + segW / 2 - 8, top: -4 }]} />
      )}
    </View>
  );
}

export function PredictionDetailCard({ prediction }: Props) {
  const theme = useTheme();
  const nextStart = new Date(prediction.predicted_next_period_start);
  const score = prediction.confidence_score ?? 0.86;

  return (
    <Card style={[styles.card, { backgroundColor: 'rgba(255, 255, 255, 0.7)', borderColor: 'rgba(255, 255, 255, 0.3)', borderRadius: theme.radius.xl }]}>
      {/* Glassmorphism header */}
      <View style={styles.header}>
        <CircularConfidence score={score} />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text variant="h3">Next Period</Text>
          <Text variant="h2" color="primary">{nextStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</Text>
          {prediction.predicted_period_end && (
            <Text variant="bodySmall" color="secondary">
              through {new Date(prediction.predicted_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          )}
        </View>
      </View>

      {/* Phase timeline */}
      <View style={[styles.phaseRow, { marginTop: theme.spacing.lg }]}>
        <Text variant="bodySmall" color="muted">Cycle Timeline</Text>
        <TimelineBar phase="luteal" />
      </View>

      {/* Data quality */}
      <View style={[styles.qualityRow, { backgroundColor: theme.colors.success + '20', borderRadius: theme.radius.md, marginTop: theme.spacing.md }]}>
        <Text variant="bodySmall" style={{ color: theme.colors.success, fontWeight: '600' }}>
          Data Quality: {['Insufficient', 'Minimal', 'Good', 'Great', 'Excellent'][Math.min(Math.floor((prediction.training_data_points ?? 4) / 2), 4)]}
        </Text>
        <Text variant="caption" color="muted">Based on {prediction.training_data_points ?? 4} cycles</Text>
      </View>

      {/* Prediction window */}
      {prediction.prediction_window_days != null && (
        <Text variant="bodySmall" color="secondary" style={{ marginTop: 8 }}>
          Window: ±{prediction.prediction_window_days} days
        </Text>
      )}

      {/* AI Insight */}
      <View style={[styles.insightRow, { backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.md, marginTop: theme.spacing.md }]}>
        <Text variant="caption" style={{ color: theme.colors.accent, fontWeight: '600' }}>🤖 AI Insight</Text>
        <Text variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>
          Your cycle has been consistent. Predictions will improve as you log more data.
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  circularWrap: { width: 72, height: 72, justifyContent: 'center', alignItems: 'center' },
  phaseRow: {},
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', position: 'relative', marginTop: 8 },
  timelineSeg: { height: 6 },
  timelineMarker: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: '#fff' },
  qualityRow: { paddingVertical: 8, paddingHorizontal: 12 },
  insightRow: { paddingVertical: 10, paddingHorizontal: 12 },
});
