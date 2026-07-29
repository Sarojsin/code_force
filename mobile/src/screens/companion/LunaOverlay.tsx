import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, Pressable, StyleSheet, Dimensions, AppState } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, withDelay, withRepeat, Easing } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useCompanionStore } from '../../stores/companionStore';
import { useAnimationEngine, LunaSprite } from '../../services/companion';
import type { AnimationState } from '../../services/companion';
import { useSpeechBubble } from '../../services/companion/EventEngine';
import { Text, Loader } from '../../components/ui';
import { useTheme } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import { getLunaContext, LunaScreen } from '../../services/companion/lunaContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LUNA_SIZE = 60;
const BUBBLE_WIDTH = 210;
const PET_COOLDOWN_MS = 5000;
const HEART_EMOJIS = ['\u{1F495}', '\u{2764}\u{FE0F}', '\u{1F497}', '\u{1F496}', '\u{1F43E}'];

function AnimAvatar() {
  return (
    <View style={styles.avatarRing}>
      <LinearGradient
        colors={['#FFB3C6', '#FF6B8A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatarGradient}
      >
        <View style={styles.avatarInner} />
      </LinearGradient>
    </View>
  );
}

export interface LunaOverlayProps {
  screen?: LunaScreen;
  lunaEnabled?: boolean;
  pregnancyMode?: boolean;
  currentPhase?: string;
  mood?: string | null;
  energy?: number;
  wellnessTab?: string;
  week?: number;
  trimester?: number;
  babySize?: string;
}

export function LunaOverlay({
  screen = 'home',
  lunaEnabled: lunaEnabledProp = true,
  pregnancyMode: pregnancyModeProp = false,
  currentPhase,
  mood,
  energy,
  wellnessTab,
  week,
  trimester,
  babySize,
}: LunaOverlayProps) {
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
  const [expanded, setExpanded] = useState(false);
  const hearts = useSharedValue(0);
  const walkX = useSharedValue(0);

  const context = useMemo(() => getLunaContext(screen, {
    lunaEnabled: lunaEnabledProp,
    pregnancyMode: pregnancyModeProp,
    currentPhase,
    mood,
    energy,
    wellnessTab,
    week,
    trimester,
    babySize,
  }), [screen, lunaEnabledProp, pregnancyModeProp, currentPhase, mood, energy, wellnessTab, week, trimester, babySize]);

  useEffect(() => {
    if (context.animation === 'walk-right') {
      walkX.value = -160;
      walkX.value = withTiming(0, { duration: 7000, easing: Easing.linear });
    } else if (context.animation === 'walk-left') {
      walkX.value = 160;
      walkX.value = withTiming(0, { duration: 7000, easing: Easing.linear });
    } else {
      walkX.value = 0;
    }
  }, [context.animation]);

  const floatAnim = useAnimatedStyle(() => {
    if (reduceAnimations) return {};
    switch (context.animation) {
      case 'walk-right':
      case 'walk-left':
        return { transform: [{ translateX: walkX.value }] };
      case 'bounce':
        return { transform: [{ translateY: withSequence(withTiming(-14, { duration: 450 }), withTiming(0, { duration: 450 })) }] };
      default:
        return { transform: [{ translateY: withRepeat(withSequence(withTiming(-6, { duration: 2000 }), withTiming(0, { duration: 2000 })), -1, true) }] };
    }
  }, [context.animation, reduceAnimations]);

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

    setExpanded((v) => !v);
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
        {expanded && (
          <View style={styles.expandedBubble}>
            <BlurView intensity={20} tint="light" style={styles.bubbleBlur} />
            <View style={styles.bubbleContent}>
              <View style={styles.bubbleHeader}>
                <AnimAvatar />
                <Text style={styles.bubbleTitle}>LUNA</Text>
              </View>
              <Text style={styles.bubbleMessage}>{context.message}</Text>
              {context.actionLabel && (
                <Pressable onPress={() => setExpanded(false)}>
                  <Text style={styles.bubbleAction}>{context.actionLabel} {'\u2192'}</Text>
                </Pressable>
              )}
            </View>
            <Pressable
              style={styles.dismissBtn}
              onPress={() => setExpanded(false)}
              accessibilityLabel="Dismiss"
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.dismissX}>{'\u2715'}</Text>
            </Pressable>
            <View style={styles.bubbleTail} />
          </View>
        )}

        {!expanded && speech && <SpeechBubble text={speech.text} />}

        {showTapFeedback && (
          <Animated.View style={[styles.tapFeedback, heartStyle]}>
            <Text style={styles.heartText}>{heartEmoji}</Text>
          </Animated.View>
        )}

        <Pressable
          onPress={handleTap}
          onLongPress={() => navigation.navigate('HealthHub')}
          delayLongPress={600}
          accessibilityLabel="Luna the companion cat. Tap to toggle bubble, long press for Health Hub."
          accessibilityRole="imagebutton"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Animated.View style={[animatedStyle, floatAnim]}>
            <LunaSprite size={reduceAnimations ? LUNA_SIZE - 8 : LUNA_SIZE} animatedStyle={animatedStyle} />
          </Animated.View>
        </Pressable>

        {!expanded && (
          <>
            <View style={[styles.xpBar, { backgroundColor: theme.colors.primaryMuted }]}>
              <View style={[styles.xpFill, { width: `${xpProgress * 100}%` as any, backgroundColor: theme.colors.primary }]} />
            </View>
            <View style={[styles.levelBadge, { backgroundColor: theme.colors.primary }]}>
              <Text style={{ color: theme.colors.textInverse, fontSize: 9, fontWeight: '700' }}>
                {'Lv.'}{level}
              </Text>
            </View>
          </>
        )}
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

function SpeechBubble({ text }: { text: string }) {
  return (
    <View style={styles.speechContainer}>
      <View style={styles.speechBubble}>
        <Text style={styles.speechText} numberOfLines={3}>{text}</Text>
      </View>
      <View style={styles.speechArrow} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 96,
    right: 14,
    alignItems: 'center',
    zIndex: 1000,
  },
  downloadPlaceholder: {
    width: LUNA_SIZE,
    height: LUNA_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  speechContainer: {
    marginBottom: 4,
    alignItems: 'center',
  },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B8A33',
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: Math.min(SCREEN_WIDTH * 0.55, 200),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  speechText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#1A1D26',
    textAlign: 'center',
  },
  speechArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    alignSelf: 'center',
    marginTop: -1,
  },
  expandedBubble: {
    width: BUBBLE_WIDTH,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#D4A5B5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  bubbleBlur: {
    ...StyleSheet.absoluteFill,
    borderRadius: 22,
  },
  bubbleContent: {
    padding: 16,
    paddingBottom: 12,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  bubbleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D1B26',
  },
  bubbleMessage: {
    fontSize: 12,
    lineHeight: 19,
    color: '#6B4D5A',
    marginBottom: 4,
  },
  bubbleAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B8A',
    marginTop: 4,
  },
  dismissBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(160,120,136,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissX: {
    fontSize: 13,
    color: '#6B4D5A',
    lineHeight: 14,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    right: 20,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(255,248,240,0.95)',
    transform: [{ rotate: '45deg' }],
    borderBottomRightRadius: 3,
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
