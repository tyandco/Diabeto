import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DiabetesPrediction, DiabetesProfile } from '@/lib/diabetes-advisor';

const HEALTH_CONTEXT_KEY = 'diabeto.health-context.v1';

export type HealthContext = {
  profile: DiabetesProfile;
  prediction: DiabetesPrediction;
};

let currentHealthContext: HealthContext | null = null;
const listeners = new Set<() => void>();

export function setHealthContext(context: HealthContext | null) {
  currentHealthContext = context;
  listeners.forEach((listener) => listener());
}

export async function saveHealthContext(context: HealthContext) {
  setHealthContext(context);
  await AsyncStorage.setItem(HEALTH_CONTEXT_KEY, JSON.stringify(context));
}

export async function loadHealthContext() {
  const value = await AsyncStorage.getItem(HEALTH_CONTEXT_KEY);

  if (!value) {
    return null;
  }

  const context = JSON.parse(value) as HealthContext;
  setHealthContext(context);
  return context;
}

export function getHealthContext() {
  return currentHealthContext;
}

export function useHealthContext() {
  return useSyncExternalStore(subscribe, getHealthContext, getHealthContext);
}

export function formatHealthContext(context: HealthContext | null) {
  if (!context) {
    return null;
  }

  const { profile, prediction } = context;

  return [
    `Age: ${profile.age}`,
    `Height: ${profile.heightCm} cm`,
    `Weight: ${profile.weightKg} kg`,
    `BMI: ${prediction.bmi}`,
    `Can measure glucose now: ${profile.canMeasureGlucose ? 'yes' : 'no'}`,
    `Glucose: ${typeof profile.glucoseMgDl === 'number' ? `${profile.glucoseMgDl} mg/dL` : 'not provided'}`,
    `Family history: ${profile.familyHistory ? 'yes' : 'no'}`,
    `Activity level: ${profile.activityLevel}`,
    `Sugary drinks: ${profile.sugaryDrinks}`,
    `Predicted risk: ${prediction.riskLevel}`,
    `Risk score: ${prediction.score}/100`,
  ].join('\n');
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
