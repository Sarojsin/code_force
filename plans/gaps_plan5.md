# Gap Plan 5: Mobile API Service Tests

> **Target:** 3 API service test files: `auth.test.ts`, `cycle.test.ts`, `safety.test.ts`
> **Current:** 0 — no API service test files exist
> **Priority:** MEDIUM

---

## 5.1 Setup

### Install msw (Mock Service Worker) for API mocking

```bash
cd mobile/
npm install --save-dev msw@1.x  # Use v1 for Node.js compatibility
```

### Create shared mock server:

**File:** `mobile/src/services/api/__tests__/mocks/server.ts`

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

**File:** `mobile/src/services/api/__tests__/mocks/handlers.ts`

```typescript
import { rest } from 'msw';

const BASE_URL = 'http://localhost:8000/api/v1';

export const handlers = [
  // Auth
  rest.post(`${BASE_URL}/auth/register`, (req, res, ctx) => {
    return res(ctx.json({
      data: {
        user: { id: 'user1', email: 'test@example.com' },
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
      },
      message: 'ok',
    }));
  }),
  rest.post(`${BASE_URL}/auth/login`, (req, res, ctx) => {
    return res(ctx.json({
      data: {
        user: { id: 'user1', email: 'test@example.com' },
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
      },
      message: 'ok',
    }));
  }),
  rest.post(`${BASE_URL}/auth/refresh`, (req, res, ctx) => {
    return res(ctx.json({
      data: {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
      },
      message: 'ok',
    }));
  }),
  rest.post(`${BASE_URL}/auth/logout`, (req, res, ctx) => {
    return res(ctx.json({ data: null, message: 'ok' }));
  }),

  // Cycle
  rest.get(`${BASE_URL}/cycle/entries`, (req, res, ctx) => {
    return res(ctx.json({
      data: [
        { id: '1', entry_date: '2026-06-10', day_type: 'period', flow: 'heavy' },
        { id: '2', entry_date: '2026-06-11', day_type: 'period', flow: 'medium' },
      ],
      message: 'ok',
    }));
  }),
  rest.post(`${BASE_URL}/cycle/entries`, (req, res, ctx) => {
    return res(ctx.json({
      data: { id: '3', entry_date: '2026-06-24', day_type: 'follicular' },
      message: 'ok',
    }));
  }),

  // Safety
  rest.post(`${BASE_URL}/safety/sos`, (req, res, ctx) => {
    return res(ctx.json({
      data: { id: 'sos1', status: 'active', triggered_at: '2026-06-24T12:00:00Z' },
      message: 'ok',
    }));
  }),
  rest.post(`${BASE_URL}/safety/sos/resolve`, (req, res, ctx) => {
    return res(ctx.json({
      data: { id: 'sos1', status: 'resolved', resolved_at: '2026-06-24T12:05:00Z' },
      message: 'ok',
    }));
  }),
];
```

---

## 5.2 Test: `auth.test.ts`

**File:** `mobile/src/services/api/__tests__/auth.test.ts`

### Tests:

| # | Test | Description |
|---|------|-------------|
| 1 | `register` succeeds | Returns user + tokens |
| 2 | `login` succeeds | Returns user + tokens |
| 3 | `login` with wrong password | Returns error with code `INVALID_CREDENTIALS` |
| 4 | `refreshToken` succeeds | Returns new access_token + refresh_token |
| 5 | `refreshToken` with expired token | Returns 401 |
| 6 | `logout` succeeds | Clears tokens on server |
| 7 | `logout` without auth | Returns 401 |

### Sample pattern:

```typescript
import { rest } from 'msw';
import { server } from './mocks/server';
import { authApi } from '../auth';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('authApi', () => {
  it('register returns user and tokens', async () => {
    const result = await authApi.register({
      email: 'test@example.com',
      password: 'TestPass123!',
    });
    expect(result.user.email).toBe('test@example.com');
    expect(result.access_token).toBe('mock_access_token');
  });

  it('login with wrong password returns 401', async () => {
    server.use(
      rest.post('*/auth/login', (_req, res, ctx) =>
        res(ctx.status(401), ctx.json({
          error: { code: 'INVALID_CREDENTIALS', details: 'Invalid email or password' },
        }))
      ),
    );
    await expect(
      authApi.login({ email: 'test@example.com', password: 'wrong' })
    ).rejects.toThrow('Invalid email or password');
  });

  it('refreshToken returns new token pair', async () => {
    const result = await authApi.refreshToken('old_refresh_token');
    expect(result.access_token).toBe('new_access_token');
    expect(result.refresh_token).toBe('new_refresh_token');
  });
});
```

---

## 5.3 Test: `cycle.test.ts`

**File:** `mobile/src/services/api/__tests__/cycle.test.ts`

### Tests:

| # | Test | Description |
|---|------|-------------|
| 1 | `getEntries` returns list | Returns cycle entries array |
| 2 | `getEntries` with date range | Filters by start_date/end_date |
| 3 | `createEntry` saves entry | POST returns created entry with ID |
| 4 | `createEntry` missing required field | Returns validation error |
| 5 | `getPredictions` returns prediction | Returns `next_period_start`, `confidence` |
| 6 | `getPredictions` for irregular user | Returns `prediction_window_days > 3` |
| 7 | `getPredictions` insufficient data | Returns `null` model |
| 8 | `correctPrediction` saves correction | Updates `prediction_error_days` |
| 9 | `getCalendar` returns monthly view | Returns day types for entire month |

---

## 5.4 Test: `safety.test.ts`

**File:** `mobile/src/services/api/__tests__/safety.test.ts`

### Tests:

| # | Test | Description |
|---|------|-------------|
| 1 | `triggerSOS` returns active status | POST creates SOS with `status: 'active'` |
| 2 | `triggerSOS` idempotency | Same idempotency key returns same SOS |
| 3 | `triggerSOS` rate limited | >3 in 5 min → 429 |
| 4 | `resolveSOS` updates status | POST changes to `status: 'resolved'` |
| 5 | `getEmergencyContacts` returns list | GET returns contact array |
| 6 | `createEmergencyContact` saves | POST returns contact with ID |
| 7 | `updateEmergencyContact` updates | PUT/PATCH returns updated contact |
| 8 | `deleteEmergencyContact` removes | DELETE returns `202` or `204` |

---

## 5.5 MSW vs Jest Mock Decision

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **MSW** (recommended) | Intercepts at network level, tests real `fetch` calls, works with any HTTP client | Extra npm dependency, setup overhead | ✅ **Chosen** — most realistic |
| `jest.mock('./api')` | No deps, simple | Mocks the wrong layer, fragile to refactors | ❌ |
| `axios-mock-adapter` | Familiar | Only works with axios | ❌ (using fetch) |

---

## 5.6 Validation

```bash
cd mobile/
npx jest src/services/api/__tests__/ --coverage --verbose
# Expected: 3 suites, ~20 tests, all passing
```
