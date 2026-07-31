import type { User } from 'src/types/auth';

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user1',
    email: 'test@test.com',
    phone_number: null,
    display_name: null,
    role: 'user',
    is_active: true,
    is_verified: true,
    provider: 'local',
    created_at: new Date().toISOString(),
    last_login_at: null,
    onboarding_completed: true,
    ...overrides,
  };
}
