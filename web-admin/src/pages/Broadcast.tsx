import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { extractError } from 'src/api/client';
import { adminApi } from 'src/api/admin';
import { Button } from 'src/components/ui/Button';
import { Card } from 'src/components/ui/Card';
import { Field, Input, TextArea } from 'src/components/ui/Field';
import { PageHeader } from 'src/components/ui/PageHeader';
import { toast } from 'src/stores/toastStore';

const broadcastSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().min(1, 'Message is required').max(500),
});

type BroadcastForm = z.infer<typeof broadcastSchema>;

export function Broadcast() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BroadcastForm>({ resolver: zodResolver(broadcastSchema) });

  const send = useMutation({
    mutationFn: (payload: { title: string; body: string }) => adminApi.broadcast(payload),
    onSuccess: data => {
      toast.success('Broadcast queued', `${data.recipient_count} recipients`);
      reset();
    },
    onError: err => toast.error('Broadcast failed', extractError(err)),
  });

  return (
    <div>
      <PageHeader title="Broadcast" subtitle="Send a push notification to all active users" />
      <Card>
        <form onSubmit={handleSubmit(values => send.mutate(values))} noValidate>
          <Field label="Title" error={errors.title?.message}>
            <Input invalid={!!errors.title} placeholder="Period &amp; wellness tips" {...register('title')} />
          </Field>
          <Field label="Message" hint="Rendered in the push notification body" error={errors.body?.message}>
            <TextArea invalid={!!errors.body} placeholder="Your message here…" {...register('body')} />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button type="submit" loading={send.isPending}>
              Send broadcast
            </Button>
            <Button type="button" variant="secondary" onClick={() => reset()}>
              Clear
            </Button>
          </div>
        </form>
      </Card>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
        Note: the backend currently returns “Broadcast queued” without delivering.
        Real delivery is scheduled in Phase 3 (plan A1).
      </p>
    </div>
  );
}
