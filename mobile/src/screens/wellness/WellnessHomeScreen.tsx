import React from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import type { WellnessStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<WellnessStackParamList, 'WellnessHome'>;

interface QuickAction {
  label: string;
  subtitle: string;
  icon: string;
  screen: keyof WellnessStackParamList;
  color: string;
}

const ACTIONS: QuickAction[] = [
  { label: 'Journal', subtitle: 'Write your thoughts', icon: '📝', screen: 'JournalList', color: '#D1FAE5' },
  { label: 'Log Mood', subtitle: 'How are you feeling?', icon: '😊', screen: 'MoodLog', color: '#FEF3C7' },
  { label: 'Mood History', subtitle: 'Track emotional trends', icon: '📊', screen: 'MoodHistory', color: '#BFDBFE' },
  { label: 'Breathing', subtitle: 'Calm your mind', icon: '🧘', screen: 'BreathingList', color: '#EDE9FE' },
  { label: 'Insights', subtitle: 'Your wellness patterns', icon: '💡', screen: 'Insights', color: '#FCE7F3' },
];

function ActionCard({ action }: { action: QuickAction }) {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.95); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        onPress={() => navigation.navigate(action.screen as any)}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        style={[
          styles.card,
          {
            backgroundColor: action.color,
            borderRadius: theme.radius.lg,
          },
        ]}
      >
        <Txt variant="h2">{action.icon}</Txt>
        <Txt variant="h3" style={{ marginTop: theme.spacing.sm }}>{action.label}</Txt>
        <Txt variant="caption" color="secondary" style={{ marginTop: 2 }}>{action.subtitle}</Txt>
      </Pressable>
    </Animated.View>
  );
}

export function WellnessHomeScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1">Wellness</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.lg }}>
          Your daily wellness hub
        </Txt>

        <View style={styles.grid}>
          {ACTIONS.map(a => <ActionCard key={a.label} action={a} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%',
    padding: 16,
    marginBottom: 12,
    minHeight: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
