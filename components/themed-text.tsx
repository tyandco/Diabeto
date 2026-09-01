import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useI18n } from '@/lib/localization';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const { language } = useI18n();
  const fontSet =
    language === 'ar'
      ? {
          medium: Fonts.arabicMedium,
          bold: Fonts.arabicBold,
          regular: Fonts.arabic,
          semiBold: Fonts.arabicSemiBold,
        }
      : {
          medium: Fonts.displayMedium,
          bold: Fonts.displayBold,
          regular: Fonts.display,
          semiBold: Fonts.displaySemiBold,
        };
  const flattenedStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  const { fontFamily, fontWeight, ...styleWithoutFontWeight } = flattenedStyle ?? {};
  const resolvedFontFamily = fontFamily ?? resolveFontFamily(type, fontWeight, fontSet);

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        styleWithoutFontWeight,
        { fontFamily: resolvedFontFamily },
      ]}
      {...rest}
    />
  );
}

function resolveFontFamily(
  type: NonNullable<ThemedTextProps['type']>,
  fontWeight: TextStyle['fontWeight'],
  fontSet: { bold: string; medium: string; regular: string; semiBold: string }
) {
  if (type === 'title' || type === 'subtitle') {
    return fontSet.bold;
  }

  if (type === 'defaultSemiBold' || type === 'link') {
    return fontSet.semiBold;
  }

  const numericWeight = typeof fontWeight === 'string' ? Number(fontWeight) : fontWeight;

  if (fontWeight === 'bold' || fontWeight === '900' || fontWeight === '800' || numericWeight === 900 || numericWeight === 800) {
    return fontSet.bold;
  }

  if (fontWeight === '700' || fontWeight === '600' || numericWeight === 700 || numericWeight === 600) {
    return fontSet.semiBold;
  }

  if (fontWeight === '500' || numericWeight === 500) {
    return fontSet.medium;
  }

  return fontSet.regular;
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    // Ensure no text shadow on mobile devices
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 34,
    letterSpacing: 0,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 21,
    letterSpacing: 0,
    lineHeight: 27,
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
});
