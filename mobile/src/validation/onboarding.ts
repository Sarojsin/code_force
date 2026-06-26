import { z } from 'zod';

export const personalInfoSchema = z.object({
  age: z.number({ invalid_type_error: 'Required' }).min(13, 'Min 13 years').max(120, 'Max 120 years'),
  heightCm: z.number({ invalid_type_error: 'Required' }).min(50, 'Min 50 cm').max(250, 'Max 250 cm'),
  weightKg: z.number({ invalid_type_error: 'Required' }).min(20, 'Min 20 kg').max(300, 'Max 300 kg'),
});
export type PersonalInfoForm = z.infer<typeof personalInfoSchema>;

export const lifestyleSchema = z.object({
  stressLevel: z.enum(['low', 'moderate', 'high'], { required_error: 'Select stress level' }),
  exerciseFrequency: z.enum(['low', 'moderate', 'high'], { required_error: 'Select exercise frequency' }),
  sleepHours: z.number({ invalid_type_error: 'Required' }).min(0).max(24),
  diet: z.enum(['balanced', 'normal', 'junk'], { required_error: 'Select diet type' }),
});
export type LifestyleForm = z.infer<typeof lifestyleSchema>;

export const currentCycleSchema = z.object({
  cycleStartDate: z.string().min(1, 'Required'),
  cycleLength: z.number({ invalid_type_error: 'Required' }).int().min(20, 'Min 20 days').max(45, 'Max 45 days'),
  periodLength: z.number({ invalid_type_error: 'Required' }).int().min(2, 'Min 2 days').max(10, 'Max 10 days'),
  symptoms: z.array(z.string()),
});
export type CurrentCycleForm = z.infer<typeof currentCycleSchema>;

export const pastCycleSchema = z.object({
  cycleStart: z.string().min(1, 'Required'),
  cycleLength: z.number({ invalid_type_error: 'Required' }).int().min(20).max(45),
  periodLength: z.number({ invalid_type_error: 'Required' }).int().min(2).max(10),
  symptoms: z.array(z.string()),
});
export type PastCycleForm = z.infer<typeof pastCycleSchema>;