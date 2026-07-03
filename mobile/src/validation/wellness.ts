import { z } from 'zod';

export const journalCreateSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, 'Content is required'),
  mood: z.string().max(50).optional(),
});

export const moodLogSchema = z.object({
  mood: z.string().min(1, 'Select a mood').max(50),
  intensity: z.number().int().min(1).max(10),
  notes: z.string().max(500).optional(),
});

export type JournalCreateForm = z.infer<typeof journalCreateSchema>;
export type MoodLogForm = z.infer<typeof moodLogSchema>;
