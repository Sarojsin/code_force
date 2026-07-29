import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Text } from './Text';

export interface MoodOption {
  id: string;
  label: string;
  emoji: string;
}

export const DESIGN_MOODS: MoodOption[] = [
  { id: 'radiant',   label: 'Radiant',   emoji: '✨' },
  { id: 'calm',      label: 'Calm',      emoji: '🌸' },
  { id: 'energized', label: 'Energized', emoji: '⚡' },
  { id: 'anxious',   label: 'Anxious',   emoji: '🌊' },
  { id: 'tired',     label: 'Tired',     emoji: '🌙' },
  { id: 'sad',       label: 'Sad',       emoji: '🌧️' },
];

export const DEFAULT_MOODS = DESIGN_MOODS;

const MOOD_COLORS: Record<string, { bg: string; selected: string; border: string }> = {
  radiant:   { bg: '#FFE8EF', selected: '#FF6B8A', border: '#FF6B8A33' },
  calm:      { bg: '#FAF0F4', selected: '#D4A5B5', border: '#D4A5B533' },
  energized: { bg: '#FFF4E3', selected: '#F5A623', border: '#F5A62333' },
  anxious:   { bg: '#E8F2FF', selected: '#6BA8E8', border: '#6BA8E833' },
  tired:     { bg: '#F0E8FA', selected: '#9B6BD4', border: '#9B6BD433' },
  sad:       { bg: '#EDF3FA', selected: '#7B9EC8', border: '#7B9EC833' },
};

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
  const colors = MOOD_COLORS[mood.id] ?? MOOD_COLORS.radiant;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isSelected ? 1.06 : 1, { damping: 12 }) }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.94, { damping: 12 }); }}
        onPressOut={() => { scale.value = withSpring(isSelected ? 1.06 : 1, { damping: 12 }); }}
        onPress={onPress}
        accessibilityLabel={mood.label}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        style={[
          styles.moodItem,
          isSelected
            ? { backgroundColor: colors.selected }
            : {
                backgroundColor: colors.bg,
                borderWidth: 1.5,
                borderColor: colors.border,
              },
          isSelected && {
            shadowColor: colors.selected,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.55,
            shadowRadius: 18,
            elevation: 6,
          },
        ]}
      >
        <Text style={styles.emoji}>{mood.emoji}</Text>
        <Text
          style={[
            styles.label,
            { color: isSelected ? '#FFFFFF' : '#2D1B26' },
          ]}
        >
          {mood.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function MoodPicker({ selected, onSelect, moods = DESIGN_MOODS }: MoodPickerProps) {
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
    gap: 10,
  },
  moodItem: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    minHeight: 68,
    width: '30%',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  emoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
});
