import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'src/theme';
import { Card } from './Card';
import { Text } from './Text';
import type { PredictionDetail } from 'src/services/api/cycle';

interface Props {
  prediction: PredictionDetail;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  'Very uncertain': '#E53935',
  Uncertain: '#FB8C00',
  Fair: '#FDD835',
  Good: '#43A047',
  Excellent: '#1B5E20',
};

export function PredictionDetailCard({ prediction }: Props) {
  const theme = useTheme();
  const label = prediction.confidence_label || 'Unknown';
  const color = CONFIDENCE_COLORS[label] || theme.colors.textMuted;
  const nextStart = new Date(prediction.predicted_next_period_start);

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl }]}>
      <Text variant="h3">Next period: {nextStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</Text>

      {prediction.predicted_period_end && (
        <Text variant="body" color="secondary" style={{ marginTop: 4 }}>
          through{' '}
          {new Date(prediction.predicted_period_end).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      )}

      <View style={[styles.confidenceRow, { backgroundColor: color + '20', borderRadius: theme.radius.md, marginTop: theme.spacing.md }]}>
        <Text variant="bodySmall" style={{ color, fontWeight: '600' }}>
          Confidence: {label}
        </Text>
        {prediction.confidence_score != null && (
          <Text variant="bodySmall" color="muted">
            ({Math.round(prediction.confidence_score * 100)}%)
          </Text>
        )}
      </View>

      <View style={styles.meta}>
        <Text variant="caption" color="muted">
          Model: {prediction.model_type.replace('_', ' ')}
        </Text>
        <Text variant="caption" color="muted">
          Based on {prediction.training_data_points} cycles
        </Text>
      </View>

      {prediction.prediction_window_days != null && (
        <Text variant="bodySmall" color="secondary" style={{ marginTop: 8 }}>
          Your period may start between{' '}
          {new Date(nextStart.getTime() - prediction.prediction_window_days * 86400000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}{' '}
          and{' '}
          {new Date(nextStart.getTime() + prediction.prediction_window_days * 86400000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, gap: 6 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
});
