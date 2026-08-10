import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import * as Haptics from 'expo-haptics';
import type { CurrentCycleState } from 'src/hooks/useCurrentCycleState';
import type { WellnessInsights } from 'src/services/api/wellness';
import type { CycleAnalytics, PredictionListResponse } from 'src/services/api/cycle';
import type { HealthTipResponse } from 'src/services/api/wellness';
import type { CycleDay } from 'src/db/schema';
import { getRecommendations, getRecommendationInputFromDay } from 'src/utils/expertRecommendations';

interface DynamicRecommendationsProps {
  cycleState: CurrentCycleState;
  insights: WellnessInsights | undefined;
  analytics: CycleAnalytics | undefined;
  predictions: PredictionListResponse | undefined;
  healthTips: HealthTipResponse[];
  /** Today's cycle day from local Db — drives the "For today" engine block. */
  dayData?: CycleDay | null;
}

interface RecommendationItem {
  id: string;
  icon: string;
  text: string;
  badge: string;
  actionable: boolean;
}

export function DynamicRecommendations({ cycleState, insights, analytics, predictions, healthTips, dayData }: DynamicRecommendationsProps) {
  const theme = useTheme();
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const engineCards = useCallback((): RecommendationItem[] => {
    if (!dayData) return [];
    const input = getRecommendationInputFromDay(dayData, cycleState.phaseKey);
    return getRecommendations(input).map((card) => ({
      id: card.id,
      icon: card.icon,
      text: card.title,
      badge: 'Today',
      actionable: true,
    }));
  }, [dayData, cycleState.phaseKey]);

  const recommendations = useCallback((): RecommendationItem[] => {
    const recs: RecommendationItem[] = [];

    // "For today" — engine cards from today's cycle day (plan5 §3.2).
    recs.push(...engineCards());

    // Phase-based recommendation from cycle analytics
    if (cycleState.hasCycleData && cycleState.phaseKey === 'luteal') {
      const cramps = analytics?.common_symptoms?.find((s) => s.symptom.toLowerCase().includes('cramp'));
      if (cramps && cramps.count >= 2) {
        recs.push({
          id: 'luteal-cramps',
          icon: '🫀',
          text: 'Cramps logged in your luteal phase. Try gentle yoga or a warm compress.',
          badge: 'Pain',
          actionable: true,
        });
      }
    }

    if (cycleState.phaseKey === 'follicular' || cycleState.phaseKey === 'ovulation') {
      recs.push({
        id: 'phase-energy',
        icon: '🌅',
        text: `Morning Calm breathing is ideal for your ${cycleState.phaseLabel} phase — boost your rising energy.`,
        badge: 'Breathe',
        actionable: true,
      });
    }

    // Data gap recommendations
    if (!insights || (insights.total_mood_logs ?? 0) < 3) {
      recs.push({
        id: 'mood-gap',
        icon: '🌸',
        text: 'Log your mood daily for 3 days to unlock personalized insights.',
        badge: 'Mood',
        actionable: true,
      });
    }

    // Prediction data quality
    if (predictions?.data_quality && ['Minimal', 'Insufficient'].includes(predictions.data_quality)) {
      recs.push({
        id: 'data-quality',
        icon: '📊',
        text: 'Log 2 more cycles to improve prediction accuracy.',
        badge: 'Cycle',
        actionable: false,
      });
    }

    // Health tips (from API)
    healthTips.slice(0, 3).forEach((tip) => {
      recs.push({
        id: tip.id ?? `tip-${Math.random()}`,
        icon: '💡',
        text: tip.tip,
        badge: tip.metric_type.charAt(0).toUpperCase() + tip.metric_type.slice(1),
        actionable: false,
      });
    });

    return recs;
  }, [cycleState, insights, analytics, predictions, healthTips, engineCards]);

  const recs = useMemo(() => recommendations(), [recommendations]);

  const handleCheck = useCallback((id: string, actionable: boolean) => {
    if (!actionable) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = new Set(completed);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
      // Persist completion
      AsyncStorage.setItem(`wellness.recs.done.${id}`, '1').catch(() => {});
    }
    setCompleted(updated);
  }, [completed]);

  // Load persisted completions
  React.useEffect(() => {
    const load = async () => {
      const done: Set<string> = new Set();
      for (const id of recs.filter((r) => r.actionable).map((r) => r.id)) {
        const stored = await AsyncStorage.getItem(`wellness.recs.done.${id}`);
        if (stored === '1') done.add(id);
      }
      setCompleted(done);
    };
    load();
  }, [recs]);

  if (recs.length === 0) {
    return (
      <View style={styles.container}>
        <Txt variant="body" color="secondary">No recommendations yet. Check back after logging more data.</Txt>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {recs.map((rec) => {
        const isDone = completed.has(rec.id);
        return (
          <View
            key={rec.id}
            style={[
              styles.recCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md },
              isDone && styles.recDone,
            ]}
          >
            <View style={styles.recContent}>
              <Txt variant="emoji" style={styles.recEmoji}>{rec.icon}</Txt>
              <Txt variant="bodySmall" style={styles.recText}>{rec.text}</Txt>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: `${theme.colors.primary}22`, borderRadius: theme.radius.pill },
                ]}
              >
                <Txt style={[styles.badgeText, { color: theme.colors.primary }]}>{rec.badge}</Txt>
              </View>
            </View>

            {rec.actionable && (
              <Pressable
                onPress={() => handleCheck(rec.id, rec.actionable)}
                style={[styles.checkBtn, { borderRadius: theme.radius.sm }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                accessibilityLabel={isDone ? 'Mark as not done' : 'Mark as done'}
              >
                <Txt style={[styles.checkText, { color: isDone ? theme.colors.primary : theme.colors.textMuted }]}>
                  {isDone ? '✓' : '○'}
                </Txt>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  recCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recDone: {
    opacity: 0.6,
  },
  recContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  recEmoji: {
    fontSize: 18,
  },
  recText: {
    flex: 1,
    marginLeft: 10,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  checkText: {
    fontSize: 16,
  },
  checkBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginLeft: 8,
  },
});
