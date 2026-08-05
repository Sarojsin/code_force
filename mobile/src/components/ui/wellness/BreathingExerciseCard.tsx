import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Pressable, Modal, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Card, Text as Txt, Button } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCompleteBreathingSession } from 'src/services/queries/wellness';
import type { BreathingExercise } from 'src/services/api';
import Toast from 'react-native-toast-message';

const EXERCISE_COLORS = ['#D1FAE5', '#BFDBFE', '#EDE9FE', '#FEF3C7', '#FCE7F3'];

interface BreathingExerciseCardProps {
  exercise: BreathingExercise;
  phaseColor?: string;
  onPress: () => void;
}

export function BreathingExerciseCard({ exercise, phaseColor, onPress }: BreathingExerciseCardProps) {
  const color = EXERCISE_COLORS[parseInt(exercise.id, 36) % EXERCISE_COLORS.length];
  const borderColor = phaseColor ?? color;

  return (
    <Card elevated style={[styles.card, { borderLeftColor: borderColor }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Start breathing exercise: ${exercise.title}`}
      >
        <View style={styles.row}>
          <View style={[styles.colorDot, { backgroundColor: borderColor }]} />
          <View style={styles.infoContainer}>
            <Txt variant="h3">{exercise.title}</Txt>
            <Txt variant="bodySmall" color="secondary" style={styles.subText}>
              {exercise.duration_seconds >= 60
                ? `${Math.round(exercise.duration_seconds / 60)} min`
                : `${exercise.duration_seconds}s`}
            </Txt>
            {!!exercise.description && (
              <Txt variant="caption" color="muted" style={styles.descText}>{exercise.description}</Txt>
            )}
            {!!exercise.technique && (
              <Txt variant="caption" color="primary" style={styles.techText}>{exercise.technique}</Txt>
            )}
          </View>
        </View>
      </Pressable>
    </Card>
  );
}

export function BreathingTimer({
  exercise,
  visible,
  onClose,
}: {
  exercise: BreathingExercise;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const completeSession = useCompleteBreathingSession();

  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale' | 'rest'>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(exercise.duration_seconds);
  const [active, setActive] = useState(true);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setActive(false);
          completeSession.mutate(exercise.id);
          Toast.show({ type: 'success', text1: 'Exercise completed! 🎉' });
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [active, exercise.id, completeSession, onClose]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, exercise.id]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const handleClose = useCallback(() => {
    setActive(false);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={[styles.modalOverlay, { backgroundColor: `${theme.colors.background}E6` }]}>
          <View style={[styles.timerContainer, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}>
            <Txt variant="h2" style={styles.titleText}>{exercise.title}</Txt>
            <Animated.View style={[styles.breathCircle, animStyle, { backgroundColor: theme.colors.primaryMuted }]}>
              <Txt variant="h1" align="center" color="primary">
                {phase === 'inhale' ? '🌬️' : phase === 'hold' ? '⏸️' : phase === 'exhale' ? '💨' : '😌'}
              </Txt>
            </Animated.View>
            <Txt variant="h2" style={styles.phaseText}>{phase.toUpperCase()}</Txt>
            <Txt variant="h3" color="secondary">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </Txt>
            <View style={styles.spacer} />
            {completeSession.isPending ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Button label="Stop" onPress={handleClose} variant="outline" />
            )}
          </View>
        </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  colorDot: { width: 24, height: 24, borderRadius: 12, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  timerContainer: {
    marginTop: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  breathCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  card: {
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  subText: {
    marginTop: 2,
  },
  descText: {
    marginTop: 4,
  },
  techText: {
    marginTop: 2,
  },
  titleText: {
    marginBottom: 8,
  },
  phaseText: {
    marginVertical: 8,
  },
  spacer: {
    height: 8,
  },
});
