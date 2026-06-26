import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Text } from './Text';

export interface MoodOption {
  id: string;
  label: string;
  emoji: string;
}

export const DEFAULT_MOODS: MoodOption[] = [
  { id: 'happy', label: 'Happy', emoji: '😊' },
  { id: 'calm', label: 'Calm', emoji: '😌' },
  { id: 'energetic', label: 'Energetic', emoji: '⚡' },
  { id: 'anxious', label: 'Anxious', emoji: '😰' },
  { id: 'sad', label: 'Sad', emoji: '😢' },
  { id: 'irritable', label: 'Irritable', emoji: '😤' },
  { id: 'tired', label: 'Tired', emoji: '😴' },
  { id: 'grateful', label: 'Grateful', emoji: '🙏' },
];

export interface MoodPickerProps {
  selected?: string | null;
  onSelect: (id: string) => void;
  moods?: MoodOption[];
}

function MoodItem({
  mood,
  isSelected,
  onPress,
}: {
  mood: MoodOption;
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.88, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        onPress={onPress}
        accessibilityLabel={mood.label}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        style={({ pressed }) => [
          styles.moodItem,
          { minHeight: 44, minWidth: 44 },
          isSelected && styles.moodSelected,
          pressed && !isSelected && styles.moodPressed,
        ]}
      >
        <Text variant="h1">{mood.emoji}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function MoodPicker({ selected, onSelect, moods = DEFAULT_MOODS }: MoodPickerProps) {
  return (
    <View style={styles.grid} accessibilityLabel="Mood picker" accessibilityRole="radiogroup">
      {moods.map((mood) => (
        <MoodItem
          key={mood.id}
          mood={mood}
          isSelected={selected === mood.id}
          onPress={() => onSelect(mood.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  moodItem: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 8,
  },
  moodSelected: {
    backgroundColor: '#FFF1F4',
    borderWidth: 2,
    borderColor: '#E63462',
    borderRadius: 12,
  },
  moodPressed: {
    opacity: 0.7,
  },
});
