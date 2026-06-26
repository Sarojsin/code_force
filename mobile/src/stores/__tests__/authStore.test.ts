import { act, renderHook } from '@testing-library/react-native';

jest.mock('react-native-encrypted-storage', () => {
  const store: Record<string, string> = {};
  return {
    default: {
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      clear: jest.fn(async () => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    },
  };
});

jest.mock('src/services/storage', () => {
  const storage: Record<string, string> = {};
  return {
    EncryptedStorage: {
      getItem: jest.fn(async (key: string) => storage[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete storage[key];
      }),
      clear: jest.fn(async () => {
        Object.keys(storage).forEach((k) => delete storage[k]);
      }),
    },
  };
});

jest.mock('src/services/api', () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    getMe: jest.fn(),
  },
  tokenStore: {
    getAccess: jest.fn(),
    setBoth: jest.fn(),
    clear: jest.fn(),
  },
}));

import { useAuthStore } from '../authStore';

const mockAuthService =
  jest.requireMock('src/services/api').authService;
const mockTokenStore =
  jest.requireMock('src/services/api').tokenStore;

beforeEach(() => {
  jest.clearAllMocks();
});

it('starts with no user and not hydrated', () => {
  const { result } = renderHook(() => useAuthStore());
  expect(result.current.user).toBeNull();
  expect(result.current.isHydrated).toBe(false);
});

it('setUser updates the user', async () => {
  const { result } = renderHook(() => useAuthStore());
  const user = { id: 'u1', email: 'test@test.com' };
  await act(async () => {
    result.current.setUser(user as any);
  });
  expect(result.current.user).toEqual(user);
});

it('setUser(null) clears the user', async () => {
  const { result } = renderHook(() => useAuthStore());
  await act(async () => {
    result.current.setUser({ id: 'u1' } as any);
  });
  expect(result.current.user).not.toBeNull();
  await act(async () => {
    result.current.setUser(null);
  });
  expect(result.current.user).toBeNull();
});

it('hydrate sets isHydrated when no token', async () => {
  mockTokenStore.getAccess.mockResolvedValue(null);
  const { result } = renderHook(() => useAuthStore());
  await act(async () => {
    await result.current.hydrate();
  });
  expect(result.current.isHydrated).toBe(true);
  expect(result.current.user).toBeNull();
});

it('hydrate fetches user when token exists', async () => {
  const user = { id: 'u1', email: 'test@test.com' };
  mockTokenStore.getAccess.mockResolvedValue('valid-token');
  mockAuthService.getMe.mockResolvedValue(user);
  const { result } = renderHook(() => useAuthStore());
  await act(async () => {
    await result.current.hydrate();
  });
  expect(result.current.user).toEqual(user);
  expect(result.current.isHydrated).toBe(true);
});

it('hydrate clears token when getMe fails', async () => {
  mockTokenStore.getAccess.mockResolvedValue('bad-token');
  mockAuthService.getMe.mockRejectedValue(new Error('Unauthorized'));
  const { result } = renderHook(() => useAuthStore());
  await act(async () => {
    await result.current.hydrate();
  });
  expect(result.current.user).toBeNull();
  expect(result.current.isHydrated).toBe(true);
  expect(mockTokenStore.clear).toHaveBeenCalled();
});

it('login sets user from authService', async () => {
  const user = { id: 'u1', email: 'a@b.com' };
  mockAuthService.login.mockResolvedValue({ user });
  const { result } = renderHook(() => useAuthStore());
  await act(async () => {
    await result.current.login('a@b.com', 'Pass1!');
  });
  expect(result.current.user).toEqual(user);
  expect(mockAuthService.login).toHaveBeenCalledWith('a@b.com', 'Pass1!');
});

it('register sets user from authService', async () => {
  const user = { id: 'u2', email: 'b@c.com' };
  const data = { email: 'b@c.com', password: 'Pass1!', phone: '+14155552671' };
  mockAuthService.register.mockResolvedValue({ user });
  const { result } = renderHook(() => useAuthStore());
  await act(async () => {
    await result.current.register(data as any);
  });
  expect(result.current.user).toEqual(user);
  expect(mockAuthService.register).toHaveBeenCalledWith(data);
});

it('reset clears user and calls tokenStore.clear', async () => {
  const { result } = renderHook(() => useAuthStore());
  await act(async () => {
    result.current.setUser({ id: 'u1' } as any);
  });
  await act(async () => {
    await result.current.reset();
  });
  expect(result.current.user).toBeNull();
  expect(mockTokenStore.clear).toHaveBeenCalled();
});
