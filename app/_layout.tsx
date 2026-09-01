import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  NotoSansArabic_400Regular,
  NotoSansArabic_500Medium,
  NotoSansArabic_600SemiBold,
  NotoSansArabic_700Bold,
} from '@expo-google-fonts/noto-sans-arabic';
import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from '@expo-google-fonts/rubik';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import { AppIntroSplash } from '@/components/app-intro-splash';
import { BrandColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccentPalette } from '@/lib/app-preferences';
import { AuthProvider } from '@/lib/auth-context';
import { initializeHomeTipCycle } from '@/lib/home-tip';
import { useI18n } from '@/lib/localization';
import { useNotificationObserver } from '@/lib/notification-observer';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  useNotificationObserver();
  const [fontsLoaded] = useFonts({
    NotoSansArabic_400Regular,
    NotoSansArabic_500Medium,
    NotoSansArabic_600SemiBold,
    NotoSansArabic_700Bold,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });
  const colorScheme = useColorScheme();
  const accent = useAccentPalette();
  const { isRtl, text } = useI18n();

  useEffect(() => {
    initializeHomeTipCycle(text.home.tips.length);
  }, [text.home.tips.length]);

  const lightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: accent.primary,
      background: BrandColors.lightBackground,
      card: BrandColors.lightBackground,
      border: BrandColors.lightBorder,
      text: '#11181C',
    },
  };
  const darkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: accent.primary,
      background: BrandColors.darkBackground,
      card: BrandColors.darkSurface,
      border: BrandColors.darkBorder,
      text: '#ECEDEE',
    },
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? darkTheme : lightTheme}>
      <AuthProvider>
        <View style={{ direction: isRtl ? 'rtl' : 'ltr', flex: 1 }}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="account" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: text.common.appName }} />
          </Stack>
          <AppIntroSplash isDark={colorScheme === 'dark'} />
          <StatusBar style="auto" />
        </View>
      </AuthProvider>
    </ThemeProvider>
  );
}
