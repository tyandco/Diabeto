import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_ENABLED_KEY = 'diabeto.daily-log-reminder.enabled.v1';
const REMINDER_ID_KEY = 'diabeto.daily-log-reminder.id.v1';
const REMINDER_CHANNEL_ID = 'daily-log-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getDailyLogReminderEnabled() {
  return (await AsyncStorage.getItem(REMINDER_ENABLED_KEY)) === 'true';
}

export async function setDailyLogReminderEnabled(enabled: boolean) {
  if (!enabled) {
    await cancelDailyLogReminder();
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
    return { enabled: false };
  }

  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
    return { enabled: false, reason: 'Daily reminders are available in the mobile app.' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Daily log reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const permission = await Notifications.getPermissionsAsync();
  const finalPermission =
    permission.status === 'granted' ? permission : await Notifications.requestPermissionsAsync();

  if (finalPermission.status !== 'granted') {
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
    return { enabled: false, reason: 'Notification permission was not granted.' };
  }

  await cancelDailyLogReminder();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Log your Diabeto day',
      body: 'Add glucose, activity, sleep, water, and meals to keep your streak going.',
      data: { url: '/(tabs)/log' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      channelId: REMINDER_CHANNEL_ID,
      hour: 20,
      minute: 0,
    },
  });

  await AsyncStorage.multiSet([
    [REMINDER_ENABLED_KEY, 'true'],
    [REMINDER_ID_KEY, id],
  ]);

  return { enabled: true };
}

async function cancelDailyLogReminder() {
  const existingId = await AsyncStorage.getItem(REMINDER_ID_KEY);

  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
    await AsyncStorage.removeItem(REMINDER_ID_KEY);
  }
}
