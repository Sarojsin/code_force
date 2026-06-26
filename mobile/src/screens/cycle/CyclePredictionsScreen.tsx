import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Skeleton, Text } from 'src/components/ui';
import { PredictionDetailCard } from 'src/components/ui/PredictionDetailCard';
import { useTheme } from 'src/theme';
import { useCyclePredictions } from 'src/services/queries/cycle';
import { PredictionDetail } from 'src/services/api/cycle';

const DATA_QUALITY_LABELS: Record<string, { label: string; color: string }> = {
  insufficient: { label: 'Insufficient data — predictions will improve as you log more cycles', color: '#E53935' },
  minimal: { label: 'Minimal data — we need a few more cycles for better accuracy', color: '#FB8C00' },
  good: { label: 'Good data — predictions are becoming more reliable', color: '#43A047' },
  excellent: { label: 'Excellent data — predictions are highly reliable', color: '#1B5E20' },
};

export function CyclePredictionsScreen() {
  const theme = useTheme();
  const { data, isLoading } = useCyclePredictions();

  const predictions = data?.predictions ?? [];
  const dataQuality = data?.data_quality ?? '';

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Skeleton height={160} style={{ marginBottom: 16 }} />
          <Skeleton height={80} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const qualityInfo = DATA_QUALITY_LABELS[dataQuality] || DATA_QUALITY_LABELS.insufficient;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="h1" style={{ paddingHorizontal: 24, marginBottom: 8 }}>
          Predictions
        </Text>

        <View style={[styles.qualityBanner, { backgroundColor: qualityInfo.color + '20', borderLeftColor: qualityInfo.color, borderRadius: theme.radius.md, marginHorizontal: theme.spacing.lg }]}>
          <Text variant="bodySmall" style={{ color: qualityInfo.color }}>
            {qualityInfo.label}
          </Text>
        </View>

        {predictions.map((pred: PredictionDetail) => (
          <View key={pred.id} style={{ marginHorizontal: 16 }}>
            <PredictionDetailCard prediction={pred} />
          </View>
        ))}

        {predictions.length === 0 && (
          <Text variant="body" color="muted" align="center" style={{ paddingHorizontal: 32 }}>
            No predictions available yet. Log your first period to get started.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingVertical: 16, gap: 16 },
  qualityBanner: { padding: 12, borderLeftWidth: 4, marginBottom: 8 },
});
