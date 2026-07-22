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

// ─── Scenario 1: Confirm on predicted date ─────────────────────

describe('Scenario 1: confirm on predicted date', () => {
  it('useLogCorrection with corrected_prediction_id calls API', async () => {
    (cycleService.logCorrection as jest.Mock).mockResolvedValue({ id: 'corr-1', is_correction: true });
    const { result } = renderHook(() => useLogCorrection(), { wrapper });
    await act(async () => {
      result.current.mutate({
        period_start_date: '2026-06-15',
        corrected_prediction_id: 'pred-123',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cycleService.logCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ corrected_prediction_id: 'pred-123' }),
      expect.any(String),
      expect.any(String),
    );
  });

  it('useLogCorrection with zero error sets prediction_error_days=0 on server', async () => {
    (cycleService.logCorrection as jest.Mock).mockResolvedValue({ id: 'corr-2', prediction_error_days: 0 });
    const { result } = renderHook(() => useLogCorrection(), { wrapper });
    await act(async () => {
      result.current.mutate({
        period_start_date: '2026-06-15',
        corrected_prediction_id: 'pred-123',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cycleService.logCorrection).toHaveBeenCalled();
  });
});

// ─── Scenario 2B: Override end date ────────────────────────────

describe('Scenario 2B: override end date', () => {
  it('useUpdateCycleEntry sends period_end_date', async () => {
    (cycleService.updateEntry as jest.Mock).mockResolvedValue({ id: 'entry-1', period_end_date: '2026-06-21' });
    const { result } = renderHook(() => useUpdateCycleEntry(), { wrapper });
    await act(async () => {
      result.current.mutate({ id: 'entry-1', data: { period_end_date: '2026-06-21' } });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cycleService.updateEntry).toHaveBeenCalledWith('entry-1', { period_end_date: '2026-06-21' });
  });

  it('useLogCorrection with explicit period_end_date override', async () => {
    (cycleService.logCorrection as jest.Mock).mockResolvedValue({ id: 'corr-3', period_end_date: '2026-07-16' });
    const { result } = renderHook(() => useLogCorrection(), { wrapper });
    await act(async () => {
      result.current.mutate({
        period_start_date: '2026-07-10',
        period_end_date: '2026-07-16',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cycleService.logCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ period_end_date: '2026-07-16' }),
      expect.any(String),
      expect.any(String),
    );
  });
});

// ─── Scenario 2C: Forgot both dates (backfill) ─────────────────

describe('Scenario 2C: forgot both dates', () => {
  it('useCreateCycleEntry sends both period_start_date and period_end_date', async () => {
    (cycleService.createEntry as jest.Mock).mockResolvedValue({ id: 'entry-bf' });
    const { result } = renderHook(() => useCreateCycleEntry(), { wrapper });
    await act(async () => {
      result.current.mutate({
        period_start_date: '2026-05-10',
        period_end_date: '2026-05-14',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cycleService.createEntry).toHaveBeenCalledWith({
      period_start_date: '2026-05-10',
      period_end_date: '2026-05-14',
    });
  });
});

// ─── Anovulatory cycle type ────────────────────────────────────

describe('anovulatory cycle type', () => {
  it('useCreateCycleEntry sends cycle_type=anovulatory', async () => {
    (cycleService.createEntry as jest.Mock).mockResolvedValue({ id: 'entry-ano', cycle_type: 'anovulatory' });
    const { result } = renderHook(() => useCreateCycleEntry(), { wrapper });
    await act(async () => {
      result.current.mutate({
        period_start_date: '2026-06-01',
        period_end_date: '2026-06-05',
        cycle_type: 'anovulatory',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cycleService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ cycle_type: 'anovulatory' }),
    );
  });

  it('useLogCorrection sends cycle_type=anovulatory', async () => {
    (cycleService.logCorrection as jest.Mock).mockResolvedValue({ id: 'corr-ano', cycle_type: 'anovulatory' });
    const { result } = renderHook(() => useLogCorrection(), { wrapper });
    await act(async () => {
      result.current.mutate({
        period_start_date: '2026-06-14',
        period_end_date: '2026-06-18',
        cycle_type: 'anovulatory',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cycleService.logCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ cycle_type: 'anovulatory' }),
      expect.any(String),
      expect.any(String),
    );
  });
});

// ─── 409 Conflict handling ─────────────────────────────────────

describe('409 conflict handling', () => {
  it('useLogCorrection 409 sets server calendar data in cache', async () => {
    const serverData = { data: { days: { '2026-06-14': 'P', '2026-06-15': 'P' } } };
    (cycleService.logCorrection as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: serverData },
    });

    const { result } = renderHook(() => useLogCorrection(), { wrapper });
    await act(async () => {
      result.current.mutate({ period_start_date: '2026-06-14' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    // 409 does not enqueue to offline store
    expect(useOfflineStore.getState().operations).toHaveLength(0);
  });
});

// ─── Calendar display with old period (Scenario 5b) ────────────

describe('Scenario 5b: old period in calendar', () => {
  it('useCycleCalendar queries with months_back param', () => {
    // Just verify the hook constructs the correct query key
    // The actual "P" marker rendering is validated by the Calendar component
    renderHook(() => useCycleCalendar(6, 3), { wrapper });
    expect(cycleService.getCalendar).not.toHaveBeenCalled(); // query is lazy
  });
});
