import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LiquidGlassView } from '@/components/ui/liquid-glass-view';
import { BrandColors, Layout } from '@/constants/theme';

const mealIdeas = [
  'Breakfast: oats with berries, plain yogurt, and nuts.',
  'Lunch: grilled chicken or beans with salad and brown rice.',
  'Dinner: fish, lentils, or tofu with vegetables and a small whole grain portion.',
  'Snack: apple slices, boiled eggs, hummus with carrots, or unsalted nuts.',
];

const habitIdeas = [
  'Walk for 10 to 20 minutes after meals when possible.',
  'Keep water nearby and avoid buying sugary drinks for home.',
  'Sleep 7 to 9 hours because poor sleep can raise cravings and glucose levels.',
  'Check weight, activity, and glucose trends weekly instead of judging one day.',
];

export default function GuideScreen() {
  const isDark = useColorScheme() === 'dark';

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="title">Guide</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            Simple food and lifestyle targets for lowering diabetes risk.
          </ThemedText>
        </View>

        <Section title="What to Eat" items={mealIdeas} isDark={isDark} />
        <Section title="What to Do" items={habitIdeas} isDark={isDark} />

        <LiquidGlassView isDark={isDark} style={[styles.infoBox, isDark && styles.infoBoxDark]}>
          <ThemedText type="subtitle">About the Model</ThemedText>
          <ThemedText>
            Diabeto uses a lightweight local scoring model based on common risk factors:
            age, BMI, glucose, family history, activity level, and sugary drink intake.
          </ThemedText>
          <ThemedText>
            A future version can connect this screen to a trained Python or cloud AI model after
            you collect a real dataset and decide where predictions should run.
          </ThemedText>
        </LiquidGlassView>
      </ScrollView>
    </ThemedView>
  );
}

function Section({ title, items, isDark }: { title: string; items: string[]; isDark: boolean }) {
  return (
    <LiquidGlassView isDark={isDark} style={[styles.section, isDark && styles.sectionDark]}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {items.map((item) => (
        <View key={item} style={styles.row}>
          <View style={styles.dot} />
          <ThemedText style={styles.rowText}>{item}</ThemedText>
        </View>
      ))}
    </LiquidGlassView>
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
