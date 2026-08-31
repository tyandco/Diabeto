import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DailyLog } from '@/lib/daily-log';
import type { HealthContext } from '@/lib/health-context';
import { supabase } from '@/lib/supabase';

const HEALTH_CONTEXT_KEY = 'diabeto.health-context.v1';
const DAILY_LOG_KEY_PREFIX = 'diabeto.daily-log.';
const ONBOARDING_COMPLETE_KEY = 'diabeto.onboarding-complete.v1';

export async function syncHealthContextForCurrentUser(context: HealthContext) {
  if (!supabase) {
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase.from('health_contexts').upsert({
    user_id: user.id,
    profile: context.profile,
    prediction: context.prediction,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn('Could not sync health context to Supabase.', error.message);
  }
}

export async function syncDailyLogForCurrentUser(date: string, log: DailyLog) {
  if (!supabase) {
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase.from('daily_logs').upsert({
    user_id: user.id,
    log_date: date,
    log,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn('Could not sync daily log to Supabase.', error.message);
  }
}

export async function syncStoredUserDataForCurrentUser() {
  if (!supabase) {
    return;
  }

  const healthContextValue = await AsyncStorage.getItem(HEALTH_CONTEXT_KEY);

  if (healthContextValue) {
    await syncHealthContextForCurrentUser(JSON.parse(healthContextValue) as HealthContext);
  }

  const keys = await AsyncStorage.getAllKeys();
  const logKeys = keys.filter((key) => key.startsWith(DAILY_LOG_KEY_PREFIX));
  const logs = await AsyncStorage.multiGet(logKeys);

  await Promise.all(
    logs.map(([key, value]) => {
      if (!value) {
        return Promise.resolve();
      }

      return syncDailyLogForCurrentUser(
        key.replace(DAILY_LOG_KEY_PREFIX, ''),
        JSON.parse(value) as DailyLog
      );
    })
  );
}

export async function restoreUserDataForCurrentUser() {
  if (!supabase) {
    return { hasHealthContext: false };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { hasHealthContext: false };
  }

  const { data: healthContext } = await supabase
    .from('health_contexts')
    .select('profile, prediction')
    .eq('user_id', user.id)
    .maybeSingle();

  if (healthContext?.profile && healthContext.prediction) {
    await AsyncStorage.setItem(
      HEALTH_CONTEXT_KEY,
      JSON.stringify({
        profile: healthContext.profile,
        prediction: healthContext.prediction,
      })
    );
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  }

  const { data: dailyLogs } = await supabase
    .from('daily_logs')
    .select('log_date, log')
    .eq('user_id', user.id)
    .order('log_date', { ascending: false })
    .limit(90);

  if (dailyLogs) {
    await Promise.all(
      dailyLogs.map((entry) =>
        AsyncStorage.setItem(`${DAILY_LOG_KEY_PREFIX}${entry.log_date}`, JSON.stringify(entry.log))
      )
    );
  }

  return { hasHealthContext: Boolean(healthContext?.profile && healthContext.prediction) };
}
