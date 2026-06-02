/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const BrandColors = {
  primary: '#1894f2',
  primaryDark: '#0b67b3',
  primarySoft: '#e8f4ff',
  accent: '#f2a64b',
  lightBackground: '#f6faff',
  lightSurface: '#ffffff',
  lightSurfaceStrong: '#e8f4ff',
  lightBorder: '#c8e5fb',
  lightMutedText: '#51616f',
  lightInputText: '#102a3f',
  darkBackground: '#07131f',
  darkSurface: '#0d2033',
  darkSurfaceStrong: '#123659',
  darkBorder: '#245f90',
  darkMutedText: '#b6c8d6',
  darkInputText: '#eaf6ff',
};

const tintColorLight = BrandColors.primary;
const tintColorDark = BrandColors.primary;

export const Colors = {
  light: {
    text: BrandColors.lightInputText,
    background: BrandColors.lightBackground,
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: BrandColors.darkBackground,
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Layout = {
  tabBarHeight: 58,
  tabBarBottomOffset: 0,
  tabBarContentInset: 28,
};

export const Fonts = Platform.select({
  ios: {
    display: 'SF Pro Display',
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    display: 'Inter',
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    display: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
