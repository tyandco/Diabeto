import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAppPreferences } from '@/lib/app-preferences';
import { resolveLanguage, translations } from '@/lib/localization';

const REMINDER_ENABLED_KEY = 'diabeto.daily-log-reminder.enabled.v1';
const REMINDER_TIME_KEY = 'diabeto.daily-log-reminder.time.v1';
const DEFAULT_REMINDER_TIME: ReminderTime = { hour: 20, minute: 0 };

export type ReminderTime = {
  hour: number;
  minute: number;
};

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
  await AsyncStorage.setItem(REMINDER_TIME_KEY, JSON.stringify(sanitizeReminderTime(time)));
  return { enabled: false };
}

export async function setDailyLogReminderEnabled() {
  const text = translations[resolveLanguage(getAppPreferences().language)].log;

  await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
  return { enabled: false, reason: text.reminderUnavailable };
}

function sanitizeReminderTime(value: Partial<ReminderTime>): ReminderTime {
  const hour = Number(value.hour);
  const minute = Number(value.minute);

  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_REMINDER_TIME.hour,
    minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : DEFAULT_REMINDER_TIME.minute,
  };
}
