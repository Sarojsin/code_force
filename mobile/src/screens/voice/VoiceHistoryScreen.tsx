/**
 * VoiceHistoryScreen — past voice journal entries.
 */

import React from 'react';
import { FlatList, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

interface VoiceEntry {
  id: string;
  title: string;
  duration: string;
  createdAt: string;
  hasTranscript: boolean;
  sentiment: string;
}

const MOCK_VOICES: VoiceEntry[] = [
  { id: '1', title: 'Morning thoughts', duration: '2:34', createdAt: 'Today, 8:30 AM', hasTranscript: true, sentiment: 'Positive' },
  { id: '2', title: 'Evening reflection', duration: '1:45', createdAt: 'Yesterday, 9:00 PM', hasTranscript: true, sentiment: 'Neutral' },
  { id: '3', title: 'After work feelings', duration: '3:12', createdAt: '2 days ago', hasTranscript: false, sentiment: 'Mixed' },
  { id: '4', title: 'Weekend plans', duration: '0:55', createdAt: '3 days ago', hasTranscript: true, sentiment: 'Happy' },
  { id: '5', title: 'Stress update', duration: '4:01', createdAt: '5 days ago', hasTranscript: true, sentiment: 'Anxious' },
];

const sentimentColors: Record<string, string> = {
  Positive: '#D1FAE5',
  Neutral: '#FEF3C7',
  Mixed: '#EDE9FE',
  Happy: '#D1FAE5',
  Anxious: '#FEE2E2',
};

export function VoiceHistoryScreen() {
  const theme = useTheme();

  const renderItem = ({ item }: { item: VoiceEntry }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.96); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          accessibilityRole="button"
          accessibilityLabel={`Voice journal: ${item.title}`}
        >
          <Card elevated style={{ marginBottom: theme.spacing.md }}>
            <View style={styles.row}>
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.pill }]}>
                <Txt variant="body" color="primary">&#9835;</Txt>
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <View style={styles.topRow}>
                  <Txt variant="h3">{item.title}</Txt>
                  <Txt variant="caption" color="muted">{item.duration}</Txt>
                </View>
                <View style={styles.metaRow}>
                  <Txt variant="caption" color="muted">{item.createdAt}</Txt>
                  <View style={[styles.sentimentBadge, { backgroundColor: sentimentColors[item.sentiment] ?? theme.colors.border, borderRadius: theme.radius.sm }]}>
                    <Txt variant="caption" color="primary">{item.sentiment}</Txt>
                  </View>
                </View>
                {!item.hasTranscript && <Txt variant="caption" color="muted">Transcript unavailable</Txt>}
              </View>
            </View>
          </Card>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={MOCK_VOICES}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Voice History</Txt>
            <Txt variant="body" color="secondary">Your past voice journal entries.</Txt>
          </View>
        }
        ListEmptyComponent={
          <Card><Txt variant="body" color="secondary" align="center">No voice journals yet.</Txt></Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sentimentBadge: { paddingHorizontal: 8, paddingVertical: 2 },
});
