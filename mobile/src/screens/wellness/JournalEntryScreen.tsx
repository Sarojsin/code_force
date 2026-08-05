import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TextInput, ActivityIndicator, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { formatDistanceToNow, format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';

import { Button, Text as Txt, KeyboardAvoidingWrapper, MoodPicker, Card } from 'src/components/ui';
import { ScreenContainer } from 'src/components/core';

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

function SectionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Card variant="glass" style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.md }]}>
          <Txt style={styles.sectionIcon}>{icon}</Txt>
        </View>
        <Txt variant="body" style={styles.sectionTitle}>{title}</Txt>
      </View>
      {children}
    </Card>
  );
}

export function JournalEntryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const queryClient = useQueryClient();
  const { id } = route.params;
  const isNew = id === 'new';
  const [draftInfo, setDraftInfo] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  const { control, handleSubmit, formState, watch, reset } = useForm<JournalForm>({
    resolver: zodResolver(journalSchema),
    defaultValues: { title: '', content: '' },
    mode: 'onChange',
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
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!isNew) return;
    autoSaveTimer.current = setInterval(async () => {
      if (submittedRef.current) return;
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
      if (submittedRef.current) return;
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
      if (isNew) EncryptedStorage.removeItem(DRAFT_KEY(id));
      queryClient.invalidateQueries({ queryKey: ['wellness', 'journal'] });
      Toast.show({ type: 'success', text1: 'Journal entry saved' });
      navigation.goBack();
    },
    onError: (err: any) => {
      submittedRef.current = false;
      const code = err?.response?.data?.error?.code ?? err?.code;
      if (code === 'DAILY_JOURNAL_LIMIT') {
        Toast.show({ type: 'info', text1: 'Daily limit reached', text2: 'You can save up to 3 journal entries per day' });
      } else {
        logger.error('JournalEntryScreen.save.failed', err);
        Toast.show({ type: 'error', text1: 'Failed to save entry' });
      }
    },
  });

  const onSubmit = async (data: JournalForm) => {
    submittedRef.current = true;
    if (autoSaveTimer.current) {
      clearInterval(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
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
      <ScreenContainer style={{ backgroundColor: theme.colors.background }}>
        <View style={[styles.loadingCenter]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={{ backgroundColor: theme.colors.background }}>
      <LinearGradient
        colors={[theme.colors.accentLight + '59', 'transparent']}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <KeyboardAvoidingWrapper contentContainerStyle={styles.content}>
        <Txt style={[styles.dateLabel, { color: theme.colors.textSoft }]}>
          {format(new Date(), 'EEEE · MMMM d, yyyy').toUpperCase()}
        </Txt>
        <View style={styles.titleRow}>
          <Txt variant="h1" style={styles.title}>
            {isNew ? "Today's Entry" : 'Edit Entry'}
          </Txt>
          <LinearGradient
            colors={['#FF6B8A', '#D4507A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleAccent}
          />
        </View>
        {draftInfo && (
          <Txt variant="caption" color="muted" style={styles.draftInfo}>{draftInfo} · auto-saved</Txt>
        )}

        <SectionCard icon="💫" title="How are you feeling?">
          <MoodPicker selected={selectedMood} onSelect={setSelectedMood} />
        </SectionCard>

        <Txt variant="body" color="muted" style={styles.thoughtsLabel}>YOUR THOUGHTS</Txt>
        <View style={styles.textareaWrapper}>
          {sentimentBadge && (
            <View style={[styles.sentimentBadge, { backgroundColor: theme.colors.accentMuted }]}>
                <Txt variant="emoji" style={[styles.sentimentText, { color: theme.colors.accent }]}>
                {sentimentBadge.emoji} {sentimentBadge.label}
              </Txt>
            </View>
          )}
          <Card variant="flat" style={styles.noteCard}>
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
          </Card>
        </View>

        <View style={styles.spacer} />
        <Button
          label="Save Entry"
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
    </ScreenContainer>
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
  titleRow: {
    marginTop: 4,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
  },
  titleAccent: {
    width: 48,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  draftInfo: {
    marginTop: -12,
    marginBottom: 16,
  },
  sectionCard: {
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontWeight: '600' },
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
    fontSize: 14,
    fontWeight: '600',
  },
  noteCard: {
    padding: 16,
  },
  textarea: {
    fontSize: 15,
    textAlignVertical: 'top',
    paddingTop: 4,
    paddingHorizontal: 0,
    lineHeight: 22,
  },
  textareaInput: {
    minHeight: 160,
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
