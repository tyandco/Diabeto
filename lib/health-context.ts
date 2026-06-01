import { useSyncExternalStore } from 'react';

import type { DiabetesPrediction, DiabetesProfile } from '@/lib/diabetes-advisor';

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
    `Glucose: ${profile.glucoseMgDl} mg/dL`,
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
