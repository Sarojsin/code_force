import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { extractError } from 'src/api/client';
import { adminApi } from 'src/api/admin';
import { nurseContentApi } from 'src/api/nurseContent';
import { Badge } from 'src/components/ui/Badge';
import { Button } from 'src/components/ui/Button';
import { Field, Input, Select, TextArea } from 'src/components/ui/Field';
import { Modal } from 'src/components/ui/Modal';
import { PageHeader } from 'src/components/ui/PageHeader';
import { EmptyState } from 'src/components/ui/Spinner';
import { Table, type Column } from 'src/components/ui/Table';
import { toast } from 'src/stores/toastStore';
import type { ContentItem, ContentPayload } from 'src/types/api';

const CATEGORIES = ['wellness', 'pregnancy', 'cycle', 'nutrition', 'mental_health'];

const contentSchema = z.object({
  title: z.string().min(3, 'Title is required').max(200),
  category: z.string().min(1, 'Choose a category'),
  description: z.string().optional(),
  video_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  thumbnail_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  tags: z.string().optional(),
});

type ContentForm = z.infer<typeof contentSchema>;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ContentLibrary() {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<ContentItem | 'new' | null>(null);

  const own = useQuery({ queryKey: ['own-content'], queryFn: nurseContentApi.listOwn, retry: 1 });
  const pending = useQuery({ queryKey: ['pending-content'], queryFn: adminApi.listPendingContents, retry: 1 });
  const publicList = useQuery({ queryKey: ['public-content'], queryFn: () => nurseContentApi.listPublic(), retry: 1 });

  const items = useMemo(() => {
    const map = new Map<string, ContentItem>();
    for (const src of [own.data, pending.data, publicList.data]) {
      for (const item of src ?? []) {
        map.set(item.id, item);
      }
    }
    return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [own.data, pending.data, publicList.data]);

  const isLoading = own.isLoading || pending.isLoading || publicList.isLoading;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['own-content'] });
    queryClient.invalidateQueries({ queryKey: ['pending-content'] });
    queryClient.invalidateQueries({ queryKey: ['public-content'] });
  }

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' | 'publish' | 'unpublish' }) =>
      adminApi.reviewContent(id, action),
    onSuccess: () => {
      toast.success('Content updated');
      invalidate();
    },
    onError: err => toast.error('Action failed', extractError(err)),
  });

  const submit = useMutation({
    mutationFn: (id: string) => nurseContentApi.submit(id),
    onSuccess: () => {
      toast.success('Submitted for review');
      invalidate();
    },
    onError: err => toast.error('Submit failed', extractError(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => nurseContentApi.remove(id),
    onSuccess: () => {
      toast.success('Content deleted');
      invalidate();
    },
    onError: err => toast.error('Delete failed', extractError(err)),
  });

  const columns: Column<ContentItem>[] = [
    {
      key: 'title',
      header: 'Title',
      render: c => <strong>{c.title}</strong>,
    },
    {
      key: 'category',
      header: 'Category',
      render: c => <Badge tone="info">{c.category}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: c => <Badge>{c.status}</Badge>,
    },
    {
      key: 'created',
      header: 'Created',
      render: c => <span className="muted">{formatDate(c.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: c => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(c.status === 'draft' || c.status === 'rejected') && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditor(c)}>
                Edit
              </Button>
              <Button size="sm" onClick={() => submit.mutate(c.id)}>
                Submit
              </Button>
            </>
          )}
          {c.status === 'pending' && (
            <>
              <Button size="sm" variant="secondary" onClick={() => review.mutate({ id: c.id, action: 'approve' })}>
                Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => review.mutate({ id: c.id, action: 'reject' })}>
                Reject
              </Button>
            </>
          )}
          {c.status === 'approved' && (
            <Button size="sm" variant="secondary" onClick={() => review.mutate({ id: c.id, action: 'unpublish' })}>
              Unpublish
            </Button>
          )}
          {c.status === 'unpublished' && (
            <Button size="sm" onClick={() => review.mutate({ id: c.id, action: 'publish' })}>
              Publish
            </Button>
          )}
          {c.status === 'draft' && (
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(c.id)}>
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Content Library"
        subtitle="Draft, review, approve and publish educational content"
        actions={
          <Button onClick={() => setEditor('new')}>+ New content</Button>
        }
      />

      {isLoading && <EmptyState title="Loading content…" />}
      {!isLoading && <Table columns={columns} rows={items} rowKey={c => c.id} emptyMessage="No content yet — create your first piece" />}

      {editor !== null && (
        <ContentEditor
          item={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            invalidate();
            setEditor(null);
          }}
        />
      )}
    </div>
  );
}

function ContentEditor({ item, onClose, onSaved }: { item: ContentItem | null; onClose: () => void; onSaved: () => void }) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>(item?.video_url ?? '');
  const [thumbPreview, setThumbPreview] = useState<string>(item?.thumbnail_url ?? '');
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContentForm>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      title: item?.title ?? '',
      category: item?.category ?? CATEGORIES[0],
      description: item?.description ?? '',
      video_url: item?.video_url ?? '',
      thumbnail_url: item?.thumbnail_url ?? '',
      tags: (item?.tags ?? []).join(', '),
    },
  });

  const save = useMutation({
    mutationFn: (payload: ContentPayload) =>
      item ? nurseContentApi.update(item.id, payload) : nurseContentApi.create(payload),
    onSuccess: () => {
      toast.success(item ? 'Content updated' : 'Content created');
      onSaved();
    },
    onError: err => toast.error('Save failed', extractError(err)),
  });

  async function uploadFile(file: File, type: 'image' | 'video'): Promise<string> {
    const uploadData = await nurseContentApi.getUploadUrl(type);
    return nurseContentApi.uploadToCloudinary(file, uploadData);
  }

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  function handleThumbChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
  }

  async function onSubmit(values: ContentForm) {
    setUploading(true);
    try {
      let videoUrl = values.video_url || null;
      let thumbUrl = values.thumbnail_url || null;

      if (videoFile) {
        videoUrl = await uploadFile(videoFile, 'video');
      }
      if (thumbFile) {
        thumbUrl = await uploadFile(thumbFile, 'image');
      }

      save.mutate({
        title: values.title,
        category: values.category,
        description: values.description || null,
        video_url: videoUrl,
        thumbnail_url: thumbUrl,
        tags: values.tags
          ? values.tags.split(',').map(t => t.trim()).filter(Boolean)
          : [],
      });
    } catch (err) {
      toast.error('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      open
      title={item ? 'Edit content' : 'New content'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="content-form" type="submit" loading={isSubmitting || save.isPending || uploading}>
            Save
          </Button>
        </>
      }
    >
      <form id="content-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Title" error={errors.title?.message}>
          <Input invalid={!!errors.title} placeholder="e.g. Understanding your cycle" {...register('title')} />
        </Field>
        <Field label="Category" error={errors.category?.message}>
          <Select {...register('category')}>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" hint="Short summary shown in the app">
          <TextArea placeholder="One or two sentences…" {...register('description')} />
        </Field>

        <Field label="Video" hint="Upload a video file">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoChange}
              style={{ fontSize: 13 }}
            />
            {videoPreview && (
              <video
                src={videoPreview}
                controls
                style={{ width: '100%', maxHeight: 200, borderRadius: 8, background: '#000' }}
              />
            )}
          </div>
        </Field>

        <Field label="Thumbnail" hint="Upload an image for the card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleThumbChange}
              style={{ fontSize: 13 }}
            />
            {thumbPreview && (
              <img
                src={thumbPreview}
                alt="Thumbnail preview"
                style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8 }}
              />
            )}
          </div>
        </Field>

        <Field label="Tags" hint="Comma-separated">
          <Input placeholder="cramps, self-care, nutrition" {...register('tags')} />
        </Field>
      </form>
    </Modal>
  );
}
