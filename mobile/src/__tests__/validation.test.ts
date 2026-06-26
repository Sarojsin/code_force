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
