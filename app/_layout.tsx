import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import 'react-native-reanimated';

import { AppIntroSplash } from '@/components/app-intro-splash';
import { BrandColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccentPalette } from '@/lib/app-preferences';
import { useI18n } from '@/lib/localization';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const accent = useAccentPalette();
  const { isRtl, text } = useI18n();
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

  return (
    <ThemeProvider value={colorScheme === 'dark' ? darkTheme : lightTheme}>
      <View style={{ direction: isRtl ? 'rtl' : 'ltr', flex: 1 }}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: text.common.appName }} />
        </Stack>
        <AppIntroSplash isDark={colorScheme === 'dark'} />
        <StatusBar style="auto" />
      </View>
    </ThemeProvider>
  );
}
