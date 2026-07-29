import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

export interface ToggleProps {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_OFFSET = (TRACK_HEIGHT - THUMB_SIZE) / 2;

export function Toggle({ on, onChange, disabled }: ToggleProps) {
  const thumbAnim = useAnimatedStyle(() => ({
    transform: [
      { translateX: withSpring(on ? TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET : 0, {
        damping: 12,
        stiffness: 180,
      })},
    ],
  }));

  return (
    <Pressable
      onPress={() => !disabled && onChange(!on)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !!disabled }}
      accessibilityLabel={on ? 'Toggle on' : 'Toggle off'}
      style={[styles.track, { opacity: disabled ? 0.5 : 1 }]}
    >
      {on ? (
        <LinearGradient
          colors={['#FF6B8A', '#D4507A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(160,120,136,0.20)', borderRadius: 14 }]} />
      )}
      <Animated.View style={[styles.thumb, thumbAnim]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: 14,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    marginLeft: THUMB_OFFSET,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
});
