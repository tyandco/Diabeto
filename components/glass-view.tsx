import { BlurView } from 'expo-blur';
import type React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function GlassView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const isDark = useColorScheme() === 'dark';
  const glassStyle = [styles.base, isDark ? styles.dark : styles.light, style];

  if (Platform.OS === 'android') {
    return <View style={glassStyle}>{children}</View>;
  }

  return (
    <BlurView
      experimentalBlurMethod="dimezisBlurView"
      intensity={isDark ? 16 : 24}
      style={glassStyle}
      tint={isDark ? 'dark' : 'light'}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  dark: {
    backgroundColor: 'rgba(23, 34, 30, 0.72)',
    borderColor: 'rgba(184, 200, 194, 0.2)',
  },
  light: {
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderColor: BrandColors.glassBorder,
  },
});
