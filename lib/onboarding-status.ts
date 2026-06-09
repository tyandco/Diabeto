import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = 'diabeto.onboarding-complete.v1';
const HEALTH_CONTEXT_KEY = 'diabeto.health-context.v1';
const ONBOARDING_TESTING_MODE = false;

export async function hasCompletedOnboarding() {
  if (ONBOARDING_TESTING_MODE) {
    return false;
  }

  if ((await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)) === 'true') {
    return true;
  }

  if (await AsyncStorage.getItem(HEALTH_CONTEXT_KEY)) {
    await markOnboardingComplete();
    return true;
  }

  return false;
}

export async function markOnboardingComplete() {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
}
