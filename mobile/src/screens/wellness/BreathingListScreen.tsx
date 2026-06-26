/**
 * BreathingListScreen — list of breathing exercises from API.
 */

import React, { useState } from 'react';
import { FlatList, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

interface Exercise {
  id: string;
  name: string;
  duration: string;
  description: string;
  color: string;
}

const EXERCISES: Exercise[] = [
  { id: '1', name: 'Box Breathing', duration: '4 min', description: 'Inhale 4s, hold 4s, exhale 4s, hold 4s', color: '#D1FAE5' },
  { id: '2', name: '4-7-8 Breathing', duration: '5 min', description: 'Inhale 4s, hold 7s, exhale 8s', color: '#BFDBFE' },
  { id: '3', name: 'Deep Belly Breathing', duration: '3 min', description: 'Slow deep breaths into your belly', color: '#EDE9FE' },
  { id: '4', name: 'Energizing Breath', duration: '2 min', description: 'Quick inhales, slow exhales to boost energy', color: '#FEF3C7' },
  { id: '5', name: 'Calming Breath', duration: '5 min', description: 'Extended exhales to activate relaxation', color: '#FCE7F3' },
];

export function BreathingListScreen() {
  const theme = useTheme();
  const [activeId, setActiveId] = useState<string | null>(null);

  const renderItem = ({ item }: { item: Exercise }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const isActive = activeId === item.id;

    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.96); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onPress={() => setActiveId(isActive ? null : item.id)}
          accessibilityRole="button"
          accessibilityLabel={`Breathing exercise: ${item.name}`}
        >
          <Card elevated style={{ marginBottom: theme.spacing.md, borderLeftWidth: 4, borderLeftColor: item.color }} accessibilityLabel={item.name}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Txt variant="h3">{item.name}</Txt>
                <Txt variant="bodySmall" color="secondary" style={{ marginTop: 2 }}>{item.duration}</Txt>
                <Txt variant="caption" color="muted" style={{ marginTop: 4 }}>{item.description}</Txt>
              </View>
              <View style={[styles.badge, { backgroundColor: item.color, borderRadius: theme.radius.pill }]}>
                <Txt variant="caption" color="primary">{item.duration}</Txt>
              </View>
            </View>
            {isActive && (
              <View style={[{ backgroundColor: item.color, borderRadius: theme.radius.md, marginTop: theme.spacing.md, padding: theme.spacing.md }]}>
                <Txt variant="bodySmall" align="center" color="primary">Follow the guided rhythm...</Txt>
              </View>
            )}
          </Card>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={EXERCISES}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Breathing Exercises</Txt>
            <Txt variant="body" color="secondary">Guided exercises to calm your mind.</Txt>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  badge: { paddingHorizontal: 10, paddingVertical: 4 },
});
