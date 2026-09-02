import { StyleSheet, Text, type TextStyle, type TextProps } from 'react-native';

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
  const flattenedStyle = StyleSheet.flatten(style);
  const fontSet =
    language === 'ar'
      ? {
          bold: Fonts.arabicBold,
          regular: Fonts.arabic,
          semiBold: Fonts.arabicSemiBold,
        }
      : {
          bold: Fonts.displayBold,
          regular: Fonts.display,
          semiBold: Fonts.displaySemiBold,
        };
  const fontFamily = getFontFamily(type, fontSet, flattenedStyle);

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
        { fontFamily },
      ]}
      {...rest}
    />
  );
}

function getFontFamily(
  type: ThemedTextProps['type'],
  fontSet: { bold: string; regular: string; semiBold: string },
  style?: TextStyle
) {
  if (type === 'title' || type === 'subtitle') {
    return fontSet.bold;
  }

  if (type === 'defaultSemiBold' || type === 'link') {
    return fontSet.semiBold;
  }

  const weight = style?.fontWeight;

  if (weight === 'bold' || weight === '700' || weight === '800' || weight === '900') {
    return fontSet.bold;
  }

  if (weight === '500' || weight === '600') {
    return fontSet.semiBold;
  }

  return fontSet.regular;
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
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
