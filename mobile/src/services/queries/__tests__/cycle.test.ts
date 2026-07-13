import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn(), addEventListener: jest.fn() }));
jest.mock('expo-background-fetch', () => ({ BackgroundFetch: { registerTaskAsync: jest.fn(), unregisterTaskAsync: jest.fn() } }));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: jest.fn() }));
jest.mock('@sentry/react-native', () => ({ setTag: jest.fn(), captureException: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
jest.mock('src/services/api', () => ({
  cycleService: {
    createEntry: jest.fn(),
    updateEntry: jest.fn(),
    logCorrection: jest.fn(),
    logSnooze: jest.fn(),
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

import { useCreateCycleEntry, useUpdateCycleEntry, useLogCorrection, useLogSnooze } from '../cycle';
import { cycleService } from 'src/services/api';
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

function testMutation(
  name: string,
  hook: () => any,
  serviceFn: jest.Mock,
  mutateArgs: any[],
  expectedType: string,
) {
  describe(name, () => {
    it('calls API and invalidates cache on success', async () => {
      serviceFn.mockResolvedValue({ id: '1' });
      const { result } = renderHook(() => hook(), { wrapper });
      await act(async () => { result.current.mutate(...mutateArgs); });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(serviceFn).toHaveBeenCalled();
    });

    it('enqueues to offlineStore on network error', async () => {
      serviceFn.mockRejectedValue(new TypeError('Network request failed'));
      const { result } = renderHook(() => hook(), { wrapper });
      await act(async () => { result.current.mutate(...mutateArgs); });
      await waitFor(() => expect(result.current.isError).toBe(true));
      const pending = useOfflineStore.getState().operations;
      expect(pending.length).toBeGreaterThanOrEqual(1);
      expect(pending[pending.length - 1].type).toBe(expectedType);
    });

    it('does NOT enqueue on 4xx validation error', async () => {
      serviceFn.mockRejectedValue({ isAxiosError: true, response: { status: 422, data: {} } });
      const { result } = renderHook(() => hook(), { wrapper });
      await act(async () => { result.current.mutate(...mutateArgs); });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(useOfflineStore.getState().operations).toHaveLength(0);
    });
  });
}

testMutation(
  'useCreateCycleEntry',
  () => useCreateCycleEntry(),
  cycleService.createEntry as jest.Mock,
  [{ period_start_date: '2025-01-15' }],
  'cycle/create',
);

testMutation(
  'useUpdateCycleEntry',
  () => useUpdateCycleEntry(),
  cycleService.updateEntry as jest.Mock,
  [{ id: '1', data: { flow_intensity: 'Heavy' } }],
  'cycle/update',
);

testMutation(
  'useLogCorrection',
  () => useLogCorrection(),
  cycleService.logCorrection as jest.Mock,
  [{ period_start_date: '2025-01-15' }],
  'cycle/correction',
);

testMutation(
  'useLogSnooze',
  () => useLogSnooze(),
  cycleService.logSnooze as jest.Mock,
  [{ predictedCycleId: '1', dayOffset: 2 }],
  'cycle/snooze',
);
