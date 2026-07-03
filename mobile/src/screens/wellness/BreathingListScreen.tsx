import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FlatList, StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, Easing } from 'react-native-reanimated';

import { Button, Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { wellnessService } from 'src/services/api/wellness';
import type { BreathingExercise } from 'src/services/api/wellness';

const EXERCISE_COLORS = ['#D1FAE5', '#BFDBFE', '#EDE9FE', '#FEF3C7', '#FCE7F3'];

function BreathingTimer({ exercise, onComplete }: { exercise: BreathingExercise; onComplete: () => void }) {
  const theme = useTheme();
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale' | 'rest'>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(exercise.duration_seconds);
  const [active, setActive] = useState(true);

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setActive(false);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [active, onComplete]);

  useEffect(() => {
    if (!active) return;
    const phaseDuration = 4000;
    const cycle = [
      { phase: 'inhale' as const, target: 1.3, delay: 0 },
      { phase: 'hold' as const, target: 1.3, delay: phaseDuration },
      { phase: 'exhale' as const, target: 0.8, delay: phaseDuration * 2 },
      { phase: 'rest' as const, target: 1.0, delay: phaseDuration * 3 },
    ];

    const fullCycle = setInterval(() => {
      cycle.forEach(({ phase: p, target }) => {
        setTimeout(() => {
          setPhase(p);
          scale.value = withTiming(target, { duration: 1000, easing: Easing.inOut(Easing.ease) });
        }, p === 'inhale' ? 0 : p === 'hold' ? phaseDuration : p === 'exhale' ? phaseDuration * 2 : phaseDuration * 3);
      });
    }, phaseDuration * 4);

    return () => clearInterval(fullCycle);
  }, [active]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <View style={[styles.timerContainer, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}>
      <Txt variant="h2" style={{ marginBottom: theme.spacing.sm }}>{exercise.title}</Txt>
      <Animated.View style={[styles.breathCircle, animStyle, { backgroundColor: theme.colors.primaryMuted }]}>
        <Txt variant="h1" align="center" color="primary">
          {phase === 'inhale' ? '🌬️' : phase === 'hold' ? '⏸️' : phase === 'exhale' ? '💨' : '😌'}
        </Txt>
      </Animated.View>
      <Txt variant="h2" style={{ marginVertical: theme.spacing.md }}>{phase.toUpperCase()}</Txt>
      <Txt variant="h3" color="secondary">{minutes}:{seconds.toString().padStart(2, '0')}</Txt>
      <View style={{ height: theme.spacing.md }} />
      <Button label="Stop" onPress={() => { setActive(false); onComplete(); }} variant="outline" />
    </View>
  );
}

export function BreathingListScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [activeExercise, setActiveExercise] = useState<string | null>(null);
  const [showTimer, setShowTimer] = useState(false);

  const { data: exercises, isLoading } = useQuery<BreathingExercise[]>({
    queryKey: ['wellness', 'breathing'],
    queryFn: () => wellnessService.getBreathingExercises(),
  });

  const completeMutation = useMutation({
    mutationFn: (exerciseId: string) => wellnessService.completeBreathingSession(exerciseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness'] });
      Toast.show({ type: 'success', text1: 'Exercise completed! 🎉' });
    },
    onError: () => {},
  });

  const handleComplete = useCallback(() => {
    setShowTimer(false);
    setActiveExercise(null);
    if (activeExercise) {
      completeMutation.mutate(activeExercise);
    }
  }, [activeExercise, completeMutation]);

  const renderItem = ({ item }: { item: BreathingExercise }) => {
    const isActive = activeExercise === item.id;
    const color = EXERCISE_COLORS[parseInt(item.id, 36) % EXERCISE_COLORS.length];

    return (
      <Card elevated style={{ marginBottom: theme.spacing.md, borderLeftWidth: 4, borderLeftColor: color }}>
        <Pressable
          onPress={() => {
            setActiveExercise(isActive ? null : item.id);
            setShowTimer(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Breathing exercise: ${item.title}`}
        >
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Txt variant="h3">{item.title}</Txt>
              <Txt variant="bodySmall" color="secondary" style={{ marginTop: 2 }}>
                {item.duration_seconds >= 60 ? `${Math.round(item.duration_seconds / 60)} min` : `${item.duration_seconds}s`}
              </Txt>
              {!!item.description && (
                <Txt variant="caption" color="muted" style={{ marginTop: 4 }}>{item.description}</Txt>
              )}
              {!!item.technique && (
                <Txt variant="caption" color="primary" style={{ marginTop: 2 }}>{item.technique}</Txt>
              )}
            </View>
          </View>
        </Pressable>

        {isActive && !showTimer && (
          <View style={{ marginTop: theme.spacing.md }}>
            <Button label="Start Exercise" onPress={() => setShowTimer(true)} fullWidth />
          </View>
        )}

        {isActive && showTimer && (
          <BreathingTimer exercise={item} onComplete={handleComplete} />
        )}
      </Card>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={exercises ?? []}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Breathing Exercises</Txt>
            <Txt variant="body" color="secondary">Guided exercises to calm your mind.</Txt>
          </View>
        }
        ListEmptyComponent={
          <Card><Txt variant="body" color="secondary" align="center">No exercises available.</Txt></Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  timerContainer: { marginTop: 16, padding: 16, alignItems: 'center' },
  breathCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
});
