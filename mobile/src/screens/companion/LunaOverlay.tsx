import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, Pressable, StyleSheet, Dimensions, AppState } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withRepeat, withDelay, cancelAnimation, Easing, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useCompanionStore } from '../../stores/companionStore';
import { useAnimationEngine, memoryService, dialogueEngine, voiceService } from '../../services/companion';
import { Luna3D } from '../../services/companion/3d/Luna3D';
import { useSpeechBubble } from '../../services/companion/EventEngine';
import { Text, Loader } from '../../components/ui';
import { useTheme, typography } from '../../theme';
import { getLunaContext, LunaScreen } from '../../services/companion/lunaContext';
import { getFallbackTip, type HealthTipCategory } from '../../services/healthTips';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useLunaMicSession } from '../../hooks/useLunaMicSession';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LUNA_SIZE = 112;
const BUBBLE_WIDTH = 210;

const PHASE_TIP_CATEGORY: Record<string, HealthTipCategory> = {
  menstrual: 'food',
  follicular: 'exercise',
  ovulation: 'water',
  luteal: 'sleep',
};

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
  phaseKey?: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'fertile' | null;
  nextPeriodDays?: number | null;
  predictedStartDate?: string | null;
  predictedEndDate?: string | null;
  predictedCycleLength?: number | null;
  hasCycleData?: boolean;
  mood?: string | null;
  energy?: number;
  wellnessTab?: string;
  week?: number;
  trimester?: number;
  babySize?: string;
  /** Today's recommendation card, used by the tap-to-speak reply path. */
  recommendationCard?: { title: string; body: string; cta?: string | null } | null;
}

export function LunaOverlay({
  screen = 'home',
  lunaEnabled: lunaEnabledProp = true,
  pregnancyMode: pregnancyModeProp = false,
  currentPhase,
  phaseKey = null,
  nextPeriodDays = null,
  predictedStartDate = null,
  predictedEndDate = null,
  predictedCycleLength = null,
  hasCycleData = false,
  mood,
  energy,
  wellnessTab,
  week,
  trimester,
  babySize,
  recommendationCard = null,
}: LunaOverlayProps) {
  const theme = useTheme();
  const systemReducedMotion = useReducedMotion();

  const isHidden = useCompanionStore((s) => s.isHidden);
  const reduceAnimations = useCompanionStore((s) => s.reduceAnimations);
  const xp = useCompanionStore((s) => s.xp);
  const level = useCompanionStore((s) => s.level);
  const xpToNext = useCompanionStore((s) => s.xpToNext);
  const installStatus = useCompanionStore((s) => s.installStatus);
  const listenAndSpeak = useCompanionStore((s) => s.listenAndSpeak);

  const reducedMotion = systemReducedMotion || reduceAnimations;
  const mic = useLunaMicSession(recommendationCard);

  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  // Dock above the bottom tab bar + home-indicator safe area so Luna never hides
  // under the navigation bar.
  const dockBottom = (insets?.bottom ?? 0) + (tabBarHeight ?? 0) + 18;

  const { play, animatedStyle, isAnimating, scale, opacity, rotation, rotationX, currentAnim } = useAnimationEngine();
  const { current: speech, show: showBubble } = useSpeechBubble();
  const talking = useSharedValue(false);
  const backgroundPaused = useSharedValue(false);

  useEffect(() => {
    const unsubscribe = voiceService.onSpeaking((speaking) => {
      talking.value = speaking;
    });
    return unsubscribe;
  }, [talking]);

  useEffect(() => {
    if (isHidden) {
      voiceService.stop();
    }
  }, [isHidden]);

  const [expanded, setExpanded] = useState(false);
  const [healthTip, setHealthTip] = useState<string | null>(null);
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
    return () => {
      cancelAnimation(walkX);
    };
  }, [context.animation, walkX]);

  const floatAnim = useAnimatedStyle(() => {
    if (reduceAnimations || backgroundPaused.value) return {};
    switch (context.animation) {
      case 'walk-right':
      case 'walk-left':
        return { transform: [{ translateX: walkX.value }] };
      case 'bounce':
        return { transform: [{ translateY: withSequence(withTiming(-14, { duration: 450 }), withTiming(0, { duration: 450 })) }] };
      default:
        return { transform: [{ translateY: withRepeat(withSequence(withTiming(-3, { duration: 2000 }), withTiming(0, { duration: 2000 })), -1, true) }] };
    }
  }, [context.animation, reduceAnimations]);

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleStage = useRef(0);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (turnTimer.current) clearTimeout(turnTimer.current);
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
    // After a stretch of true inactivity, turn Luna around to show her back —
    // an "alive" cue that she's been watching you go.
    turnTimer.current = setTimeout(() => {
      if (
        !reduceAnimations &&
        !isAnimating('sleep') &&
        !isAnimating('show_back') &&
        !isAnimating('flip') &&
        !isAnimating('wave') &&
        !isAnimating('happy')
      ) {
        play('show_back');
      }
    }, 32000);
  }, [reduceAnimations, play, isAnimating]);

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
  }, [reduceAnimations, scale, opacity, showBubble, isAnimating, resetInactivityTimer]);

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
        case 4:
          // Playful surprise: 40% chance to do a backflip mid-idle.
          if (
            !isAnimating('sleep') &&
            !isAnimating('show_back') &&
            !isAnimating('flip') &&
            Math.random() < 0.4
          ) {
            play('flip');
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
        case 9:
          // Backup flip chance before sleep.
          if (
            !isAnimating('sleep') &&
            !isAnimating('show_back') &&
            !isAnimating('flip') &&
            Math.random() < 0.5
          ) {
            play('flip');
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
      if (turnTimer.current) clearTimeout(turnTimer.current);
    };
  }, [resetInactivityTimer]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        backgroundPaused.value = false;
        cancelAnimation(walkX);
        walkX.value = 0;
        if (!isHidden && !reduceAnimations) {
          startIdleCycle();
        }
        resetInactivityTimer();
      } else if (state === 'background') {
        backgroundPaused.value = true;
        cancelAnimation(walkX);
        voiceService.stop();
        if (idleTimer.current) clearInterval(idleTimer.current);
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (turnTimer.current) clearTimeout(turnTimer.current);
      }
    });
    return () => sub.remove();
  }, [backgroundPaused, walkX, resetInactivityTimer, startIdleCycle, isHidden, reduceAnimations]);

  // Hydrate on-device memory on mount + foreground so dialogue is memory-aware
  useEffect(() => {
    let cancelled = false;
    const hydrate = () => {
      const userId = useCompanionStore.getState().userId;
      if (!userId) return;
      memoryService
        .hydrateMemory(userId)
        .then((snapshot) => {
          if (!cancelled) dialogueEngine.setMemoryContext(snapshot);
        })
        .catch(() => {});
    };
    hydrate();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') hydrate();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

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
  }, [speech, reduceAnimations, play, resetInactivityTimer]);

  const handleTap = useCallback(() => {
    if (isHidden) return;
    setExpanded((v) => {
      const next = !v;
      if (next && !hasCycleData) {
        setHealthTip(pickHealthTip(phaseKey));
      }
      return next;
    });
    wakeUp();
    if (!reduceAnimations) {
      play('wave');
    }
    resetInactivityTimer();
  }, [isHidden, hasCycleData, phaseKey, reduceAnimations, play, resetInactivityTimer, wakeUp]);

  const xpProgress = useMemo(() => {
    if (xpToNext <= 0) return 1;
    return Math.min(xp / xpToNext, 1);
  }, [xp, xpToNext]);

  if (isHidden) return null;

  const innerContent = (() => {
    if (installStatus === 'downloading' || installStatus === 'extracting') {
      return (
        <View style={styles.downloadPlaceholder}>
          <Loader size="small" />
          <Text variant="caption" color="muted" align="center" style={styles.downloadStatus}>
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
              {hasCycleData ? (
                <NextPeriodPanel
                  days={nextPeriodDays}
                  startDate={predictedStartDate}
                  endDate={predictedEndDate}
                  cycleLength={predictedCycleLength}
                />
              ) : (
                <HealthTipFallback tip={healthTip ?? ''} />
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

        <View style={styles.avatarWrap}>
          {!expanded && listenAndSpeak && installStatus === 'ready' && (
            <LunaMicButton
              isListening={mic.isListening}
              isProcessing={mic.isProcessing}
              reducedMotion={reducedMotion}
              onPress={() => mic.start().catch(() => {})}
            />
          )}
          <Pressable
            onPress={handleTap}
            accessibilityLabel="Luna the companion cat. Tap for your next-period forecast or a health tip."
            accessibilityRole="imagebutton"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Animated.View style={[animatedStyle, floatAnim]}>
              <Luna3D
                size={reduceAnimations ? LUNA_SIZE - 8 : LUNA_SIZE}
                currentAnim={currentAnim}
                rotation={rotation}
                rotationX={rotationX}
                installed={installStatus === 'ready'}
                reducedMotion={systemReducedMotion}
                reduceAnimations={reduceAnimations}
                talking={talking}
              />
            </Animated.View>
          </Pressable>
        </View>

        <View style={styles.groundShadow} />

        {!expanded && (
          <>
            <View style={[styles.xpBar, { backgroundColor: theme.colors.primaryMuted }]}>
              <View style={[styles.xpFill, { width: `${xpProgress * 100}%` as any, backgroundColor: theme.colors.primary }]} />
            </View>
            <View style={[styles.levelBadge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.levelBadgeText}>
                {'Lv.'}{level}
              </Text>
            </View>
          </>
        )}
      </>
    );
  })();

  return (
    <Animated.View style={[styles.container, { bottom: dockBottom }]}>
      {innerContent}
    </Animated.View>
  );
}

function pickHealthTip(phaseKey: string | null | undefined): string {
  const category = phaseKey ? PHASE_TIP_CATEGORY[phaseKey] : undefined;
  return (
    getFallbackTip(category ?? 'general') ??
    getFallbackTip('general') ??
    'Small consistent steps lead to big health changes.'
  );
}

function LunaMicButton({
  isListening,
  isProcessing,
  reducedMotion,
  onPress,
}: {
  isListening: boolean;
  isProcessing: boolean;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const glow = useSharedValue(0.55);

  useEffect(() => {
    if (reducedMotion) {
      glow.value = 1;
      return;
    }
    if (isListening) {
      glow.value = 1;
    } else {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withDelay(1200, withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) })),
        ),
        -1,
        true,
      );
    }
    return () => {
      cancelAnimation(glow);
    };
  }, [glow, isListening, reducedMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: isListening ? 1 : 0.55 * glow.value,
    transform: [{ scale: isListening ? 1 + 0.12 * glow.value : 0.92 + 0.08 * glow.value }],
  }));

  const label = isProcessing
    ? 'Processing your voice'
    : isListening
      ? 'Luna is listening. Tap to stop.'
      : 'Tap to talk to Luna';

  const hint = isProcessing
    ? 'Please wait while Luna thinks'
    : isListening
      ? 'Stops the current voice session'
      : 'Starts a short voice session';

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: isListening || isProcessing }}
      accessibilityHint={hint}
      hitSlop={8}
      style={styles.micHaloWrap}
    >
      <Animated.View style={[styles.micRing, ringStyle]} />
      <View style={[styles.micButton, isListening && styles.micButtonActive]}>
        {isProcessing ? (
          <Loader size="small" color="#FFFFFF" />
        ) : (
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <Path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M19 10v2a7 7 0 01-14 0v-2" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <Line x1="12" y1="19" x2="12" y2="23" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <Line x1="8" y1="23" x2="16" y2="23" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </Svg>
        )}
      </View>
    </Pressable>
  );
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function NextPeriodPanel({
  days,
  startDate,
  endDate,
  cycleLength,
}: {
  days: number | null;
  startDate: string | null;
  endDate: string | null;
  cycleLength: number | null;
}) {
  let statusText = 'coming up';
  if (days !== null) {
    if (days <= 0) {
      statusText = days === 0 ? 'due today' : 'started';
    } else {
      statusText = `in ${days} day${days === 1 ? '' : 's'}`;
    }
  }
  return (
    <>
      <View style={styles.bubbleHeader}>
        <AnimAvatar />
        <Text style={styles.bubbleTitle}>LUNA</Text>
      </View>
      <Text style={styles.periodBig}>Next period {statusText}</Text>
      {startDate != null && (
        <Text style={styles.bubbleMessage}>
          Expected {formatDateLabel(startDate)}
          {endDate ? ` \u2013 ${formatDateLabel(endDate)}` : ''}
        </Text>
      )}
      {cycleLength != null && <Text style={styles.bubbleMessage}>Cycle avg: {cycleLength} days</Text>}
    </>
  );
}

function HealthTipFallback({ tip }: { tip: string }) {
  return (
    <>
      <View style={styles.bubbleHeader}>
        <AnimAvatar />
        <Text style={styles.bubbleTitle}>LUNA</Text>
        <View style={styles.tipBadge}>
          <Text style={styles.tipBadgeText}>HEALTH TIP</Text>
        </View>
      </View>
      <Text style={styles.bubbleMessage}>{tip}</Text>
    </>
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
  avatarWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  micHaloWrap: {
    position: 'absolute',
    top: -14,
    right: -6,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  micRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FF6B8A',
    backgroundColor: 'rgba(255,107,138,0.18)',
  },
  micButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FF6B8A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  micButtonActive: {
    backgroundColor: '#DC2626',
  },
  downloadStatus: {
    marginTop: 4,
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
    color: '#DC2626',
  },
  bubbleMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#DC2626',
    marginBottom: 4,
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
    color: '#DC2626',
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
  periodBig: {
    fontSize: 18,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 6,
  },
  tipBadge: {
    backgroundColor: 'rgba(255,107,138,0.14)',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  tipBadgeText: {
    fontSize: typography.annotation.fontSize,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#DC2626',
  },
  levelBadgeText: {
    color: '#FFFFFF',
    fontSize: typography.annotation.fontSize,
    fontWeight: '700',
  },
  groundShadow: {
    width: LUNA_SIZE * 0.68,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.14)',
    marginTop: -10,
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
