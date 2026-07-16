import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TextInput, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { formatDistanceToNow } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button, FormField, Text as Txt, KeyboardAvoidingWrapper } from 'src/components/ui';
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
  const [draftInfo, setDraftInfo] = useState<string | null>(null);

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

  if (entryLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingWrapper contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.lg }}>{isNew ? 'New Entry' : 'Edit Entry'}</Txt>

          {draftInfo && (
            <Txt variant="caption" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
              {draftInfo}
            </Txt>
          )}

          <FormField control={control} name="title" label="Title" placeholder="What's on your mind?" accessibilityLabel="Journal title" />
          <View style={{ height: theme.spacing.md }} />

          <Txt variant="bodySmall" color="secondary" style={{ marginBottom: theme.spacing.sm }}>Content</Txt>
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
                  placeholder="Write your thoughts..."
                  placeholderTextColor={theme.colors.textMuted}
                  accessibilityLabel="Journal content"
                  style={[
                    styles.textarea,
                    {
                      borderColor: error ? theme.colors.danger : theme.colors.border,
                      color: theme.colors.textPrimary,
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.radius.md,
                      padding: theme.spacing.md,
                      minHeight: 180,
                    },
                  ]}
                />
                {error && <Txt variant="caption" color="danger" style={{ marginTop: 4 }}>{error.message}</Txt>}
              </View>
            )}
          />

          <View style={{ height: theme.spacing.lg }} />
          <Button
            label={createMutation.isPending ? 'Saving...' : (isNew ? 'Save entry' : 'Update entry')}
            onPress={handleSubmit(onSubmit)}
            disabled={!formState.isValid || createMutation.isPending}
            fullWidth
          />
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  textarea: { borderWidth: 1, marginTop: 4, fontSize: 16, textAlignVertical: 'top' },
});
