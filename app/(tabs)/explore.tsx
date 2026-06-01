import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

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
  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="title">Guide</ThemedText>
          <ThemedText style={styles.subtitle}>
            Simple food and lifestyle targets for lowering diabetes risk.
          </ThemedText>
        </View>

        <Section title="What to Eat" items={mealIdeas} />
        <Section title="What to Do" items={habitIdeas} />

        <View style={styles.infoBox}>
          <ThemedText type="subtitle">About the Model</ThemedText>
          <ThemedText>
            Diabeto uses a lightweight local scoring model based on common risk factors:
            age, BMI, glucose, family history, activity level, and sugary drink intake.
          </ThemedText>
          <ThemedText>
            A future version can connect this screen to a trained Python or cloud AI model after
            you collect a real dataset and decide where predictions should run.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.section}>
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
    paddingTop: 64,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    color: '#51615c',
  },
  section: {
    backgroundColor: '#f7fbf8',
    borderColor: '#d9e8df',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    backgroundColor: '#16724a',
    borderRadius: 4,
    height: 8,
    marginTop: 8,
    width: 8,
  },
  rowText: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: '#eef7f2',
    borderColor: '#c9e0d4',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
});
