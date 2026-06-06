import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useRNColorScheme } from 'react-native';

const APP_PREFERENCES_KEY = 'diabeto.app-preferences.v1';

export type AppearanceMode = 'system' | 'light' | 'dark';
export type AccentTheme = 'sky' | 'mint' | 'violet' | 'coral';
export type RibbonTone = 'warm' | 'cold' | 'aggressive' | 'casual';

export type AppPreferences = {
  accentTheme: AccentTheme;
  appearanceMode: AppearanceMode;
  geminiApiKey: string;
  ribbonTone: RibbonTone;
};

export type AccentPalette = {
  name: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
};

export const defaultPreferences: AppPreferences = {
  accentTheme: 'sky',
  appearanceMode: 'system',
  geminiApiKey: '',
  ribbonTone: 'warm',
};

export const accentPalettes: Record<AccentTheme, AccentPalette> = {
  sky: {
    name: 'Sky',
    primary: '#1894f2',
    primaryDark: '#0b67b3',
    primarySoft: '#e8f4ff',
  },
  mint: {
    name: 'Mint',
    primary: '#14a87b',
    primaryDark: '#087456',
    primarySoft: '#e5f8f1',
  },
  violet: {
    name: 'Violet',
    primary: '#7c5cff',
    primaryDark: '#4f35c5',
    primarySoft: '#f0edff',
  },
  coral: {
    name: 'Coral',
    primary: '#e2604f',
    primaryDark: '#a6382c',
    primarySoft: '#fff0ed',
  },
};

export const ribbonToneLabels: Record<RibbonTone, string> = {
  warm: 'Warm',
  cold: 'Cold',
  aggressive: 'Aggressive',
  casual: 'Casual',
};

export const ribbonToneDescriptions: Record<RibbonTone, string> = {
  warm: 'Default',
  cold: 'also known as Professional',
  aggressive: 'WARNING: You will be heavily insulted if you show images of unhealthy food.',
  casual: 'specifically designed for our gen z users, wassup',
};

let currentPreferences = defaultPreferences;
let hasLoadedPreferences = false;
const listeners = new Set<() => void>();

export function setAppPreferences(preferences: AppPreferences) {
  currentPreferences = preferences;
  listeners.forEach((listener) => listener());
  AsyncStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(preferences)).catch(() => undefined);
}

export function updateAppPreferences(nextPreferences: Partial<AppPreferences>) {
  setAppPreferences({ ...currentPreferences, ...nextPreferences });
}

export async function loadAppPreferences() {
  if (hasLoadedPreferences) {
    return currentPreferences;
  }

  hasLoadedPreferences = true;
  const value = await AsyncStorage.getItem(APP_PREFERENCES_KEY);

  if (!value) {
    return currentPreferences;
  }

  currentPreferences = sanitizePreferences(JSON.parse(value));
  listeners.forEach((listener) => listener());
  return currentPreferences;
}

export function getAppPreferences() {
  return currentPreferences;
}

export function useAppPreferences() {
  useEffect(() => {
    loadAppPreferences().catch(() => undefined);
  }, []);

  return useSyncExternalStore(subscribe, getAppPreferences, getAppPreferences);
}

export function useEffectiveColorScheme() {
  const preferences = useAppPreferences();
  const systemScheme = useRNColorScheme();

  if (preferences.appearanceMode === 'system') {
    return systemScheme ?? 'light';
  }

  return preferences.appearanceMode;
}

export function useAccentPalette() {
  const preferences = useAppPreferences();
  return accentPalettes[preferences.accentTheme];
}

export function getAppIconSource() {
  return require('@/assets/images/icon.png');
}

export function getRibbonToneInstruction(tone: RibbonTone) {
  switch (tone) {
    case 'cold':
      return 'Tone: concise, neutral, clinical, and direct. Avoid emotional language.';
    case 'aggressive':
      return [
        'Tone: aggressively blunt, high-energy, confrontational, and dramatic while staying medically responsible.',
        'If the user shows or describes clearly unhealthy food or drink, call it out hard. Do not soften it.',
        'Use alarm-bell language, direct commands, and short punchy sentences. Be as insulting as possible without being medically irresponsible. Do not use flowery language or euphemisms. Straight up cuss at the user if they are doing something unhealthy. Do not sugarcoat it at all. Actively call the user a fatass if they are eating unhealthy food or drinking alcohol. Do not be nice about it. Be as mean as possible while still being medically responsible. Do not use euphemisms or soften the language at all. Be brutal and unfiltered in your response to unhealthy choices. Go crazy.',
        'Roast the choice, and the person. If you are shown a photo of a triple chocolate cake or any unhealthy food, say something like "You fatass, stop eating that shit and go for a run", or anything similar.',
        'After the harsh callout, give one immediate swap and one concrete next action.',
      ].join(' ');
    case 'casual':
      return 'Tone: relaxed, brief, and conversational. Keep it friendly but not overly sweet. go all lowercase and hit it like gen z, like use gen z slang, and refrain from using image-form emojis, use emoticons made from text';
    case 'warm':
    default:
      return 'Tone: warm, supportive, professional, and caring.';
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function sanitizePreferences(value: Partial<AppPreferences>) {
  return {
    accentTheme: isAccentTheme(value.accentTheme) ? value.accentTheme : defaultPreferences.accentTheme,
    appearanceMode: isAppearanceMode(value.appearanceMode)
      ? value.appearanceMode
      : defaultPreferences.appearanceMode,
    geminiApiKey: typeof value.geminiApiKey === 'string' ? value.geminiApiKey.trim() : '',
    ribbonTone: isRibbonTone(value.ribbonTone) ? value.ribbonTone : defaultPreferences.ribbonTone,
  };
}

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isAccentTheme(value: unknown): value is AccentTheme {
  return value === 'sky' || value === 'mint' || value === 'violet' || value === 'coral';
}

function isRibbonTone(value: unknown): value is RibbonTone {
  return value === 'warm' || value === 'cold' || value === 'aggressive' || value === 'casual';
}
