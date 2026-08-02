import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from 'src/theme';

import { Text } from './Text';

export interface MoodOption {
  id: string;
  label: string;
  emoji: string;
}

export const MOOD_OPTIONS: MoodOption[] = [
  { id: 'happy',    label: 'Happy',    emoji: '😄' },
  { id: 'calm',     label: 'Calm',     emoji: '😊' },
  { id: 'tired',    label: 'Tired',    emoji: '😴' },
  { id: 'anxious',  label: 'Anxious',  emoji: '😟' },
  { id: 'sad',      label: 'Sad',      emoji: '😢' },
  { id: 'radiant',  label: 'Radiant',  emoji: '✨' },
];

export const DESIGN_MOODS = MOOD_OPTIONS;
export const DEFAULT_MOODS = MOOD_OPTIONS;

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
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isSelected ? 1.05 : 1, { damping: 12 }) }],
  }));

  const selectedBg = isSelected ? 'transparent' : theme.colors.primaryMuted;
  const selectedLabelColor = isSelected ? '#FFFFFF' : theme.colors.textDark;
  const moodCardStyle = [
    styles.moodItem,
    isSelected ? styles.moodItemSelected : styles.moodItemUnselected,
    {
      borderColor: theme.colors.primaryLight,
      backgroundColor: selectedBg,
    },
    isSelected && theme.shadow.primary,
  ];
  const moodLabelStyle = [
    styles.label,
    { color: selectedLabelColor },
  ];

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.94, { damping: 12 }); }}
        onPressOut={() => { scale.value = withSpring(isSelected ? 1.05 : 1, { damping: 12 }); }}
        onPress={onPress}
        accessibilityLabel={mood.label}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        style={moodCardStyle}
      >
        {isSelected && (
          <LinearGradient
            colors={['#FF6B8A', '#D4507A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Text style={styles.emoji}>{mood.emoji}</Text>
        <Text style={moodLabelStyle}>
          {mood.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function MoodPicker({ selected, onSelect, moods = MOOD_OPTIONS }: MoodPickerProps) {
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
    overflow: 'hidden',
  },
  moodItemSelected: {
    borderWidth: 0,
  },
  moodItemUnselected: {
    borderWidth: 1.5,
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
