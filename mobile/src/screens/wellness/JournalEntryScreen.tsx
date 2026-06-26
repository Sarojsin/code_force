import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, TextInput } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { StackNavigationProp } from '@react-navigation/stack';
import { formatDistanceToNow } from 'date-fns';

import { Button, FormField, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { EncryptedStorage } from 'src/services/storage';
import { logger } from 'src/utils';
import type { WellnessStackParamList } from 'src/navigation/types';
import { z } from 'zod';

type Nav = StackNavigationProp<WellnessStackParamList, 'JournalEntry'>;
type Rt = RouteProp<WellnessStackParamList, 'JournalEntry'>;

const DRAFT_KEY = (id: string) => `shecare.journal.draft.${id}`;
const DRAFT_SAVE_INTERVAL_MS = 30_000;

const journalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  content: z.string().min(1, 'Content is required'),
});
type JournalForm = z.infer<typeof journalSchema>;

export function JournalEntryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { id } = route.params;
  const isEditing = id !== 'new';
  const [draftInfo, setDraftInfo] = useState<string | null>(null);

  const { control, handleSubmit, formState, watch, reset } = useForm<JournalForm>({
    resolver: zodResolver(journalSchema),
    defaultValues: { title: '', content: '' },
    mode: 'onBlur',
  });

  useEffect(() => {
    (async () => {
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
  }, [id, reset]);

  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    autoSaveTimer.current = setInterval(async () => {
      const values = watch();
      if (values.title || values.content) {
        try {
          await EncryptedStorage.setItem(
            DRAFT_KEY(id),
            JSON.stringify({ title: values.title, content: values.content, savedAt: new Date().toISOString() }),
          );
          Toast.show({ type: 'success', text1: 'Draft saved', visibilityTime: 1500 });
        } catch (err) {
          logger.error('JournalEntryScreen.autoSave.failed', err);
        }
      }
    }, DRAFT_SAVE_INTERVAL_MS);
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, [id, watch]);

  useEffect(() => {
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
  }, [navigation, id, watch]);

  const onSubmit = async (data: JournalForm) => {
    try {
      await EncryptedStorage.removeItem(DRAFT_KEY(id));
      logger.info('JournalEntryScreen.submit', { id, ...data });
      navigation.goBack();
    } catch (err) {
      logger.error('JournalEntryScreen.submit.failed', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { padding: theme.spacing.lg }]} keyboardShouldPersistTaps="handled">
          <Txt variant="h1" style={{ marginBottom: theme.spacing.lg }}>{isEditing ? 'Edit Entry' : 'New Entry'}</Txt>

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
          <Button label={isEditing ? 'Update entry' : 'Save entry'} onPress={handleSubmit(onSubmit)} disabled={!formState.isValid} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  textarea: { borderWidth: 1, marginTop: 4, fontSize: 16, textAlignVertical: 'top' },
});
