import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View, Pressable, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle as SvgCircle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Button, Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';
import { wellnessService } from 'src/services/api/wellness';

type Nav = any;

const MOODS = [
  { emoji: '😊', label: 'Happy', color: '#D1FAE5' },
  { emoji: '😐', label: 'Neutral', color: '#FEF3C7' },
  { emoji: '😢', label: 'Sad', color: '#BFDBFE' },
  { emoji: '😠', label: 'Angry', color: '#FEE2E2' },
  { emoji: '😰', label: 'Anxious', color: '#EDE9FE' },
  { emoji: '😴', label: 'Tired', color: '#E5E7EB' },
  { emoji: '🥰', label: 'Loved', color: '#FCE7F3' },
  { emoji: '💪', label: 'Motivated', color: '#DCFCE7' },
];

const MOCK_MOOD_TREND = [3, 5, 4, 6, 7, 5, 8];
const MOCK_MOOD_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function MoodTrendChart() {
  const theme = useTheme();
  const w = 280;
  const h = 100;
  const padding = { top: 10, bottom: 20, left: 10, right: 10 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;
  const stepX = plotW / (MOCK_MOOD_TREND.length - 1);

  const points = MOCK_MOOD_TREND.map((v, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + plotH - (v / 10) * plotH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={theme.colors.accent} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={theme.colors.accent} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#moodGrad)" />
        <Path d={linePath} fill="none" stroke={theme.colors.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <SvgCircle key={i} cx={p.x} cy={p.y} r="3.5" fill={theme.colors.surface} stroke={theme.colors.accent} strokeWidth="2" />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', width: w, paddingHorizontal: padding.left }}>
        {MOCK_MOOD_LABELS.map((m) => (
          <Txt key={m} variant="caption" color="muted" style={{ width: stepX, textAlign: 'center', fontSize: 9 }}>{m}</Txt>
        ))}
      </View>
    </View>
  );
}

export function MoodLogScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [selectedMood, setSelectedMood] = React.useState<string | null>(null);
  const [intensity, setIntensity] = React.useState(5);
  const [notes, setNotes] = React.useState('');

  const handleMoodSelect = useCallback((label: string) => {
    setSelectedMood(label);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const mutation = useMutation({
    mutationFn: (data: { mood: string; intensity: number; notes?: string }) =>
      wellnessService.createMoodLog(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness', 'mood'] });
      Toast.show({ type: 'success', text1: 'Mood logged!' });
      navigation.goBack();
    },
    onError: (err) => {
      logger.error('MoodLogScreen.save.failed', err);
      Toast.show({ type: 'error', text1: 'Failed to save mood' });
    },
  });

  const handleSave = () => {
    if (!selectedMood) return;
    mutation.mutate({ mood: selectedMood, intensity, notes: notes || undefined });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>How are you feeling?</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>Tap a mood to log it.</Txt>

        <View style={styles.grid}>
          {MOODS.map(m => {
            const isSelected = selectedMood === m.label;
            return (
              <Pressable
                key={m.label}
                onPress={() => handleMoodSelect(m.label)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={m.label}
                style={({ pressed }) => [
                  styles.moodBtn,
                  {
                    backgroundColor: isSelected ? m.color : theme.colors.surface,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    borderRadius: theme.radius.lg,
                    ...(pressed
                      ? { shadowColor: 'transparent', elevation: 0 }
                      : {
                          shadowColor: '#000',
                          shadowOffset: { width: 3, height: 4 },
                          shadowOpacity: 0.1,
                          shadowRadius: 6,
                          elevation: 4,
                        }),
                  },
                ]}
              >
                <Txt variant="h2">{m.emoji}</Txt>
                <Txt variant="caption" color="primary" style={{ marginTop: 4 }}>{m.label}</Txt>
              </Pressable>
            );
          })}
        </View>

        {selectedMood && (
          <Card style={{ marginTop: theme.spacing.xl }}>
            <Txt variant="bodySmall" color="secondary" style={{ marginBottom: theme.spacing.sm }}>Intensity: {intensity}</Txt>
            <View style={styles.sliderRow}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
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

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note (optional)"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.notesInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary, borderRadius: theme.radius.md }]}
              accessibilityLabel="Mood note"
            />
          </Card>
        )}

        <View style={{ height: theme.spacing.xl }} />
        <Button
          label={mutation.isPending ? 'Saving...' : 'Save mood'}
          onPress={handleSave}
          disabled={!selectedMood || mutation.isPending}
          fullWidth
        />

        {/* Mood Trend Section */}
        <Txt variant="h2" style={{ marginTop: 32, marginBottom: 4 }}>Your Mood Trend</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: 16 }}>Weekly overview</Txt>

        <Card style={{ paddingVertical: 16 }}>
          <MoodTrendChart />
        </Card>

        <View style={[styles.summaryRow, { marginTop: 12 }]}>
          <Card style={{ flex: 1, marginRight: 6 }} padded>
            <Txt variant="h2" color="accent" align="center">7.2</Txt>
            <Txt variant="caption" color="muted" align="center">Avg mood /10</Txt>
          </Card>
          <Card style={{ flex: 1, marginLeft: 6 }} padded>
            <Txt variant="h2" color="primary" align="center">3</Txt>
            <Txt variant="caption" color="muted" align="center">Low days</Txt>
          </Card>
        </View>

        <Card style={{ marginTop: 12, backgroundColor: theme.colors.primaryMuted + '40' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Txt variant="body" style={{ marginRight: 6 }}>🤖</Txt>
            <Txt variant="bodySmall" style={{ color: theme.colors.accent, fontWeight: '600' }}>AI Insight</Txt>
          </View>
          <Txt variant="bodySmall" color="secondary">
            Your mood shows an upward trend this week. Happy and Motivated are your most frequent moods. 
            Consider tracking activities that correlate with your high-mood days.
          </Txt>
        </Card>
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
  notesInput: { borderWidth: 1, marginTop: 12, padding: 12, fontSize: 14, minHeight: 44 },
  summaryRow: { flexDirection: 'row' },
});
