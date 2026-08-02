import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TextInput, ActivityIndicator, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { formatDistanceToNow, format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button, Text as Txt, KeyboardAvoidingWrapper, MoodPicker, Card } from 'src/components/ui';

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

export function JournalEntryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const queryClient = useQueryClient();
  const { id } = route.params;
  const isNew = id === 'new';
  const [_draftInfo, setDraftInfo] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

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
      setSelectedMood(existingEntry.mood ?? null);
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
    mutationFn: (data: { title?: string; content: string; mood?: string | null }) =>
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
    createMutation.mutate({ title: data.title, content: data.content, mood: selectedMood });
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
      <SafeAreaView style={[styles.safe, styles.loadingCenter, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingWrapper contentContainerStyle={styles.content}>
          <Txt style={[styles.dateLabel, { color: theme.colors.textSoft }]}>
            {format(new Date(), 'EEEE · MMMM d, yyyy').toUpperCase()}
          </Txt>
          <Txt variant="h1" style={styles.title}>
            {isNew ? "Today's Entry" : 'Edit Entry'}
          </Txt>

          <Card variant="glass" style={styles.moodCard}>
            <Txt variant="body" color="muted" style={styles.sectionLabel}>HOW ARE YOU FEELING?</Txt>
            <MoodPicker selected={selectedMood} onSelect={setSelectedMood} />
          </Card>

          <Txt variant="body" color="muted" style={styles.thoughtsLabel}>YOUR THOUGHTS</Txt>
          <View style={styles.textareaWrapper}>
            {sentimentBadge && (
              <View style={[styles.sentimentBadge, { backgroundColor: theme.colors.accentMuted }]}>
                <Txt style={[styles.sentimentText, { color: theme.colors.accent }]}>
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
                      styles.textareaInput,
                      { color: theme.colors.textPrimary },
                    ]}
                  />
                  <View style={styles.textareaFooter}>
                    <Txt variant="caption" color="muted">{(value || '').length} chars</Txt>
                  </View>
                  {error && <Txt variant="caption" style={[styles.errorText, { color: theme.colors.danger }]}>{error.message}</Txt>}
                </View>
              )}
            />
          </View>

          <View style={styles.spacer} />
          <Button
            label="💾 Save Entry"
            onPress={handleSubmit(onSubmit)}
            disabled={!formState.isValid || createMutation.isPending}
            fullWidth
            size="lg"
          />
          <Pressable
            onPress={() => navigation.navigate('JournalList')}
            style={styles.viewPastBtn}
          >
            <Txt variant="body" color="muted">📖 View Past Entries</Txt>
          </Pressable>
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loadingCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    marginTop: 4,
    fontSize: 28,
    marginBottom: 20,
  },
  moodCard: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  thoughtsLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
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
    borderRadius: 100,
    zIndex: 1,
  },
  sentimentText: {
    fontSize: 11,
    fontWeight: '600',
  },
  textarea: {
    fontSize: 15,
    textAlignVertical: 'top',
    paddingTop: 16,
    paddingHorizontal: 0,
    lineHeight: 22,
  },
  textareaInput: {
    minHeight: 180,
  },
  textareaFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  errorText: {
    marginTop: 4,
  },
  spacer: {
    height: 20,
  },
  viewPastBtn: {
    marginTop: 12,
    alignItems: 'center',
  },
});
