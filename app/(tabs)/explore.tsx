import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/lib/localization';

export default function GuideScreen() {
  const isDark = useColorScheme() === 'dark';
  const { text } = useI18n();

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="title">{text.guide.title}</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            {text.guide.subtitle}
          </ThemedText>
        </View>

        <Section title={text.guide.eatTitle} items={text.guide.mealIdeas} isDark={isDark} />
        <Section title={text.guide.doTitle} items={text.guide.habitIdeas} isDark={isDark} />

        <View style={[styles.infoBox, isDark && styles.infoBoxDark]}>
          <ThemedText type="subtitle">{text.guide.modelTitle}</ThemedText>
          <ThemedText>
            {text.guide.modelBody}
          </ThemedText>
          <ThemedText>
            {text.guide.modelFuture}
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Section({ title, items, isDark }: { title: string; items: string[]; isDark: boolean }) {
  return (
    <View style={[styles.section, isDark && styles.sectionDark]}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {items.map((item) => (
        <View key={item} style={styles.row}>
          <View style={styles.dot} />
          <ThemedText style={styles.rowText}>{item}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: Layout.tabBarContentInset,
    paddingTop: 64,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    color: BrandColors.lightMutedText,
  },
  mutedDark: {
    color: BrandColors.darkMutedText,
  },
  section: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    backgroundColor: BrandColors.primary,
    borderRadius: 4,
    height: 8,
    marginTop: 8,
    width: 8,
  },
  rowText: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  infoBoxDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
    borderColor: BrandColors.darkBorder,
  },
});
