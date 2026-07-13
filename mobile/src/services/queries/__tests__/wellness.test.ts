import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn(), addEventListener: jest.fn() }));
jest.mock('expo-background-fetch', () => ({ BackgroundFetch: { registerTaskAsync: jest.fn(), unregisterTaskAsync: jest.fn() } }));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: jest.fn() }));
jest.mock('@sentry/react-native', () => ({ setTag: jest.fn(), captureException: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
jest.mock('src/services/api', () => ({
  wellnessService: {
    createJournalEntry: jest.fn(),
    createMoodLog: jest.fn(),
    completeBreathingSession: jest.fn(),
  },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() }));
jest.mock('src/services/storage', () => ({
  EncryptedStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('src/utils', () => ({
  generateId: jest.fn(() => 'test-uuid'),
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { useCreateJournalEntry, useCreateMoodLog, useCompleteBreathingSession } from '../wellness';
import { wellnessService } from 'src/services/api';
import { useOfflineStore } from 'src/stores/offlineStore';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: 0 } } });
function wrapper({ children }: any) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  useOfflineStore.setState({ operations: [], isHydrated: true });
});

describe('useCreateJournalEntry', () => {
  it('calls API and invalidates cache on success', async () => {
    (wellnessService.createJournalEntry as jest.Mock).mockResolvedValue({ id: '1' });
    const { result } = renderHook(() => useCreateJournalEntry(), { wrapper });
    await act(async () => { result.current.mutate({ content: 'test' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(wellnessService.createJournalEntry).toHaveBeenCalledWith({ content: 'test' });
  });

  it('enqueues to offlineStore on network error', async () => {
    (wellnessService.createJournalEntry as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useCreateJournalEntry(), { wrapper });
    await act(async () => { result.current.mutate({ content: 'offline test' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const pending = useOfflineStore.getState().operations;
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('journal/create');
    expect(pending[0].data.content).toBe('offline test');
  });

  it('does NOT enqueue on 4xx validation error', async () => {
    (wellnessService.createJournalEntry as jest.Mock).mockRejectedValue({
      isAxiosError: true, response: { status: 422, data: { error: 'Validation failed' } },
    });
    const { result } = renderHook(() => useCreateJournalEntry(), { wrapper });
    await act(async () => { result.current.mutate({ content: '' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useOfflineStore.getState().operations).toHaveLength(0);
  });
});

describe('useCreateMoodLog', () => {
  it('calls API on success', async () => {
    (wellnessService.createMoodLog as jest.Mock).mockResolvedValue({ id: '1' });
    const { result } = renderHook(() => useCreateMoodLog(), { wrapper });
    await act(async () => { result.current.mutate({ mood: 'happy' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('enqueues on network error', async () => {
    (wellnessService.createMoodLog as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useCreateMoodLog(), { wrapper });
    await act(async () => { result.current.mutate({ mood: 'sad' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const pending = useOfflineStore.getState().operations;
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('mood/create');
  });

  it('does NOT enqueue on 4xx', async () => {
    (wellnessService.createMoodLog as jest.Mock).mockRejectedValue({
      isAxiosError: true, response: { status: 400, data: {} },
    });
    const { result } = renderHook(() => useCreateMoodLog(), { wrapper });
    await act(async () => { result.current.mutate({}); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useOfflineStore.getState().operations).toHaveLength(0);
  });
});

describe('useCompleteBreathingSession', () => {
  it('calls API on success', async () => {
    (wellnessService.completeBreathingSession as jest.Mock).mockResolvedValue({ id: '1' });
    const { result } = renderHook(() => useCompleteBreathingSession(), { wrapper });
    await act(async () => { result.current.mutate('exercise-1'); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('enqueues on network error', async () => {
    (wellnessService.completeBreathingSession as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useCompleteBreathingSession(), { wrapper });
    await act(async () => { result.current.mutate('exercise-1'); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const pending = useOfflineStore.getState().operations;
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('breathing/complete');
  });
});
