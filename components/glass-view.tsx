import type React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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

  return (
    <View style={[styles.base, isDark ? styles.dark : styles.light, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  dark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: 'rgba(184, 200, 194, 0.2)',
  },
  light: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
  },
});
