/**
 * AdminContentManagementScreen — single-admin content management.
 *
 * Lets an admin create, edit, list, and delete educational content
 * (articles / videos / images) that appears in the user-facing Health
 * Library. New content is auto-approved (single-admin model).
 *
 * Uses React Query for server state, react-hook-form + zod for the form
 * (rule 2.5), and FlatList for the list (rule 2.7).
 */

import React from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Text as Txt, Card, Button, EmptyState, Loader } from 'src/components/ui';
import { useTheme } from 'src/theme';
import {
  nurseContentService,
  NurseContent,
  ContentCreate,
} from 'src/services/api/nurse_content';

const CONTENT_TYPES = ['article', 'video', 'image'] as const;

const contentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  category: z.string().min(2, 'Category is required').max(50),
  content_type: z.enum(['article', 'video', 'image']),
  summary: z.string().optional(),
  body: z.string().optional(),
  video_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  thumbnail_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  video_duration_seconds: z.string().optional(),
  tags: z.string().optional(),
});

type ContentFormValues = z.infer<typeof contentSchema>;

export function AdminContentManagementScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState<NurseContent | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ContentFormValues>({
    resolver: zodResolver(contentSchema),
    defaultValues: { content_type: 'article' },
  });

  const contentType = watch('content_type');

  const {
    data: contents,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-contents'],
    queryFn: () => nurseContentService.getAllContents({ limit: 200 }),
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data: ContentCreate) => nurseContentService.createContent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contents'] });
      queryClient.invalidateQueries({ queryKey: ['nurse-contents'] });
      reset();
      Alert.alert('Saved', 'Content published to the Health Library.');
    },
    onError: () => Alert.alert('Error', 'Could not save content. Please try again.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContentCreate }) =>
      nurseContentService.updateContent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contents'] });
      queryClient.invalidateQueries({ queryKey: ['nurse-contents'] });
      setEditing(null);
      reset({ content_type: 'article' });
      Alert.alert('Saved', 'Content updated.');
    },
    onError: () => Alert.alert('Error', 'Could not update content.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => nurseContentService.deleteContent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contents'] });
      queryClient.invalidateQueries({ queryKey: ['nurse-contents'] });
      Alert.alert('Deleted', 'Content removed from the library.');
    },
    onError: () => Alert.alert('Error', 'Could not delete content.'),
  });

  const onSubmit = (values: ContentFormValues) => {
    const payload: ContentCreate = {
      title: values.title,
      category: values.category,
      content_type: values.content_type,
      summary: values.summary || null,
      body: values.body || null,
      video_url: values.video_url || null,
      thumbnail_url: values.thumbnail_url || null,
      video_duration_seconds: values.video_duration_seconds
        ? Number(values.video_duration_seconds)
        : null,
      tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const onEdit = (item: NurseContent) => {
    setEditing(item);
    reset({
      title: item.title,
      category: item.category,
      content_type: item.content_type,
      summary: item.summary ?? '',
      body: item.body ?? '',
      video_url: item.video_url ?? '',
      thumbnail_url: item.thumbnail_url ?? '',
      video_duration_seconds: item.video_duration_seconds
        ? String(item.video_duration_seconds)
        : '',
      tags: (item.tags ?? []).join(', '),
    });
  };

  const onDelete = (item: NurseContent) => {
    Alert.alert('Delete content?', `"${item.title}" will be removed from the library.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <Loader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Txt variant="h1" style={styles.title}>
          {editing ? 'Edit Content' : 'New Health Content'}
        </Txt>
        <Txt variant="body" color="secondary" style={styles.subtitle}>
          {editing
            ? 'Update the content below. Changes publish immediately.'
            : 'Publish a video, image, or article to the Health Library.'}
        </Txt>

        <Card style={styles.formCard}>
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, value } }) => (
              <View style={styles.field}>
                <Txt variant="caption">Title *</Txt>
                <TextInput
                  style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                  value={value}
                  onChangeText={onChange}
                  placeholder="e.g. Breathing exercises for calm"
                  placeholderTextColor={theme.colors.textMuted}
                  accessibilityLabel="Content title"
                />
                {errors.title ? (
                  <Txt variant="caption" color="danger">{errors.title.message}</Txt>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="category"
            render={({ field: { onChange, value } }) => (
              <View style={styles.field}>
                <Txt variant="caption">Category *</Txt>
                <TextInput
                  style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                  value={value}
                  onChangeText={onChange}
                  placeholder="wellness, nutrition, pregnancy, safety"
                  placeholderTextColor={theme.colors.textMuted}
                  accessibilityLabel="Content category"
                />
                {errors.category ? (
                  <Txt variant="caption" color="danger">{errors.category.message}</Txt>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="content_type"
            render={({ field: { onChange, value } }) => (
              <View style={styles.field}>
                <Txt variant="caption">Content Type *</Txt>
                <View style={styles.typeRow}>
                  {CONTENT_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => onChange(type)}
                      style={[
                        styles.typeChip,
                        value === type && { backgroundColor: theme.colors.primary },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={'Content type: ' + type}
                    >
                      <Txt
                        variant="caption"
                        style={{ color: value === type ? theme.colors.textInverse : theme.colors.textPrimary }}
                      >
                        {type}
                      </Txt>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          />

          <Controller
            control={control}
            name="summary"
            render={({ field: { onChange, value } }) => (
              <View style={styles.field}>
                <Txt variant="caption">Summary</Txt>
                <TextInput
                  style={[styles.input, styles.multiline, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                  value={value}
                  onChangeText={onChange}
                  placeholder="Short description shown in the library"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  numberOfLines={2}
                  accessibilityLabel="Content summary"
                />
              </View>
            )}
          />

          {contentType === 'article' ? (
            <Controller
              control={control}
              name="body"
              render={({ field: { onChange, value } }) => (
                <View style={styles.field}>
                  <Txt variant="caption">Article Body</Txt>
                  <TextInput
                    style={[styles.input, styles.multiline, styles.bodyInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                    value={value}
                    onChangeText={onChange}
                    placeholder="Full article text…"
                    placeholderTextColor={theme.colors.textMuted}
                    multiline
                    numberOfLines={6}
                    accessibilityLabel="Article body"
                  />
                </View>
              )}
            />
          ) : null}

          {(contentType === 'video' || contentType === 'image') ? (
            <>
              <Controller
                control={control}
                name="thumbnail_url"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.field}>
                    <Txt variant="caption">Thumbnail URL</Txt>
                    <TextInput
                      style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                      value={value}
                      onChangeText={onChange}
                      placeholder="https://res.cloudinary.com/…/thumbnail.jpg"
                      placeholderTextColor={theme.colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabel="Thumbnail URL"
                    />
                    {errors.thumbnail_url ? (
                      <Txt variant="caption" color="danger">{errors.thumbnail_url.message}</Txt>
                    ) : null}
                  </View>
                )}
              />

              {contentType === 'video' ? (
                <>
                  <Controller
                    control={control}
                    name="video_url"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.field}>
                        <Txt variant="caption">Video URL</Txt>
                        <TextInput
                          style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                          value={value}
                          onChangeText={onChange}
                          placeholder="https://res.cloudinary.com/…/video.mp4"
                          placeholderTextColor={theme.colors.textMuted}
                          autoCapitalize="none"
                          autoCorrect={false}
                          accessibilityLabel="Video URL"
                        />
                        {errors.video_url ? (
                          <Txt variant="caption" color="danger">{errors.video_url.message}</Txt>
                        ) : null}
                      </View>
                    )}
                  />
                  <Controller
                    control={control}
                    name="video_duration_seconds"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.field}>
                        <Txt variant="caption">Duration (seconds)</Txt>
                        <TextInput
                          style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                          value={value}
                          onChangeText={onChange}
                          placeholder="120"
                          placeholderTextColor={theme.colors.textMuted}
                          keyboardType="number-pad"
                          accessibilityLabel="Video duration in seconds"
                        />
                      </View>
                    )}
                  />
                </>
              ) : null}
            </>
          ) : null}

          <Controller
            control={control}
            name="tags"
            render={({ field: { onChange, value } }) => (
              <View style={styles.field}>
                <Txt variant="caption">Tags (comma-separated)</Txt>
                <TextInput
                  style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                  value={value}
                  onChangeText={onChange}
                  placeholder="breathing, stress, calm"
                  placeholderTextColor={theme.colors.textMuted}
                  accessibilityLabel="Content tags"
                />
              </View>
            )}
          />

          <View style={styles.actionsRow}>
            {editing ? (
              <Button
                label="Cancel Edit"
                variant="secondary"
                onPress={() => {
                  setEditing(null);
                  reset({ content_type: 'article' });
                }}
                style={styles.actionButton}
              />
            ) : null}
            <Button
              label={editing ? 'Save Changes' : 'Publish Content'}
              onPress={handleSubmit(onSubmit)}
              loading={createMutation.isPending || updateMutation.isPending}
              style={styles.actionButton}
            />
          </View>
        </Card>

        <Txt variant="h2" style={styles.listTitle}>Manage Published Content</Txt>

        {isError ? (
          <EmptyState
            title="Couldn't load content"
            message="Check your connection and try again."
            actionLabel="Retry"
            onAction={refetch}
          />
        ) : contents && contents.length === 0 ? (
          <EmptyState title="No content yet" message="Publish your first health content above." />
        ) : (
          <FlatList
            data={contents}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Card style={styles.listItem} padded>
                <View style={styles.listItemRow}>
                  <View style={styles.listItemInfo}>
                    <Txt variant="h3" style={styles.listItemTitle}>{item.title}</Txt>
                    <Txt variant="caption" color="muted">
                      {item.content_type} · {item.category}
                    </Txt>
                  </View>
                  <View style={styles.listItemActions}>
                    <TouchableOpacity
                      onPress={() => onEdit(item)}
                      style={styles.itemActionBtn}
                      accessibilityRole="button"
                      accessibilityLabel={'Edit ' + item.title}
                    >
                      <Txt variant="caption" color="primary">Edit</Txt>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDelete(item)}
                      style={styles.itemActionBtn}
                      accessibilityRole="button"
                      accessibilityLabel={'Delete ' + item.title}
                    >
                      <Txt variant="caption" color="danger">Delete</Txt>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            )}
            ListEmptyComponent={
              deleteMutation.isPending ? <ActivityIndicator style={styles.loadingIndicator} /> : null
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { padding: 24 },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 16, opacity: 0.7 },
  formCard: { marginBottom: 24 },
  field: { marginBottom: 14 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    fontSize: 15,
  },
  multiline: { textAlignVertical: 'top' },
  bodyInput: { minHeight: 120 },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
  },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8, justifyContent: 'flex-end' },
  actionButton: { flex: 1 },
  listTitle: { marginBottom: 12 },
  listItem: { marginBottom: 12 },
  listItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listItemInfo: { flex: 1, paddingRight: 12 },
  listItemTitle: { marginBottom: 4 },
  listItemActions: { flexDirection: 'row', gap: 12 },
  itemActionBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  loadingIndicator: { marginTop: 24 },
});
