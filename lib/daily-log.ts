import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_LOG_KEY_PREFIX = 'diabeto.daily-log.';

export type DailyLogMood = 'steady' | 'tired' | 'stressed' | 'good';

export type DailyLog = {
  activityMinutes: string;
  balancedMeals: number;
  glucoseMgDl: string;
  mood: DailyLogMood;
  notes: string;
  sleepHours: string;
  waterCups: number;
};

export type DailyLogEntry = {
  date: string;
  log: DailyLog;
};

export const initialDailyLog: DailyLog = {
  activityMinutes: '',
  balancedMeals: 2,
  glucoseMgDl: '',
  mood: 'steady',
  notes: '',
  sleepHours: '',
  waterCups: 6,
};

export function getTodayLogDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function loadDailyLog(date = getTodayLogDate()) {
  const value = await AsyncStorage.getItem(getDailyLogKey(date));
  return value ? { ...initialDailyLog, ...(JSON.parse(value) as Partial<DailyLog>) } : null;
}

export async function saveDailyLog(log: DailyLog, date = getTodayLogDate()) {
  await AsyncStorage.setItem(getDailyLogKey(date), JSON.stringify(log));
}

export async function loadDailyLogs(limit = 14) {
  const keys = await AsyncStorage.getAllKeys();
  const logKeys = keys
    .filter((key) => key.startsWith(DAILY_LOG_KEY_PREFIX))
    .sort()
    .reverse()
    .slice(0, limit);

  const values = await AsyncStorage.multiGet(logKeys);

  return values
    .map<DailyLogEntry | null>(([key, value]) => {
      if (!value) {
        return null;
      }

      return {
        date: key.replace(DAILY_LOG_KEY_PREFIX, ''),
        log: { ...initialDailyLog, ...(JSON.parse(value) as Partial<DailyLog>) },
      };
    })
    .filter((entry): entry is DailyLogEntry => Boolean(entry));
}

export function formatDailyLogHistoryForAI(entries: DailyLogEntry[]) {
  if (entries.length === 0) {
    return null;
  }

  return entries
    .slice(0, 5)
    .map(({ date, log }) =>
      [
        date,
        `glu=${log.glucoseMgDl || 'na'}`,
        `act=${log.activityMinutes || '0'}m`,
        `sleep=${log.sleepHours || 'na'}h`,
        `water=${log.waterCups}`,
        `meals=${log.balancedMeals}`,
        `mood=${log.mood}`,
        log.notes ? `note=${compactNote(log.notes)}` : null,
      ]
        .filter(Boolean)
        .join(';')
    )
    .join('\n');
}

function compactNote(note: string) {
  return note.trim().replace(/\s+/g, ' ').slice(0, 90);
}

function getDailyLogKey(date: string) {
  return `${DAILY_LOG_KEY_PREFIX}${date}`;
}
