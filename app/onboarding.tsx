import { Link } from 'expo-router';
import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors } from '@/constants/theme';

const features = [
  'Estimate your diabetes risk from simple health details.',
  'Get food and activity advice based on your result.',
  'Ask DiabetoBot quick questions about healthier habits.',
];

export default function OnboardingScreen() {
  const isDark = useColorScheme() === 'dark';

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoMark}>
          <ThemedText style={styles.logoText}>D</ThemedText>
        </View>

        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Diabeto
          </ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            A simple diabetes prediction and prevention assistant for everyday choices.
          </ThemedText>
        </View>

        <View style={styles.featureList}>
          {features.map((feature, index) => (
            <View key={feature} style={[styles.featureRow, isDark && styles.featureRowDark]}>
              <View style={styles.featureNumber}>
                <ThemedText style={styles.featureNumberText}>{index + 1}</ThemedText>
              </View>
              <ThemedText style={styles.featureText}>{feature}</ThemedText>
            </View>
          ))}
        </View>

        <Link href="/(tabs)" style={styles.button}>
          <ThemedText style={styles.buttonText}>Get Started</ThemedText>
        </Link>

        <ThemedText style={[styles.disclaimer, isDark && styles.mutedDark]}>
          Diabeto is educational and should not replace professional medical care.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 28,
    justifyContent: 'center',
    padding: 24,
  },
  logoMark: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 24,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 48,
  },
  header: {
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: BrandColors.primary,
  },
  subtitle: {
    color: BrandColors.lightMutedText,
    maxWidth: 360,
    textAlign: 'center',
  },
  mutedDark: {
    color: BrandColors.darkMutedText,
  },
  featureList: {
    gap: 12,
  },
  featureRow: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  featureRowDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  featureNumber: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  featureNumberText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  featureText: {
    flex: 1,
  },
  button: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 8,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    textAlign: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  disclaimer: {
    color: BrandColors.lightMutedText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
