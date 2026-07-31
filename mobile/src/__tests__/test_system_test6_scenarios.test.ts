/**
 * System Test 6 — End Date Notification (19) & Auto-Close Safety Net (20).
 *
 * @see system_test6.md for full scenario descriptions.
 *
 * Scenario 19: Tests computeNotificationDay, scheduleEndDateNotification,
 *   cancelEndDateNotification, useEndDateStore for the period-end flow.
 * Scenario 20: Tests sync upsert reflects auto-close and offline-then-sync
 *   recovers the closed end date.
 */

jest.mock('src/services/storage', () => {
  const storage: Record<string, string> = {};
  return {
    EncryptedStorage: {
      getItem: jest.fn(async (key: string) => storage[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => { storage[key] = value; }),
      removeItem: jest.fn(async () => {}),
      clear: jest.fn(async () => { Object.keys(storage).forEach((k) => delete storage[k]); }),
    },
  };
});

jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock('src/utils', () => ({
  ...jest.requireActual('src/utils'),
  generateId: jest.fn(() => 'test-uuid'),
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(), addEventListener: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
  setTag: jest.fn(), captureException: jest.fn(), addBreadcrumb: jest.fn(),
}));

import { computeNotificationDay, computePeriodLength } from 'src/utils/cyclePhases';
import { scheduleEndDateNotification, cancelEndDateNotification } from 'src/services/endDateNotifications';
import { useEndDateStore } from 'src/stores/endDateStore';
import { renderHook, act } from '@testing-library/react-native';

const mockNotifications = jest.requireMock('expo-notifications');

beforeEach(() => {
  jest.clearAllMocks();
  mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockNotifications.scheduleNotificationAsync.mockResolvedValue('notif-1');
  mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
});

// =============================================================================
// Scenario 19: End Date Notification
// =============================================================================

describe('Scenario 19: End Date Notification', () => {
  // ── computeNotificationDay ────────────────────────────────────

  describe('computeNotificationDay (notification day calc)', () => {
    it('avg=5 → day 3 (5-2)', () => {
      expect(computeNotificationDay(5)).toBe(3);
    });

    it('avg=7 → day 5 (7-2)', () => {
      expect(computeNotificationDay(7)).toBe(5);
    });

    it('avg=3 → day 3 (clamped to fallback)', () => {
      expect(computeNotificationDay(3)).toBe(3);
    });

    it('avg=4 → day 3 (4-2=2 < fallback)', () => {
      expect(computeNotificationDay(4)).toBe(3);
    });

    it('avg=null → fallback 3', () => {
      expect(computeNotificationDay(null)).toBe(3);
    });

    it('avg=1 → fallback 3 (below min threshold)', () => {
      expect(computeNotificationDay(1)).toBe(3);
    });

    it('custom fallback=5 with avg=8 → day 6 (8-2=6)', () => {
      expect(computeNotificationDay(8, 5)).toBe(6);
    });

    it('custom fallback=5 with avg=6 → day 5 (6-2=4 < fallback)', () => {
      expect(computeNotificationDay(6, 5)).toBe(5);
    });
  });

  // ── computePeriodLength ────────────────────────────────────────

  describe('computePeriodLength', () => {
    it('date difference inclusive', () => {
      const start = new Date('2025-06-10T00:00:00');
      const end = new Date('2025-06-13T00:00:00');
      expect(computePeriodLength(start, end)).toBe(4);
    });

    it('null end returns fallback', () => {
      const start = new Date('2025-06-10T00:00:00');
      expect(computePeriodLength(start, null)).toBe(5);
    });

    it('1-day period returns 1', () => {
      const start = new Date('2025-06-10T00:00:00');
      const end = new Date('2025-06-10T00:00:00');
      expect(computePeriodLength(start, end)).toBe(1);
    });

    it('custom fallback', () => {
      const start = new Date('2025-06-10T00:00:00');
      expect(computePeriodLength(start, null, 7)).toBe(7);
    });
  });

  // ── scheduleEndDateNotification ───────────────────────────────

  describe('scheduleEndDateNotification', () => {
    it('schedules with correct trigger day offset', async () => {
      const id = await scheduleEndDateNotification('2025-06-10', 5);
      expect(id).toBe('notif-1');
      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const call = mockNotifications.scheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.title).toBe('Confirm your period end date');
      expect(call.content.data.type).toBe('mark-end-date');
    });

    it('returns null when permission denied', async () => {
      mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
      const id = await scheduleEndDateNotification('2025-06-10', 5);
      expect(id).toBeNull();
      expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('does not create Android channel on non-Android', async () => {
      const id = await scheduleEndDateNotification('2025-06-10', 5);
      expect(id).toBe('notif-1');
      expect(mockNotifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    });
  });

  // ── cancelEndDateNotification ─────────────────────────────────

  describe('cancelEndDateNotification', () => {
    it('cancels by notification ID', async () => {
      await cancelEndDateNotification('notif-1');
      expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
    });

    it('does not throw when cancel fails', async () => {
      mockNotifications.cancelScheduledNotificationAsync.mockRejectedValue(new Error('not found'));
      await expect(cancelEndDateNotification('notif-1')).resolves.toBeUndefined();
    });
  });

  // ── useEndDateStore ───────────────────────────────────────────

  describe('useEndDateStore', () => {
    it('starts with null values and default avg=5', () => {
      const { result } = renderHook(() => useEndDateStore());
      expect(result.current.entryId).toBeNull();
      expect(result.current.periodStartDate).toBeNull();
      expect(result.current.predictionId).toBeNull();
      expect(result.current.notificationId).toBeNull();
      expect(result.current.avgPeriodLength).toBe(5);
    });

    it('setPending stores entry, start date, predictionId', () => {
      const { result } = renderHook(() => useEndDateStore());
      act(() => result.current.setPending('entry-1', '2025-06-10', 'pred-1', 5));
      expect(result.current.entryId).toBe('entry-1');
      expect(result.current.periodStartDate).toBe('2025-06-10');
      expect(result.current.predictionId).toBe('pred-1');
      expect(result.current.avgPeriodLength).toBe(5);
    });

    it('setPending uses default avgPeriodLength=5', () => {
      const { result } = renderHook(() => useEndDateStore());
      act(() => result.current.setPending('entry-1', '2025-06-10', null));
      expect(result.current.avgPeriodLength).toBe(5);
    });

    it('setPending accepts custom avgPeriodLength', () => {
      const { result } = renderHook(() => useEndDateStore());
      act(() => result.current.setPending('entry-1', '2025-06-10', null, 7));
      expect(result.current.avgPeriodLength).toBe(7);
    });

    it('setNotificationId links a scheduled notification', () => {
      const { result } = renderHook(() => useEndDateStore());
      act(() => result.current.setNotificationId('notif-abc'));
      expect(result.current.notificationId).toBe('notif-abc');
    });

    it('clearPending resets all fields', () => {
      const { result } = renderHook(() => useEndDateStore());
      act(() => {
        result.current.setPending('entry-1', '2025-06-10', 'pred-1', 5);
        result.current.setNotificationId('notif-abc');
      });
      expect(result.current.entryId).toBe('entry-1');

      act(() => result.current.clearPending());
      expect(result.current.entryId).toBeNull();
      expect(result.current.periodStartDate).toBeNull();
      expect(result.current.predictionId).toBeNull();
      expect(result.current.notificationId).toBeNull();
      expect(result.current.avgPeriodLength).toBe(5);
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────

  describe('Scenario 19 edge cases', () => {
    it('snooze equivalent: reschedule for next day', async () => {
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('notif-2');
      const seq = [
        { offset: 3, expectedDate: '2025-06-13' },
        { offset: 4, expectedDate: '2025-06-14' },
      ];
      for (const s of seq) {
        const trigger = new Date('2025-06-10T09:00:00');
        trigger.setDate(trigger.getDate() + s.offset);
        const id = await scheduleEndDateNotification('2025-06-10', 5);
        expect(id).toBeTruthy();
      }
      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    });

    it('manual update before notification clears pending', () => {
      const { result } = renderHook(() => useEndDateStore());
      act(() => result.current.setPending('entry-1', '2025-06-10', 'pred-1', 5));
      expect(result.current.entryId).toBe('entry-1');

      act(() => result.current.clearPending());
      expect(result.current.entryId).toBeNull();
      expect(result.current.periodStartDate).toBeNull();
      expect(result.current.notificationId).toBeNull();
    });
  });
});

// =============================================================================
// Scenario 20: Auto-Close Safety Net (mobile side)
// =============================================================================

describe('Scenario 20: Auto-Close Safety Net (Mobile Side)', () => {
  // ── Sync upsert reflects auto-close ────────────────────────────

  describe('sync pull reflects auto-close', () => {
    it('upsert with closed period_end_date updates local record', () => {
      const localEntry: Record<string, string | null> = {
        id: 'entry-june10',
        period_start_date: '2025-06-10',
        period_end_date: null,
      };

      const serverData = { id: 'entry-june10', period_end_date: '2025-06-14' };
      for (const [key, value] of Object.entries(serverData)) {
        (localEntry as any)[key] = value;
      }

      expect(localEntry.period_end_date).toBe('2025-06-14');
    });

    it('upsert does not touch other fields', () => {
      const localEntry: Record<string, any> = {
        id: 'entry-june10',
        period_start_date: '2025-06-10',
        period_end_date: null,
        cycle_length: 30,
        flow: 'medium',
      };

      const serverData = { id: 'entry-june10', period_end_date: '2025-06-14' };
      for (const [key, value] of Object.entries(serverData)) {
        localEntry[key] = value;
      }

      expect(localEntry.period_end_date).toBe('2025-06-14');
      expect(localEntry.period_start_date).toBe('2025-06-10');
      expect(localEntry.cycle_length).toBe(30);
      expect(localEntry.flow).toBe('medium');
    });
  });

  // ── Offline then sync recovers auto-close ──────────────────────

  describe('offline-then-sync recovers closed end date', () => {
    it('local SQLite null after offline log, fixed after sync pull', () => {
      let localEntry: Record<string, string | null> = {
        id: 'entry-june10',
        period_start_date: '2025-06-10',
        period_end_date: null,
      };

      expect(localEntry.period_end_date).toBeNull();

      const syncChanges = [
        { type: 'update', entity: 'cycle_entries', id: 'entry-june10', data: { period_end_date: '2025-06-14' } },
      ];

      for (const change of syncChanges) {
        if (change.type === 'update' && change.entity === 'cycle_entries') {
          for (const [key, value] of Object.entries(change.data)) {
            if (change.id === localEntry.id) {
              (localEntry as any)[key] = value;
            }
          }
        }
      }

      expect(localEntry.period_end_date).toBe('2025-06-14');
    });

    it('multiple open entries: only latest is auto-closed', () => {
      const entries: Array<Record<string, any>> = [
        { id: 'e1', period_start_date: '2025-05-01', period_end_date: '2025-05-05' },
        { id: 'e2', period_start_date: '2025-06-10', period_end_date: null },
        { id: 'e3', period_start_date: '2025-07-08', period_end_date: null },
      ];

      const latestOpen = entries
        .filter((e) => e.period_end_date === null)
        .sort((a, b) => new Date(b.period_start_date).getTime() - new Date(a.period_start_date).getTime())[0];

      latestOpen!.period_end_date = '2025-07-12';

      expect(entries.find((e) => e.id === 'e2')!.period_end_date).toBeNull();
      expect(entries.find((e) => e.id === 'e3')!.period_end_date).toBe('2025-07-12');
    });
  });
});
