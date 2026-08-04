import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';

import { Card, StickyCard, DelayedBanner, Text, Button } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCreateMoodLog, useMoodLogs } from 'src/services/queries';
import { usePeriodCheckIn } from 'src/hooks/usePeriodCheckIn';
import { toLocalDateStr } from 'src/utils/date';
import type { CalendarResponse } from 'src/services/api';

type Nav = any;

const QUICK_MOODS = [
  { emoji: '😊', label: 'Happy', color: '#D1FAE5' },
  { emoji: '😐', label: 'Neutral', color: '#FEF3C7' },
  { emoji: '😢', label: 'Sad', color: '#BFDBFE' },
  { emoji: '😠', label: 'Angry', color: '#FEE2E2' },
  { emoji: '😰', label: 'Anxious', color: '#EDE9FE' },
  { emoji: '😴', label: 'Tired', color: '#E5E7EB' },
  { emoji: '🥰', label: 'Loved', color: '#FCE7F3' },
  { emoji: '💪', label: 'Motivated', color: '#DCFCE7' },
];

function todayDateStr(): string {
  return toLocalDateStr(new Date());
}

interface CheckInCardProps {
  calData?: CalendarResponse | null;
}

export function CheckInCard({ calData }: CheckInCardProps) {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const checkIn = usePeriodCheckIn(calData);
  const { data: moodLogs } = useMoodLogs();
  const createMoodLog = useCreateMoodLog();
  const [justLogged, setJustLogged] = useState<string | null>(null);

  const loggedToday = moodLogs?.find((m) => m.logged_at.slice(0, 10) === todayDateStr());
  const activeMoodLabel = loggedToday?.mood ?? justLogged ?? null;
  const activeMood = activeMoodLabel
    ? QUICK_MOODS.find((m) => m.label === activeMoodLabel) ?? null
    : null;

  const handleQuickLog = (mood: { emoji: string; label: string; color: string }) => {
    if (createMoodLog.isPending) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setJustLogged(mood.label);
    createMoodLog.mutate({ mood: mood.label, intensity: 5 });
  };

  return (
    <>
      {checkIn.visible && (
        <StickyCard
          predictedDate={checkIn.predictedDate}
          predictionId={checkIn.predictionId}
          visible
          loading={checkIn.loading}
          checkinPhase={checkIn.checkinPhase}
          daysOffset={checkIn.daysOffset}
          onConfirm={checkIn.onConfirm}
          onAdjust={checkIn.onAdjust}
          onSnooze={checkIn.onSnooze}
        />
      )}

      {checkIn.isExpired && (
        <DelayedBanner predictionId={checkIn.predictionId} />
      )}

      <Card variant="feature" elevated style={styles.card}>
        <View style={styles.header}>
          <Text variant="h3">Daily Check-in</Text>
          <Text variant="bodySmall" color="secondary">How are you feeling today?</Text>
        </View>

        {activeMood ? (
          <View style={styles.loggedRow}>
            <View
              style={[styles.loggedBubble, { backgroundColor: activeMood.color, borderRadius: theme.radius.pill }]}
            >
               <Text variant="emoji" style={styles.bubbleEmoji}>{activeMood.emoji}</Text>
            </View>
            <View style={styles.loggedText}>
              <Text variant="body" style={styles.loggedLabel}>{activeMood.label} — logged today</Text>
              <Text variant="caption" color="muted">Check in again anytime</Text>
            </View>
            <Button
              label="Update"
              size="sm"
              variant="outline"
              onPress={() => navigation.navigate('MoodLog')}
              accessibilityLabel="Update today's mood"
              style={styles.updateBtn}
            />
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodRow}>
              {QUICK_MOODS.map((m) => (
                <Pressable
                  key={m.label}
                  onPress={() => handleQuickLog(m)}
                  accessibilityRole="button"
                  accessibilityLabel={`Log mood ${m.label}`}
                  style={[styles.moodBtn, { backgroundColor: m.color, borderRadius: theme.radius.pill }]}
                >
                   <Text variant="emoji">{m.emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => navigation.navigate('MoodLog')}
              accessibilityRole="button"
              accessibilityLabel="Open full mood log"
              style={styles.moreLinkWrap}
            >
              <Text variant="bodySmall" color="primary" style={styles.actionLabel}>
                More options + add a note →
              </Text>
            </Pressable>
          </>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  header: { marginBottom: 12 },
  loggedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loggedBubble: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleEmoji: { fontSize: 20 },
  loggedText: { flex: 1, marginLeft: 12 },
  loggedLabel: { fontWeight: '600' },
  actionLabel: { fontWeight: '600' },
  updateBtn: {
    minWidth: 76,
    minHeight: 44,
  },
  moodRow: { flexGrow: 0 },
  moodBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  moodEmoji: { fontSize: 22 },
  moreLinkWrap: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 4,
  },
});
