/**
 * useCurrentCycleState — empty-state correctness.
 *
 * Regression guard against the "28-day default trap": when a user has no
 * current cycle anchor, the hook MUST return null (not a fabricated 14/28
 * fallback) so the Home screen can render an empty state instead.
 */

import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('expo', () => ({ requireNativeModule: jest.fn(), default: {}, isRunningInExpoGo: jest.fn() }));
jest.mock('src/stores/authStore', () => ({
  useAuthStore: jest.fn((selector: any) => {
    const state = { user: { id: 'user-a' } };
    return selector ? selector(state) : state;
  }),
}));
jest.mock('src/services/queries', () => ({
  useCycleCalendar: jest.fn(() => ({
    data: null, isLoading: false, error: null, refetch: jest.fn(),
  })),
}));

import { useCurrentCycleState } from '../useCurrentCycleState';
import { useCycleCalendar } from 'src/services/queries';

describe('useCurrentCycleState empty state', () => {
  it('returns null cycleDay / nextPeriodDays / predictedCycleLength when no data', async () => {
    const { result } = renderHook(() => useCurrentCycleState());
    await waitFor(() => {
      expect(result.current.cycleDay).toBeNull();
      expect(result.current.hasCycleData).toBe(false);
      expect(result.current.nextPeriodDays).toBeNull();
      expect(result.current.predictedCycleLength).toBeNull();
    });
  });

  it('never fabricates the 28-day default', async () => {
    const { result } = renderHook(() => useCurrentCycleState());
    await waitFor(() => {
      expect(result.current.predictedCycleLength).not.toBe(28);
      expect(result.current.nextPeriodDays).not.toBe(14);
    });
  });

  it('resolves predictedCycleLength from nested predictions, not a hardcoded default', async () => {
    (useCycleCalendar as jest.Mock).mockReturnValue({
      data: {
        days: { '2025-01-01': 'P', '2025-01-02': 'P', '2025-01-03': 'P', '2025-01-04': 'P', '2025-01-05': 'P' },
        predictions: { predicted_cycle_length: 30 },
        next_period_in_days: 20,
      },
      isLoading: false, error: null, refetch: jest.fn(),
    });
    const { result } = renderHook(() => useCurrentCycleState());
    await waitFor(() => {
      expect(result.current.nextPeriodDays).toBe(20);
      expect(result.current.predictedCycleLength).toBe(30);
    });
  });
});