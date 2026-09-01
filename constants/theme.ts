/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

export const BrandColors = {
  primary: '#0c8f8f',
  primaryDark: '#086665',
  primarySoft: '#dff7f4',
  accent: '#e56f4f',
  lightBackground: '#f7f4ee',
  lightSurface: '#ffffff',
  lightSurfaceStrong: '#eef7f4',
  lightBorder: '#d9e3dd',
  glassBorder: 'rgba(255, 255, 255, 0.68)',
  lightMutedText: '#62706b',
  lightInputText: '#172621',
  darkBackground: '#101714',
  darkSurface: '#17221e',
  darkSurfaceStrong: '#20332d',
  darkBorder: '#34534b',
  darkMutedText: '#b8c8c2',
  darkInputText: '#f2faf6',
  shadow: '#18231f',
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
  tabBarHeight: 72,
  tabBarBottomOffset: 14,
  tabBarContentInset: 168,
};

export const Fonts = {
  arabic: 'NotoSansArabic_400Regular',
  arabicMedium: 'NotoSansArabic_500Medium',
  arabicSemiBold: 'NotoSansArabic_600SemiBold',
  arabicBold: 'NotoSansArabic_700Bold',
  display: 'Rubik_400Regular',
  displayMedium: 'Rubik_500Medium',
  displaySemiBold: 'Rubik_600SemiBold',
  displayBold: 'Rubik_700Bold',
  mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  sans: 'Rubik_400Regular',
};
