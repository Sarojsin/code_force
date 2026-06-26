/**
 * MoodLogScreen — mood picker with intensity slider.
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Button, Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';
import type { WellnessStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<WellnessStackParamList, 'MoodLog'>;

const MOODS = [
  { emoji: '&#128522;', label: 'Happy', color: '#D1FAE5' },
  { emoji: '&#128529;', label: 'Neutral', color: '#FEF3C7' },
  { emoji: '&#128542;', label: 'Sad', color: '#BFDBFE' },
  { emoji: '&#128545;', label: 'Angry', color: '#FEE2E2' },
  { emoji: '&#128552;', label: 'Anxious', color: '#EDE9FE' },
  { emoji: '&#128564;', label: 'Tired', color: '#E5E7EB' },
  { emoji: '&#128525;', label: 'Loved', color: '#FCE7F3' },
  { emoji: '&#128170;', label: 'Motivated', color: '#DCFCE7' },
];

export function MoodLogScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(5);

  const MoodButton = ({ mood }: { mood: typeof MOODS[0] }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const isSelected = selectedMood === mood.label;
    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.92); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onPress={() => setSelectedMood(mood.label)}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={mood.label}
          style={[
            styles.moodBtn,
            {
              backgroundColor: isSelected ? mood.color : theme.colors.surface,
              borderColor: isSelected ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <Txt variant="h2">{mood.emoji}</Txt>
          <Txt variant="caption" color="primary" style={{ marginTop: 4 }}>{mood.label}</Txt>
        </Pressable>
      </Animated.View>
    );
  };

  const handleSave = async () => {
    try {
      logger.info('MoodLogScreen.save', { mood: selectedMood, intensity });
      navigation.goBack();
    } catch (err) {
      logger.error('MoodLogScreen.save.failed', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>How are you feeling?</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>Tap a mood to log it.</Txt>

        <View style={styles.grid}>
          {MOODS.map(m => <MoodButton key={m.label} mood={m} />)}
        </View>

        {selectedMood && (
          <Card style={{ marginTop: theme.spacing.xl }}>
            <Txt variant="bodySmall" color="secondary" style={{ marginBottom: theme.spacing.sm }}>Intensity: {intensity}</Txt>
            <View style={styles.sliderRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <Pressable
                  key={n}
                  onPress={() => setIntensity(n)}
                  accessibilityLabel={`Intensity ${n}`}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: n <= intensity ? theme.colors.primary : theme.colors.border,
                      width: n === intensity ? 32 : 20,
                      height: n === intensity ? 32 : 20,
                      borderRadius: 16,
                    },
                  ]}
                />
              ))}
            </View>
          </Card>
        )}

        <View style={{ height: theme.spacing.xl }} />
        <Button label="Save mood" onPress={handleSave} disabled={!selectedMood} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  moodBtn: { width: '23%', alignItems: 'center', paddingVertical: 12, borderWidth: 1, marginBottom: 12, minHeight: 72, justifyContent: 'center' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dot: { alignItems: 'center', justifyContent: 'center' },
});
