import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { eventBus } from '../eventBus';

export type AnimationState =
  | 'idle'
  | 'idle_blink'
  | 'happy'
  | 'sad'
  | 'sleep'
  | 'jump'
  | 'wave'
  | 'celebrate'
  | 'pet'
  | 'hidden';

export interface FrameConfig {
  frames: number;
  speed: number;
  loop?: boolean;
  frameWidth?: number;
  frameHeight?: number;
}

export const ANIMATION_FRAMES: Record<AnimationState, FrameConfig> = {
  idle:       { frames: 4, speed: 200, loop: true },
  idle_blink: { frames: 2, speed: 500, loop: true },
  happy:      { frames: 4, speed: 150, loop: false },
  sad:        { frames: 3, speed: 200, loop: false },
  sleep:      { frames: 2, speed: 500, loop: true },
  jump:       { frames: 6, speed: 100, loop: false },
  wave:       { frames: 4, speed: 100, loop: false },
  celebrate:  { frames: 6, speed: 120, loop: false },
  pet:        { frames: 3, speed: 180, loop: false },
  hidden:     { frames: 1, speed: 0, loop: false },
};

const ANIMATION_PRIORITY: Record<AnimationState, number> = {
  idle: 0,
  idle_blink: 0,
  sleep: 1,
  sad: 2,
  pet: 3,
  wave: 4,
  happy: 5,
  jump: 6,
  celebrate: 7,
  hidden: 10,
};

function getAnimationDuration(state: AnimationState): number {
  const config = ANIMATION_FRAMES[state];
  if (config.loop) return Infinity;
  return config.frames * config.speed;
}

export function useAnimationEngine() {
  const currentAnim = useSharedValue<AnimationState>('idle');
  const priority = useSharedValue(0);

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotation = useSharedValue(0);

  const play = useCallback((state: AnimationState) => {
    const newPriority = ANIMATION_PRIORITY[state];
    const currentPrio = priority.value;

    if (newPriority < currentPrio && currentAnim.value !== 'idle') {
      return;
    }

    currentAnim.value = state;
    eventBus.emit('luna_animation_changed', { state });
    priority.value = newPriority;

    cancelAnimation(scale);
    cancelAnimation(translateY);
    cancelAnimation(translateX);
    cancelAnimation(rotation);

    switch (state) {
      case 'idle':
      case 'idle_blink':
        scale.value = withTiming(1, { duration: 300 });
        opacity.value = withTiming(1, { duration: 300 });
        translateY.value = withTiming(0, { duration: 200 });
        translateX.value = withTiming(0, { duration: 200 });
        rotation.value = withTiming(0, { duration: 200 });
        break;

      case 'happy':
        scale.value = withSequence(
          withTiming(1.1, { duration: 150, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: 150 })
        );
        rotation.value = withSequence(
          withTiming(0.05, { duration: 100 }),
          withTiming(-0.05, { duration: 100 }),
          withTiming(0.05, { duration: 100 }),
          withTiming(0, { duration: 100 })
        );
        break;

      case 'sad':
        scale.value = withTiming(0.95, { duration: 300 });
        opacity.value = withTiming(0.9, { duration: 300 });
        translateX.value = withSequence(
          withTiming(-3, { duration: 200 }),
          withTiming(3, { duration: 200 }),
          withTiming(0, { duration: 200 })
        );
        break;

      case 'sleep':
        scale.value = withTiming(0.98, { duration: 500 });
        opacity.value = withRepeat(
          withSequence(
            withTiming(0.85, { duration: 1000 }),
            withTiming(1, { duration: 1000 })
          ),
          -1,
          true
        );
        break;

      case 'jump':
        scale.value = withSequence(
          withTiming(1.15, { duration: 100 }),
          withTiming(0.95, { duration: 100 }),
          withTiming(1.05, { duration: 100 }),
          withTiming(1, { duration: 100 })
        );
        translateY.value = withSequence(
          withTiming(-15, { duration: 150, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) })
        );
        break;

      case 'celebrate':
        scale.value = withSequence(
          withTiming(1.2, { duration: 100 }),
          withTiming(0.9, { duration: 100 }),
          withTiming(1.1, { duration: 100 }),
          withTiming(1, { duration: 100 })
        );
        translateY.value = withSequence(
          withTiming(-20, { duration: 200, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) })
        );
        rotation.value = withSequence(
          withTiming(0.1, { duration: 100 }),
          withTiming(-0.1, { duration: 100 }),
          withTiming(0.1, { duration: 100 }),
          withTiming(0, { duration: 100 })
        );
        break;

      case 'wave':
        translateX.value = withRepeat(
          withSequence(
            withTiming(-5, { duration: 100 }),
            withTiming(5, { duration: 100 })
          ),
          3,
          true
        );
        break;

      case 'pet':
        scale.value = withSequence(
          withTiming(0.9, { duration: 100 }),
          withTiming(1.05, { duration: 200 })
        );
        break;

      case 'hidden':
        opacity.value = withTiming(0, { duration: 200 });
        break;
    }

    const duration = getAnimationDuration(state);
    if (duration < Infinity) {
      setTimeout(() => {
        if (currentAnim.value === state) {
          currentAnim.value = 'idle';
          priority.value = 0;
        }
      }, duration + 200);
    }
  }, [currentAnim, priority, scale, opacity, translateY, translateX, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotation.value}rad` },
    ],
    opacity: opacity.value,
  }));

  return {
    currentAnim,
    play,
    animatedStyle,
    isAnimating: (state: AnimationState) => currentAnim.value === state,
    scale,
    opacity,
  };
}
