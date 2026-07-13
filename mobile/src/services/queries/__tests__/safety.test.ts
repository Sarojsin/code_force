import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn(), addEventListener: jest.fn() }));
jest.mock('expo-background-fetch', () => ({ BackgroundFetch: { registerTaskAsync: jest.fn(), unregisterTaskAsync: jest.fn() } }));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: jest.fn() }));
jest.mock('@sentry/react-native', () => ({ setTag: jest.fn(), captureException: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
jest.mock('src/services/api', () => ({
  safetyService: {
    createEmergencyContact: jest.fn(),
    updateEmergencyContact: jest.fn(),
    deleteEmergencyContact: jest.fn(),
    triggerSos: jest.fn(),
    cancelSos: jest.fn(),
    resolveSos: jest.fn(),
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

import { useCreateEmergencyContact, useUpdateEmergencyContact, useDeleteEmergencyContact, useTriggerSos, useCancelSos, useResolveSos } from '../safety';
import { safetyService } from 'src/services/api';
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

describe('useCreateEmergencyContact', () => {
  it('calls API on success', async () => {
    (safetyService.createEmergencyContact as jest.Mock).mockResolvedValue({ id: '1' });
    const { result } = renderHook(() => useCreateEmergencyContact(), { wrapper });
    await act(async () => { result.current.mutate({ name: 'Mom', phone_number: '+123' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(safetyService.createEmergencyContact).toHaveBeenCalledWith({ name: 'Mom', phone_number: '+123' });
  });

  it('enqueues on network error', async () => {
    (safetyService.createEmergencyContact as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useCreateEmergencyContact(), { wrapper });
    await act(async () => { result.current.mutate({ name: 'Mom', phone_number: '+123' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const pending = useOfflineStore.getState().operations;
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('safety/contact/create');
  });

  it('does NOT enqueue on 4xx', async () => {
    (safetyService.createEmergencyContact as jest.Mock).mockRejectedValue({
      isAxiosError: true, response: { status: 422, data: {} },
    });
    const { result } = renderHook(() => useCreateEmergencyContact(), { wrapper });
    await act(async () => { result.current.mutate({} as any); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useOfflineStore.getState().operations).toHaveLength(0);
  });
});

describe('useUpdateEmergencyContact', () => {
  it('enqueues on network error', async () => {
    (safetyService.updateEmergencyContact as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useUpdateEmergencyContact(), { wrapper });
    await act(async () => { result.current.mutate({ id: '1', data: { name: 'Dad' } }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const pending = useOfflineStore.getState().operations;
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('safety/contact/update');
  });
});

describe('useDeleteEmergencyContact', () => {
  it('enqueues on network error', async () => {
    (safetyService.deleteEmergencyContact as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useDeleteEmergencyContact(), { wrapper });
    await act(async () => { result.current.mutate('1'); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const pending = useOfflineStore.getState().operations;
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('safety/contact/delete');
  });
});

describe('useTriggerSos', () => {
  it('enqueues on network error', async () => {
    (safetyService.triggerSos as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useTriggerSos(), { wrapper });
    await act(async () => {
      result.current.mutate({ data: { latitude: 0, longitude: 0, trigger_source: 'button' }, idempotencyKey: 'ik1' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const pending = useOfflineStore.getState().operations;
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('safety/sos/trigger');
  });
});

describe('useCancelSos', () => {
  it('enqueues on network error', async () => {
    (safetyService.cancelSos as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useCancelSos(), { wrapper });
    await act(async () => { result.current.mutate('alert-1'); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const pending = useOfflineStore.getState().operations;
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('safety/sos/cancel');
  });
});

describe('useResolveSos', () => {
  it('enqueues on network error', async () => {
    (safetyService.resolveSos as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useResolveSos(), { wrapper });
    await act(async () => { result.current.mutate('alert-1'); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const pending = useOfflineStore.getState().operations;
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('safety/sos/resolve');
  });
});
