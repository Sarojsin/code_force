import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TextInput, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { formatDistanceToNow, format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';

import { Button, Text as Txt, KeyboardAvoidingWrapper } from 'src/components/ui';

import { useTheme } from 'src/theme';
import { EncryptedStorage } from 'src/services/storage';
import { logger } from 'src/utils';
import { wellnessService } from 'src/services/api/wellness';
import { z } from 'zod';

type Nav = any;
type Rt = any;

const DRAFT_KEY = (id: string) => `shecare.journal.draft.${id}`;
const DRAFT_SAVE_INTERVAL_MS = 30_000;

const journalSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, 'Content is required'),
});
type JournalForm = z.infer<typeof journalSchema>;

const MOODS = [
  { emoji: '😊', label: 'Happy', color: '#FFD93D' },
  { emoji: '😌', label: 'Calm', color: '#A8E6CF' },
  { emoji: '😴', label: 'Tired', color: '#B8D4E3' },
  { emoji: '😰', label: 'Anxious', color: '#FFB3BA' },
  { emoji: '😢', label: 'Sad', color: '#B0BEC5' },
  { emoji: '🌟', label: 'Radiant', color: '#FFD700' },
];

const ENERGY_LEVELS = [
  { emoji: '🪫', label: 'Drained' },
  { emoji: '😴', label: 'Low' },
  { emoji: '😊', label: 'Medium' },
  { emoji: '⚡', label: 'High' },
  { emoji: '🚀', label: 'Max' },
];

const SYMPTOMS = ['Cramps', 'Bloating', 'Headache', 'Fatigue', 'Nausea', 'Backache'];

export function JournalEntryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const queryClient = useQueryClient();
  const { id } = route.params;
  const isNew = id === 'new';
  const [_draftInfo, setDraftInfo] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  function MoodButton({ emoji, label, color, selected, onPress }: any) {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.9); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onPress={onPress}
          accessibilityLabel={`${label} mood`}
          accessibilityRole="button"
          accessibilityHint={`Select ${label} mood`}
          style={[
            styles.moodBtn,
            { borderRadius: 16, backgroundColor: selected ? color : 'rgba(0,0,0,0.04)' },
            selected && { shadowColor: color, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
          ]}
        >
          <Txt style={{ fontSize: 28 }}>{emoji}</Txt>
          <Txt variant="caption" style={{ color: selected ? theme.colors.textPrimary : theme.colors.textSoft, marginTop: 4 }}>{label}</Txt>
        </Pressable>
      </Animated.View>
    );
  }

  function EnergyButton({ emoji, label, selected, onPress }: any) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.energyBtn,
          { borderRadius: 16 },
          selected && { backgroundColor: theme.colors.primary },
          !selected && { backgroundColor: 'rgba(0,0,0,0.04)' },
        ]}
      >
          <Txt style={{ fontSize: 24 }}>{emoji}</Txt>
          <Txt variant="caption" style={{ color: selected ? '#fff' : theme.colors.textSoft, fontSize: 9 }}>{label}</Txt>
      </Pressable>
    );
  }

  const { control, handleSubmit, formState, watch, reset } = useForm<JournalForm>({
    resolver: zodResolver(journalSchema),
    defaultValues: { title: '', content: '' },
    mode: 'onBlur',
  });

  const { data: existingEntry, isLoading: entryLoading } = useQuery({
    queryKey: ['wellness', 'journal', id],
    queryFn: () => wellnessService.getJournalEntry(id),
    enabled: !isNew,
  });

  useEffect(() => {
    if (existingEntry) {
      reset({ title: existingEntry.title ?? '', content: existingEntry.content });
    }
  }, [existingEntry, reset]);

  useEffect(() => {
    (async () => {
      if (!isNew) return;
      try {
        const raw = await EncryptedStorage.getItem(DRAFT_KEY(id));
        if (raw) {
          const draft = JSON.parse(raw);
          reset({ title: draft.title || '', content: draft.content || '' });
          if (draft.savedAt) {
            setDraftInfo(`Draft from ${formatDistanceToNow(new Date(draft.savedAt))} ago`);
          }
        }
      } catch {}
    })();
  }, [id, reset, isNew]);

  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isNew) return;
    autoSaveTimer.current = setInterval(async () => {
      const values = watch();
      if (values.title || values.content) {
        try {
          await EncryptedStorage.setItem(
            DRAFT_KEY(id),
            JSON.stringify({ title: values.title, content: values.content, savedAt: new Date().toISOString() }),
          );
        } catch (err) {
          logger.error('JournalEntryScreen.autoSave.failed', err);
        }
      }
    }, DRAFT_SAVE_INTERVAL_MS);
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, [id, watch, isNew]);

  useEffect(() => {
    if (!isNew) return;
    const unsub = navigation.addListener('beforeRemove', async () => {
      const values = watch();
      if (values.title || values.content) {
        await EncryptedStorage.setItem(
          DRAFT_KEY(id),
          JSON.stringify({ title: values.title, content: values.content, savedAt: new Date().toISOString() }),
        );
      }
    });
    return unsub;
  }, [navigation, id, watch, isNew]);

  const createMutation = useMutation({
    mutationFn: (data: { title?: string; content: string }) =>
      wellnessService.createJournalEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness', 'journal'] });
      Toast.show({ type: 'success', text1: 'Journal entry saved' });
      navigation.goBack();
    },
    onError: (err) => {
      logger.error('JournalEntryScreen.save.failed', err);
      Toast.show({ type: 'error', text1: 'Failed to save entry' });
    },
  });

  const onSubmit = async (data: JournalForm) => {
    if (isNew) {
      await EncryptedStorage.removeItem(DRAFT_KEY(id));
    }
    createMutation.mutate({ title: data.title, content: data.content });
  };

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s],
    );
  };

  const contentValue = watch('content');
  const sentimentBadge = contentValue && contentValue.length > 20
    ? (contentValue.includes('happy') || contentValue.includes('love') || contentValue.includes('grateful')
        ? { emoji: '✨', label: 'Positive vibes' }
        : contentValue.includes('sad') || contentValue.includes('tired') || contentValue.includes('anxious')
          ? { emoji: '💭', label: 'Reflective tone' }
          : { emoji: '🤖', label: 'Neutral tone' })
    : null;

  if (entryLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingWrapper>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <Txt style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSoft, letterSpacing: 1 }}>
            {format(new Date(), 'EEEE · MMMM d, yyyy').toUpperCase()}
          </Txt>
          <Txt variant="h1" style={{ marginTop: 4, fontSize: 28, marginBottom: 20 }}>
            {isNew ? "Today's Entry" : 'Edit Entry'}
          </Txt>

          <Txt variant="body" color="muted" style={{ fontSize: 12, letterSpacing: 0.5, marginBottom: 8 }}>HOW ARE YOU FEELING?</Txt>
          <View style={styles.moodGrid}>
            {MOODS.map((m) => (
              <MoodButton
                key={m.label}
                emoji={m.emoji}
                label={m.label}
                color={m.color}
                selected={selectedMood === m.label}
                onPress={() => setSelectedMood(m.label)}
              />
            ))}
          </View>

          <Txt variant="body" color="muted" style={{ fontSize: 12, letterSpacing: 0.5, marginTop: 20, marginBottom: 8 }}>ENERGY LEVEL</Txt>
          <View style={styles.energyRow}>
            {ENERGY_LEVELS.map((e, i) => (
              <EnergyButton
                key={e.label}
                emoji={e.emoji}
                label={e.label}
                selected={energyLevel === i}
                onPress={() => setEnergyLevel(i)}
              />
            ))}
          </View>

          <Txt variant="body" color="muted" style={{ fontSize: 12, letterSpacing: 0.5, marginTop: 20, marginBottom: 8 }}>SYMPTOMS</Txt>
          <View style={styles.symptomRow}>
            {SYMPTOMS.map((s) => {
              const active = selectedSymptoms.includes(s);
              return (
                <Pressable
                  key={s}
                  onPress={() => toggleSymptom(s)}
                  style={[
                    styles.symptomPill,
                    { borderRadius: 100 },
                    active ? { backgroundColor: theme.colors.primary } : { backgroundColor: theme.colors.surface + 'BF', borderColor: theme.colors.primary + '44', borderWidth: 1 },
                    active && { shadowColor: theme.colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
                  ]}
                >
                  <Txt variant="body" style={{ color: active ? '#fff' : theme.colors.textSoft, fontSize: 13 }}>
                    {s}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          {selectedSymptoms.length > 0 && (
            <Txt variant="caption" color="muted" style={{ marginTop: 6, marginLeft: 4 }}>
              {selectedSymptoms.length} symptom{selectedSymptoms.length > 1 ? 's' : ''} logged
            </Txt>
          )}

          <Txt variant="body" color="muted" style={{ fontSize: 12, letterSpacing: 0.5, marginTop: 20, marginBottom: 8 }}>YOUR THOUGHTS</Txt>
          <View style={styles.textareaWrapper}>
            {sentimentBadge && (
              <View style={[styles.sentimentBadge, { backgroundColor: theme.colors.accentMuted, borderRadius: 100 }]}>
                <Txt style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '600' }}>
                  {sentimentBadge.emoji} {sentimentBadge.label}
                </Txt>
              </View>
            )}
            <Controller
              control={control}
              name="content"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <View>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    multiline
                    numberOfLines={8}
                    placeholder="What's on your mind today?"
                    placeholderTextColor={theme.colors.textSoft}
                    accessibilityLabel="Journal content"
                    style={[
                      styles.textarea,
                      {
                        color: theme.colors.textPrimary,
                        minHeight: 180,
                      },
                    ]}
                  />
                  <View style={styles.textareaFooter}>
                    <Txt variant="caption" color="muted">{(value || '').length} chars</Txt>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable style={[styles.attachBtn, { backgroundColor: theme.colors.border, borderRadius: 100 }]}>
                        <Txt style={{ fontSize: 14 }}>📷</Txt>
                      </Pressable>
                      <Pressable style={[styles.attachBtn, { backgroundColor: theme.colors.border, borderRadius: 100 }]}>
                        <Txt style={{ fontSize: 14 }}>🎤</Txt>
                      </Pressable>
                    </View>
                  </View>
                  {error && <Txt variant="caption" color="danger" style={{ marginTop: 4 }}>{error.message}</Txt>}
                </View>
              )}
            />
          </View>

          <View style={{ height: 20 }} />
          <Button
            label="💾 Save Entry"
            onPress={handleSubmit(onSubmit)}
            disabled={!formState.isValid || createMutation.isPending}
            fullWidth
            size="lg"
          />
          <Pressable
            onPress={() => navigation.navigate('JournalList')}
            style={{ marginTop: 12, alignItems: 'center' }}
          >
            <Txt variant="body" color="muted">📖 View Past Entries</Txt>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodBtn: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  energyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  energyBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  symptomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  symptomPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textareaWrapper: {
    position: 'relative',
  },
  sentimentBadge: {
    position: 'absolute',
    top: -10,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 1,
  },
  textarea: {
    fontSize: 15,
    fontStyle: 'italic',
    textAlignVertical: 'top',
    paddingTop: 16,
    paddingHorizontal: 0,
    lineHeight: 22,
  },
  textareaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  attachBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
