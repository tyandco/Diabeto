import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

const HOME_TIP_INDEX_KEY = 'diabeto.home-tip-index.v1';

let currentTipIndex = 0;
let didInitializeForLaunch = false;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function normalizeIndex(value: string | null, tipCount: number) {
  const parsedIndex = Number(value);

  if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
    return 0;
  }

  return parsedIndex % tipCount;
}

export function initializeHomeTipCycle(tipCount: number) {
  if (didInitializeForLaunch || tipCount <= 0) {
    return;
  }

  didInitializeForLaunch = true;

  AsyncStorage.getItem(HOME_TIP_INDEX_KEY)
    .then((value) => {
      const launchTipIndex = normalizeIndex(value, tipCount);
      currentTipIndex = launchTipIndex;
      emitChange();

      return AsyncStorage.setItem(HOME_TIP_INDEX_KEY, String((launchTipIndex + 1) % tipCount));
    })
    .catch(() => undefined);
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return currentTipIndex;
}

export function useHomeTipIndex(tipCount: number) {
  useEffect(() => {
    initializeHomeTipCycle(tipCount);
  }, [tipCount]);

  const tipIndex = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (tipCount <= 0) {
    return 0;
  }

  return tipIndex % tipCount;
}
