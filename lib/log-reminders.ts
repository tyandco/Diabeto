import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getAppPreferences } from '@/lib/app-preferences';
import { resolveLanguage, translations } from '@/lib/localization';

const REMINDER_ENABLED_KEY = 'diabeto.daily-log-reminder.enabled.v1';
const REMINDER_ID_KEY = 'diabeto.daily-log-reminder.id.v1';
const REMINDER_TIME_KEY = 'diabeto.daily-log-reminder.time.v1';
const REMINDER_CHANNEL_ID = 'daily-log-reminders';
const DEFAULT_REMINDER_TIME: ReminderTime = { hour: 20, minute: 0 };

export type ReminderTime = {
  hour: number;
  minute: number;
};

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

export async function getDailyLogReminderTime() {
  const value = await AsyncStorage.getItem(REMINDER_TIME_KEY);

  if (!value) {
    return DEFAULT_REMINDER_TIME;
  }

  try {
    return sanitizeReminderTime(JSON.parse(value));
  } catch {
    return DEFAULT_REMINDER_TIME;
  }
}

export async function setDailyLogReminderTime(time: ReminderTime) {
  const nextTime = sanitizeReminderTime(time);
  await AsyncStorage.setItem(REMINDER_TIME_KEY, JSON.stringify(nextTime));

  if (await getDailyLogReminderEnabled()) {
    return setDailyLogReminderEnabled(true, nextTime);
  }

  return { enabled: false };
}

export async function setDailyLogReminderEnabled(enabled: boolean, time?: ReminderTime) {
  const text = translations[resolveLanguage(getAppPreferences().language)].log;
  const reminderTime = time ? sanitizeReminderTime(time) : await getDailyLogReminderTime();

  if (!enabled) {
    await cancelDailyLogReminder();
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
    return { enabled: false };
  }

  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
    return { enabled: false, reason: text.reminderUnavailable };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: text.reminderChannel,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const permission = await Notifications.getPermissionsAsync();
  const finalPermission =
    permission.status === 'granted' ? permission : await Notifications.requestPermissionsAsync();

  if (finalPermission.status !== 'granted') {
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
    return { enabled: false, reason: text.reminderPermissionDenied };
  }

  await cancelDailyLogReminder();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: text.reminderTitle,
      body: text.reminderBody,
      data: { url: '/(tabs)/log' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      channelId: REMINDER_CHANNEL_ID,
      hour: reminderTime.hour,
      minute: reminderTime.minute,
    },
  });

  await AsyncStorage.multiSet([
    [REMINDER_ENABLED_KEY, 'true'],
    [REMINDER_ID_KEY, id],
    [REMINDER_TIME_KEY, JSON.stringify(reminderTime)],
  ]);

  return { enabled: true };
}

function sanitizeReminderTime(value: Partial<ReminderTime>): ReminderTime {
  const hour = Number(value.hour);
  const minute = Number(value.minute);

  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_REMINDER_TIME.hour,
    minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : DEFAULT_REMINDER_TIME.minute,
  };
}

async function cancelDailyLogReminder() {
  const existingId = await AsyncStorage.getItem(REMINDER_ID_KEY);

  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
    await AsyncStorage.removeItem(REMINDER_ID_KEY);
  }
}
