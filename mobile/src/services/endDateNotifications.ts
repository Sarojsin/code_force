import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { computeNotificationDay } from 'src/utils/cyclePhases';

export async function requestEndDatePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('period-end', {
      name: 'Period End Reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleEndDateNotification(
  periodStartDate: string,
  avgPeriodLength: number,
): Promise<string | null> {
  const granted = await requestEndDatePermission();
  if (!granted) return null;

  const startDate = new Date(periodStartDate + 'T09:00:00');
  const daysOffset = computeNotificationDay(avgPeriodLength);
  const triggerDate = new Date(startDate.getTime() + daysOffset * 86400000);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Confirm your period end date',
      body: 'Did your period end? Confirm so we can keep your predictions accurate.',
      data: { type: 'mark-end-date' },
    },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: triggerDate },
  });
  return id;
}

export async function cancelEndDateNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // fail silently
  }
}
