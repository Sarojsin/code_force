import { z } from 'zod';

export const logPeriodSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  symptoms: z.array(z.string()).optional(),
  moodTags: z.array(z.string()).optional(),
  energyLevel: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
}).refine(
  (data) => !data.endDate || data.endDate >= data.startDate,
  { message: 'endDate must be on or after startDate', path: ['endDate'] },
);

export type LogPeriodForm = z.infer<typeof logPeriodSchema>;

export const correctionSchema = z.object({
  periodStartDate: z.string().min(1, 'Required'),
  periodEndDate: z.string().optional(),
  symptoms: z.array(z.string()).optional(),
  correctedPredictionId: z.string().optional(),
}).refine(
  (data) => !data.periodEndDate || data.periodEndDate >= data.periodStartDate,
  { message: 'periodEndDate must be on or after periodStartDate', path: ['periodEndDate'] },
);

export type CorrectionForm = z.infer<typeof correctionSchema>;
