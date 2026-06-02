import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { BrandColors } from '@/constants/theme';

type LiquidGlassViewProps = PropsWithChildren<
  ViewProps & {
    isDark?: boolean;
    interactive?: boolean;
  }
>;

const canUseLiquidGlass =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export function LiquidGlassView({
  children,
  isDark = false,
  interactive = false,
  style,
  ...props
}: LiquidGlassViewProps) {
  if (!canUseLiquidGlass) {
    return (
      <View style={style} {...props}>
        {children}
      </View>
    );
  }

  return (
    <View style={[style, styles.glassHost, isDark ? styles.glassHostDark : styles.glassHostLight]} {...props}>
      <GlassView
        colorScheme={isDark ? 'dark' : 'light'}
        glassEffectStyle="regular"
        isInteractive={interactive}
        style={StyleSheet.absoluteFill}
        tintColor={isDark ? BrandColors.primaryDark : BrandColors.primary}
      />
      {children}
    </View>
  );
}

export function isLiquidGlassEnabled() {
  return canUseLiquidGlass;
}

const styles = StyleSheet.create({
  glassHost: {
    overflow: 'hidden',
  },
  glassHostLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassHostDark: {
    backgroundColor: 'rgba(7, 19, 31, 0.24)',
  },
});
