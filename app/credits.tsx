import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccentPalette } from '@/lib/app-preferences';
import { useI18n } from '@/lib/localization';

export default function CreditsScreen() {
  const accent = useAccentPalette();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { text } = useI18n();

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Layout.tabBarContentInset,
            paddingTop: Math.max(insets.top + 28, 58),
          },
        ]}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel={text.common.back}
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[styles.iconButton, isDark && styles.iconButtonDark]}>
            <IconSymbol
              color={isDark ? BrandColors.darkInputText : BrandColors.lightInputText}
              name="chevron.left"
              size={22}
            />
          </Pressable>
        </View>

        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: accent.primary }]}>
            <IconSymbol color="#ffffff" name="sparkles" size={26} />
          </View>
          <View style={styles.headerCopy}>
            <ThemedText type="title">{text.settings.credits}</ThemedText>
            <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
              {text.settings.creditsSubtitle}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.panel, isDark && styles.panelDark]}>
          {text.settings.creditsItems.map((item) => (
            <View key={item} style={[styles.creditRow, isDark && styles.creditRowDark]}>
              <View style={[styles.creditDot, { backgroundColor: accent.primary }]} />
              <ThemedText style={[styles.creditText, isDark && styles.creditTextDark]}>{item}</ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 18,
    padding: 20,
  },
  topBar: {
    alignItems: 'flex-start',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconButtonDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  headerIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  subtitle: {
    color: BrandColors.lightMutedText,
  },
  mutedDark: {
    color: BrandColors.darkMutedText,
  },
  panel: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  panelDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  creditRow: {
    alignItems: 'center',
    backgroundColor: BrandColors.lightBackground,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  creditRowDark: {
    backgroundColor: BrandColors.darkBackground,
  },
  creditDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  creditText: {
    color: BrandColors.lightInputText,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  creditTextDark: {
    color: BrandColors.darkInputText,
  },
});
