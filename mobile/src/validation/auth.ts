import { z } from 'zod';

export const phoneSchema = z
  .string()
  .min(8, 'Phone number is too short')
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format, e.g. +14155552671');

export const otpSchema = z.string().regex(/^\d{4,8}$/, 'OTP must be 4-8 digits');

export const emailSchema = z.string().email('Invalid email address');

// Password must be 8-128 chars with at least 1 number and 1 special character
// Strict password: used for registration — requires number + special char
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128)
  .regex(/[0-9]/, 'At least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>_\-+=~`\[\];']/, 'At least one special character');

// Lenient password: used for login — accepts legacy passwords
export const loginPasswordSchema = z.string().min(1, 'Required').max(128);

export const displayNameSchema = z.string().min(1, 'Required').max(100).optional();

export const requestOtpFormSchema = z.object({
  phone: phoneSchema,
});
export type RequestOtpForm = z.infer<typeof requestOtpFormSchema>;

export const verifyOtpFormSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
});
export type VerifyOtpForm = z.infer<typeof verifyOtpFormSchema>;

export const registerFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  display_name: displayNameSchema,
});
export type RegisterForm = z.infer<typeof registerFormSchema>;

export const loginFormSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});
export type LoginForm = z.infer<typeof loginFormSchema>;
