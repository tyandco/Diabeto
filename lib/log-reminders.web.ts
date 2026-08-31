import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_ENABLED_KEY = 'diabeto.daily-log-reminder.enabled.v1';

export async function getDailyLogReminderEnabled() {
  return (await AsyncStorage.getItem(REMINDER_ENABLED_KEY)) === 'true';
}

export async function setDailyLogReminderEnabled() {
  await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
  return { enabled: false, reason: 'Daily reminders are available in the mobile app.' };
}
