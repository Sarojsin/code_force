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

  function onSubmit(values: ContentForm) {
    save.mutate({
      title: values.title,
      category: values.category,
      description: values.description || null,
      video_url: values.video_url || null,
      thumbnail_url: values.thumbnail_url || null,
      tags: values.tags
        ? values.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [],
    });
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
          <Button form="content-form" type="submit" loading={isSubmitting || save.isPending}>
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
        <Field label="Video URL" hint="YouTube or direct video link">
          <Input placeholder="https://youtube.com/watch?v=..." {...register('video_url')} />
        </Field>
        <Field label="Thumbnail URL" hint="Image URL for the card thumbnail">
          <Input placeholder="https://example.com/thumbnail.jpg" {...register('thumbnail_url')} />
        </Field>
        <Field label="Tags" hint="Comma-separated">
          <Input placeholder="cramps, self-care, nutrition" {...register('tags')} />
        </Field>
      </form>
    </Modal>
  );
}
