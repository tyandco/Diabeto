import { StyleSheet, Text, type TextProps } from 'react-native';

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
          bold: Fonts.arabicBold,
          regular: Fonts.arabic,
          semiBold: Fonts.arabicSemiBold,
        }
      : {
          bold: Fonts.displayBold,
          regular: Fonts.display,
          semiBold: Fonts.displaySemiBold,
        };

  return (
    <Text
      style={[
        { color },
        type === 'default' ? [styles.default, { fontFamily: fontSet.regular }] : undefined,
        type === 'title' ? [styles.title, { fontFamily: fontSet.bold }] : undefined,
        type === 'defaultSemiBold' ? [styles.defaultSemiBold, { fontFamily: fontSet.semiBold }] : undefined,
        type === 'subtitle' ? [styles.subtitle, { fontFamily: fontSet.bold }] : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
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
    fontFamily: Fonts.displaySemiBold,
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
});
