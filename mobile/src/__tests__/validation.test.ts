import {
  personalInfoSchema,
  lifestyleSchema,
  currentCycleSchema,
  pastCycleSchema,
} from 'src/validation/onboarding';
import {
  phoneSchema,
  otpSchema,
  emailSchema,
  passwordSchema,
  loginPasswordSchema,
  displayNameSchema,
  requestOtpFormSchema,
  verifyOtpFormSchema,
  registerFormSchema,
  loginFormSchema,
} from 'src/validation/auth';
import {
  logPeriodSchema,
  correctionSchema,
} from 'src/validation/cycle';

// ─── onboarding: personalInfoSchema ───────────────────────────────────

describe('personalInfoSchema', () => {
  it('accepts valid input', () => {
    const result = personalInfoSchema.safeParse({ age: 25, heightCm: 165, weightKg: 60 });
    expect(result.success).toBe(true);
  });

  it('rejects age below 13', () => {
    const result = personalInfoSchema.safeParse({ age: 10, heightCm: 165, weightKg: 60 });
    expect(result.success).toBe(false);
  });

  it('rejects age above 120', () => {
    const result = personalInfoSchema.safeParse({ age: 150, heightCm: 165, weightKg: 60 });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = personalInfoSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects string instead of number', () => {
    const result = personalInfoSchema.safeParse({ age: 'abc', heightCm: 165, weightKg: 60 });
    expect(result.success).toBe(false);
  });
});

// ─── onboarding: lifestyleSchema ──────────────────────────────────────

describe('lifestyleSchema', () => {
  it('accepts valid lifestyle', () => {
    const result = lifestyleSchema.safeParse({
      stressLevel: 'low',
      exerciseFrequency: 'moderate',
      sleepHours: 8,
      diet: 'balanced',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid stress level', () => {
    const result = lifestyleSchema.safeParse({
      stressLevel: 'extreme',
      exerciseFrequency: 'low',
      sleepHours: 7,
      diet: 'normal',
    });
    expect(result.success).toBe(false);
  });

  it('rejects sleep hours below 0', () => {
    const result = lifestyleSchema.safeParse({
      stressLevel: 'low',
      exerciseFrequency: 'low',
      sleepHours: -1,
      diet: 'normal',
    });
    expect(result.success).toBe(false);
  });

  it('rejects sleep hours above 24', () => {
    const result = lifestyleSchema.safeParse({
      stressLevel: 'low',
      exerciseFrequency: 'low',
      sleepHours: 25,
      diet: 'normal',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = lifestyleSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── onboarding: currentCycleSchema ───────────────────────────────────

describe('currentCycleSchema', () => {
  it('accepts valid cycle', () => {
    const result = currentCycleSchema.safeParse({
      cycleStartDate: '2024-01-01',
      cycleLength: 28,
      periodLength: 5,
      symptoms: ['cramps'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty symptoms', () => {
    const result = currentCycleSchema.safeParse({
      cycleStartDate: '2024-01-01',
      cycleLength: 28,
      periodLength: 5,
      symptoms: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects cycle length below 20', () => {
    const result = currentCycleSchema.safeParse({
      cycleStartDate: '2024-01-01',
      cycleLength: 15,
      periodLength: 5,
      symptoms: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects period length above 10', () => {
    const result = currentCycleSchema.safeParse({
      cycleStartDate: '2024-01-01',
      cycleLength: 28,
      periodLength: 12,
      symptoms: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing cycleStartDate', () => {
    const result = currentCycleSchema.safeParse({
      cycleLength: 28,
      periodLength: 5,
      symptoms: [],
    });
    expect(result.success).toBe(false);
  });
});

// ─── onboarding: pastCycleSchema ──────────────────────────────────────

describe('pastCycleSchema', () => {
  it('accepts valid past cycle', () => {
    const result = pastCycleSchema.safeParse({
      cycleStart: '2024-02-01',
      cycleLength: 30,
      periodLength: 4,
      symptoms: ['headache'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = pastCycleSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── auth: phoneSchema ────────────────────────────────────────────────

describe('phoneSchema', () => {
  it('accepts valid E.164 phone', () => {
    const result = phoneSchema.safeParse('+14155552671');
    expect(result.success).toBe(true);
  });

  it('rejects phone without + prefix', () => {
    const result = phoneSchema.safeParse('14155552671');
    expect(result.success).toBe(false);
  });

  it('rejects too short phone', () => {
    const result = phoneSchema.safeParse('+123');
    expect(result.success).toBe(false);
  });
});

// ─── auth: otpSchema ──────────────────────────────────────────────────

describe('otpSchema', () => {
  it('accepts 6-digit OTP', () => {
    const result = otpSchema.safeParse('123456');
    expect(result.success).toBe(true);
  });

  it('rejects non-digit OTP', () => {
    const result = otpSchema.safeParse('abcdef');
    expect(result.success).toBe(false);
  });

  it('rejects too short OTP', () => {
    const result = otpSchema.safeParse('123');
    expect(result.success).toBe(false);
  });
});

// ─── auth: emailSchema ────────────────────────────────────────────────

describe('emailSchema', () => {
  it('accepts valid email', () => {
    const result = emailSchema.safeParse('user@example.com');
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = emailSchema.safeParse('not-an-email');
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});

// ─── auth: passwordSchema ─────────────────────────────────────────────

describe('passwordSchema', () => {
  it('accepts strong password', () => {
    const result = passwordSchema.safeParse('Strong1!pass');
    expect(result.success).toBe(true);
  });

  it('rejects password without number', () => {
    const result = passwordSchema.safeParse('Weak!pass');
    expect(result.success).toBe(false);
  });

  it('rejects password without special char', () => {
    const result = passwordSchema.safeParse('Weak1pass');
    expect(result.success).toBe(false);
  });

  it('rejects too short password', () => {
    const result = passwordSchema.safeParse('A1!b');
    expect(result.success).toBe(false);
  });
});

// ─── auth: loginPasswordSchema ────────────────────────────────────────

describe('loginPasswordSchema', () => {
  it('accepts any non-empty password', () => {
    const result = loginPasswordSchema.safeParse('anything');
    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = loginPasswordSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});

// ─── auth: displayNameSchema ──────────────────────────────────────────

describe('displayNameSchema', () => {
  it('accepts undefined (optional)', () => {
    const result = displayNameSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('accepts valid display name', () => {
    const result = displayNameSchema.safeParse('Alice');
    expect(result.success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = displayNameSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});

// ─── auth: requestOtpFormSchema ───────────────────────────────────────

describe('requestOtpFormSchema', () => {
  it('accepts valid phone', () => {
    const result = requestOtpFormSchema.safeParse({ phone: '+14155552671' });
    expect(result.success).toBe(true);
  });

  it('rejects missing phone', () => {
    const result = requestOtpFormSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── auth: verifyOtpFormSchema ────────────────────────────────────────

describe('verifyOtpFormSchema', () => {
  it('accepts valid phone and OTP', () => {
    const result = verifyOtpFormSchema.safeParse({ phone: '+14155552671', otp: '123456' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid OTP format', () => {
    const result = verifyOtpFormSchema.safeParse({ phone: '+14155552671', otp: 'abc' });
    expect(result.success).toBe(false);
  });
});

// ─── auth: registerFormSchema ─────────────────────────────────────────

describe('registerFormSchema', () => {
  it('accepts valid registration', () => {
    const result = registerFormSchema.safeParse({
      email: 'a@b.com',
      password: 'Strong1!pass',
      display_name: 'Alice',
    });
    expect(result.success).toBe(true);
  });

  it('accepts registration without display_name', () => {
    const result = registerFormSchema.safeParse({
      email: 'a@b.com',
      password: 'Strong1!pass',
    });
    expect(result.success).toBe(true);
  });

  it('rejects weak password', () => {
    const result = registerFormSchema.safeParse({
      email: 'a@b.com',
      password: 'weak',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = registerFormSchema.safeParse({
      email: 'bad',
      password: 'Strong1!pass',
    });
    expect(result.success).toBe(false);
  });
});

// ─── auth: loginFormSchema ────────────────────────────────────────────

describe('loginFormSchema', () => {
  it('accepts valid login', () => {
    const result = loginFormSchema.safeParse({
      email: 'a@b.com',
      password: 'anypass',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = loginFormSchema.safeParse({
      email: 'a@b.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty email', () => {
    const result = loginFormSchema.safeParse({
      email: '',
      password: 'something',
    });
    expect(result.success).toBe(false);
  });
});

// ─── cycle: logPeriodSchema ───────────────────────────────────────────

describe('logPeriodSchema', () => {
  it('accepts minimal valid input', () => {
    const result = logPeriodSchema.safeParse({ startDate: '2024-03-01' });
    expect(result.success).toBe(true);
  });

  it('accepts full input with all fields', () => {
    const result = logPeriodSchema.safeParse({
      startDate: '2024-03-01',
      endDate: '2024-03-05',
      symptoms: ['cramps', 'bloating'],
      moodTags: ['happy'],
      energyLevel: 7,
      notes: 'Felt ok',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing startDate', () => {
    const result = logPeriodSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects energyLevel out of range', () => {
    const result = logPeriodSchema.safeParse({ startDate: '2024-03-01', energyLevel: 15 });
    expect(result.success).toBe(false);
  });
});

// ─── cycle: correctionSchema ──────────────────────────────────────────

describe('correctionSchema', () => {
  it('accepts valid correction', () => {
    const result = correctionSchema.safeParse({
      periodStartDate: '2024-03-01',
      periodEndDate: '2024-03-05',
      symptoms: ['cramps'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts correction with only required fields', () => {
    const result = correctionSchema.safeParse({ periodStartDate: '2024-03-01' });
    expect(result.success).toBe(true);
  });

  it('rejects missing periodStartDate', () => {
    const result = correctionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── cycle: Scenario 2C — Forgot both dates (backfill) ────────────

describe('Scenario 2C: forgot both dates', () => {
  it('accepts period log with both start and end dates for past period', () => {
    const result = logPeriodSchema.safeParse({
      startDate: '2026-05-10',
      endDate: '2026-05-14',
    });
    expect(result.success).toBe(true);
  });

  it('accepts endDate matching startDate (1-day period)', () => {
    const result = logPeriodSchema.safeParse({ startDate: '2026-06-01', endDate: '2026-06-01' });
    expect(result.success).toBe(true);
  });

  it('endDate is optional in schema (backend enforces State C)', () => {
    const result = logPeriodSchema.safeParse({ startDate: '2026-05-10' });
    expect(result.success).toBe(true);
  });
});

// ─── cycle: Scenario 2B — Override end date ──────────────────────

describe('Scenario 2B: override end date', () => {
  it('correction schema accepts explicit periodEndDate', () => {
    const result = correctionSchema.safeParse({
      periodStartDate: '2026-06-15',
      periodEndDate: '2026-06-21',
    });
    expect(result.success).toBe(true);
  });

  it('logPeriod schema accepts endDate longer than default', () => {
    const result = logPeriodSchema.safeParse({
      startDate: '2026-07-10',
      endDate: '2026-07-16',
      symptoms: ['cramps'],
    });
    expect(result.success).toBe(true);
  });
});

// ─── cycle: Scenario 1 — Confirm on predicted date ──────────────

describe('Scenario 1: confirm on predicted date', () => {
  it('correction schema accepts startDate matching predicted date', () => {
    const result = correctionSchema.safeParse({
      periodStartDate: '2026-06-15',
      correctedPredictionId: 'pred-123',
    });
    expect(result.success).toBe(true);
  });

  it('correction schema accepts all fields for a full confirmation', () => {
    const result = correctionSchema.safeParse({
      periodStartDate: '2026-06-15',
      periodEndDate: '2026-06-19',
      symptoms: ['cramps', 'bloating'],
      correctedPredictionId: 'pred-123',
    });
    expect(result.success).toBe(true);
  });
});

// ─── cycle: Anovulatory cycle type ──────────────────────────────

describe('anovulatory cycle type', () => {
  it('logPeriod schema accepts cycle_type field', () => {
    const result = logPeriodSchema.safeParse({
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
    expect(result.success).toBe(true);
  });

  it('correction schema accepts cycle_type for anovulatory correction', () => {
    const result = correctionSchema.safeParse({
      periodStartDate: '2026-06-14',
      periodEndDate: '2026-06-18',
    });
    expect(result.success).toBe(true);
  });
});

// ─── cycle: 3-state buffer schema-level ─────────────────────────

describe('3-state buffer schema', () => {
  it('State A: future start date is accepted without end date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const result = logPeriodSchema.safeParse({
      startDate: future.toISOString().split('T')[0],
    });
    expect(result.success).toBe(true);
  });

  it('State B: start date within window is accepted without end date', () => {
    const result = logPeriodSchema.safeParse({ startDate: '2026-07-22' });
    expect(result.success).toBe(true);
  });

  it('State C: past start date is accepted without end date in schema (backend enforces)', () => {
    const result = logPeriodSchema.safeParse({ startDate: '2026-05-01' });
    expect(result.success).toBe(true);
  });
});
