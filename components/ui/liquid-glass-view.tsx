import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

type LiquidGlassViewProps = PropsWithChildren<
  ViewProps & {
    isDark?: boolean;
    interactive?: boolean;
  }
>;

export function LiquidGlassView({
  children,
  style,
  ...props
}: LiquidGlassViewProps) {
  return (
    <View style={style} {...props}>
      {children}
    </View>
  );
}

export function isLiquidGlassEnabled() {
  return false;
}
