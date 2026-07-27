import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, Pressable, StyleSheet, Dimensions, AppState } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, withDelay, Easing } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useCompanionStore } from '../../stores/companionStore';
import { useAnimationEngine, LunaSprite } from '../../services/companion';
import type { AnimationState } from '../../services/companion';
import { useSpeechBubble } from '../../services/companion/EventEngine';
import { Text, Loader } from '../../components/ui';
import { useTheme } from '../../theme';
import { useNavigation } from '@react-navigation/native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LUNA_SIZE = 72;
const BUBBLE_MAX_WIDTH = Math.min(SCREEN_WIDTH * 0.55, 200);
const BUBBLE_MAX_HEIGHT = SCREEN_HEIGHT * 0.3;
const PET_COOLDOWN_MS = 5000;
const HEART_EMOJIS = ['\u{1F495}', '\u{2764}\u{FE0F}', '\u{1F497}', '\u{1F496}', '\u{1F43E}'];

function SpeechBubble({ text, theme }: { text: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.bubbleContainer}>
      <View style={[styles.bubble, {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.primary + '33',
        shadowColor: theme.colors.textPrimary,
        maxHeight: BUBBLE_MAX_HEIGHT,
        marginBottom: SCREEN_HEIGHT < 700 ? 2 : 4,
      }]}>
        <Text variant="caption" align="center" style={{ color: theme.colors.textPrimary, fontSize: 12, lineHeight: 16 }} numberOfLines={3}>
          {text}
        </Text>
      </View>
      <View style={[styles.bubbleArrow, { borderTopColor: theme.colors.surface }]} />
    </View>
  );
}

export const MemoizedSpeechBubble = React.memo(SpeechBubble);

export function LunaOverlay() {
  const theme = useTheme();

  const isHidden = useCompanionStore((s) => s.isHidden);
  const reduceAnimations = useCompanionStore((s) => s.reduceAnimations);
  const xp = useCompanionStore((s) => s.xp);
  const level = useCompanionStore((s) => s.level);
  const xpToNext = useCompanionStore((s) => s.xpToNext);
  const installStatus = useCompanionStore((s) => s.installStatus);

  const navigation = useNavigation<any>();

  const { play, animatedStyle, isAnimating, scale, opacity } = useAnimationEngine();
  const { current: speech, show: showBubble } = useSpeechBubble();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const [showTapFeedback, setShowTapFeedback] = useState(false);
  const [petCount, setPetCount] = useState(0);
  const hearts = useSharedValue(0);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: hearts.value,
    transform: [
      { translateY: -hearts.value * 20 },
      { scale: 1 + hearts.value * 0.5 },
    ],
  }));

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleStage = useRef(0);

  const wakeUp = useCallback(() => {
    if (isAnimating('sleep') || useCompanionStore.getState().memory.lastPetTime) {
      if (!reduceAnimations) {
        scale.value = withSequence(
          withTiming(1.1, { duration: 200 }),
          withTiming(1, { duration: 200 })
        );
        opacity.value = withTiming(1, { duration: 200 });
        showBubble('Yawn... Good morning! \u{1F338}', 'wave', 2500);
      }
    }
    resetInactivityTimer();
  }, [reduceAnimations, scale, opacity, showBubble]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    idleStage.current = 0;
    if (idleTimer.current) clearInterval(idleTimer.current);
    if (!reduceAnimations) {
      play('idle_blink');
    }
    inactivityTimer.current = setTimeout(() => {
      if (!reduceAnimations) {
        play('sleep');
      }
    }, 35000);
  }, [reduceAnimations, play]);

  const startIdleCycle = useCallback(() => {
    if (reduceAnimations) return;

    idleStage.current = 0;
    if (idleTimer.current) clearInterval(idleTimer.current);

    idleTimer.current = setInterval(() => {
      idleStage.current += 1;

      switch (idleStage.current) {
        case 1: case 2:
          if (!isAnimating('idle') && !isAnimating('sleep')) {
            play('idle_blink');
          }
          break;
        case 5:
          if (!isAnimating('sleep')) {
            scale.value = withSequence(
              withTiming(1.02, { duration: 300 }),
              withTiming(0.98, { duration: 300 }),
              withTiming(1, { duration: 300 })
            );
          }
          break;
        case 8:
          if (!isAnimating('sleep')) {
            scale.value = withSequence(
              withTiming(1.08, { duration: 400 }),
              withTiming(1, { duration: 400 })
            );
          }
          break;
        case 10:
          if (!isAnimating('sleep')) {
            play('sleep');
          }
          if (idleTimer.current) clearInterval(idleTimer.current);
          break;
      }
    }, 4000);
  }, [reduceAnimations, isAnimating, play, scale]);

  useEffect(() => {
    if (!isHidden && !reduceAnimations) {
      startIdleCycle();
    }
    return () => {
      if (idleTimer.current) clearInterval(idleTimer.current);
    };
  }, [isHidden, reduceAnimations, startIdleCycle]);

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        resetInactivityTimer();
      }
    });
    return () => sub.remove();
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (speech) {
      resetInactivityTimer();
      if (!reduceAnimations) {
        play(speech.animation);
      }
    } else {
      if (!reduceAnimations) {
        play('idle');
      }
    }
  }, [speech?.id]);

  const handleTap = useCallback(() => {
    if (isHidden) return;

    wakeUp();

    if (!reduceAnimations) {
      const petAnimations: AnimationState[] = ['pet', 'wave', 'happy'];
      const animIndex = petCount % petAnimations.length;
      play(petAnimations[animIndex]);
      setPetCount((c) => c + 1);
    }

    setShowTapFeedback(true);
    hearts.value = withSequence(
      withTiming(1, { duration: 200, easing: Easing.out(Easing.back(2)) }),
      withDelay(400, withTiming(0, { duration: 200 }))
    );
    setTimeout(() => setShowTapFeedback(false), 800);

    const now = Date.now();
    const lastPet = (useCompanionStore.getState().memory.lastPetTime as number) ?? 0;
    if (now - lastPet > PET_COOLDOWN_MS) {
      useCompanionStore.getState().updateMemory('lastPetTime', now);
      useCompanionStore.getState().addXP(1);
      useCompanionStore.getState().addCoins(1);
    }

    const { dialogueEngine: de } = require('../../services/companion/DialogueEngine');
    showBubble(de.get('petted'), 'pet', 3000);

    resetInactivityTimer();
  }, [isHidden, reduceAnimations, petCount, play, showBubble, resetInactivityTimer, wakeUp, hearts]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      translateX.value = withSpring(Math.round(translateX.value / 10) * 10);
      translateY.value = withSpring(Math.round(translateY.value / 10) * 10);
    })
    .minDistance(10);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const xpProgress = useMemo(() => {
    if (xpToNext <= 0) return 1;
    return Math.min(xp / xpToNext, 1);
  }, [xp, xpToNext]);

  const heartEmoji = HEART_EMOJIS[petCount % HEART_EMOJIS.length];

  if (isHidden) return null;

  const innerContent = (() => {
    if (installStatus === 'downloading' || installStatus === 'extracting') {
      return (
        <View style={styles.downloadPlaceholder}>
          <Loader size="small" />
          <Text variant="caption" color="muted" align="center" style={{ marginTop: 4 }}>
            {installStatus === 'downloading' ? 'Downloading...' : 'Extracting...'}
          </Text>
        </View>
      );
    }
    return (
      <>
        {speech && <MemoizedSpeechBubble text={speech.text} theme={theme} />}

        {showTapFeedback && (
          <Animated.View style={[styles.tapFeedback, heartStyle]}>
            <Text style={styles.heartText}>{heartEmoji}</Text>
          </Animated.View>
        )}

        <Pressable
          onPress={handleTap}
          onLongPress={() => navigation.navigate('HealthHub')}
          delayLongPress={600}
          accessibilityLabel="Luna the companion cat. Tap to pet, long press for Health Hub."
          accessibilityRole="imagebutton"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <LunaSprite size={reduceAnimations ? LUNA_SIZE - 8 : LUNA_SIZE} animatedStyle={animatedStyle} />
        </Pressable>

        <View style={[styles.xpBar, { backgroundColor: theme.colors.primaryMuted }]}>
          <View style={[styles.xpFill, { width: `${xpProgress * 100}%` as any, backgroundColor: theme.colors.primary }]} />
        </View>

        <View style={[styles.levelBadge, { backgroundColor: theme.colors.primary }]}>
          <Text style={{ color: theme.colors.textInverse, fontSize: 9, fontWeight: '700' }}>
            {'Lv.'}{level}
          </Text>
        </View>
      </>
    );
  })();

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, dragStyle]}>
        {innerContent}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    alignItems: 'center',
    zIndex: 1000,
  },
  downloadPlaceholder: {
    width: LUNA_SIZE,
    height: LUNA_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleContainer: {
    marginBottom: 4,
    alignItems: 'center',
  },
  bubble: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: BUBBLE_MAX_WIDTH,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bubbleArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -1,
  },
  tapFeedback: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
  },
  heartText: {
    fontSize: 20,
  },
  xpBar: {
    width: LUNA_SIZE - 12,
    height: 3,
    borderRadius: 2,
    marginTop: 2,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 2,
  },
  levelBadge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 1,
  },
});
