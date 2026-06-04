import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAppIconSource, useAccentPalette } from '@/lib/app-preferences';

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const accent = useAccentPalette();
  const router = useRouter();

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={getAppIconSource()} style={styles.heroIcon} />
          <View style={styles.heroCopy}>
            <ThemedText type="title">Diabeto</ThemedText>
            <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
              Track risk, understand meals, and chat through healthier choices.
            </ThemedText>
          </View>
        </View>

        <View style={[styles.summaryBand, isDark && styles.summaryBandDark]}>
          <ThemedText style={[styles.kicker, isDark && styles.kickerDark]}>Today</ThemedText>
          <ThemedText type="subtitle">Start with a quick risk check.</ThemedText>
          <ThemedText style={[styles.summaryText, isDark && styles.mutedDark]}>
            Your prediction data also helps Ribbon give more specific food and habit advice.
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(tabs)/predict')}
            style={[styles.primaryAction, { backgroundColor: accent.primary }]}>
            <IconSymbol color="#ffffff" name="stethoscope" size={18} />
            <ThemedText style={styles.primaryActionText}>Open Predict</ThemedText>
          </Pressable>
        </View>

        <View style={styles.quickGrid}>
          <HomeTile
            body="Balanced meal ideas and simple habit targets."
            icon="fork.knife"
            iconColor={accent.primary}
            isDark={isDark}
            onPress={() => router.push('/(tabs)/explore')}
            title="Guide"
          />
          <HomeTile
            body="Record glucose, sleep, activity, water, meals, and notes."
            icon="calendar"
            iconColor={accent.primary}
            isDark={isDark}
            onPress={() => router.push('/(tabs)/log')}
            title="Daily Log"
          />
          <HomeTile
            body="Ask Ribbon about meals, snacks, habits, or food photos."
            icon="message.fill"
            iconColor={accent.primary}
            isDark={isDark}
            onPress={() => router.push('/(tabs)/chat')}
            title="Chat"
          />
          <HomeTile
            body="Adjust appearance, icon, colors, and Ribbon tone."
            icon="gearshape.fill"
            iconColor={accent.primary}
            isDark={isDark}
            onPress={() => router.push('/(tabs)/settings')}
            title="Settings"
          />
        </View>

        <View style={styles.note}>
          <ThemedText style={[styles.noteText, isDark && styles.mutedDark]}>
            Diabeto is educational and does not replace medical diagnosis or care.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function HomeTile({
  body,
  icon,
  iconColor,
  isDark,
  onPress,
  title,
}: {
  body: string;
  icon: 'calendar' | 'fork.knife' | 'gearshape.fill' | 'message.fill';
  iconColor: string;
  isDark: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={[styles.tile, isDark && styles.tileDark]}>
      <View style={[styles.tileIcon, isDark && styles.tileIconDark]}>
        <IconSymbol color={iconColor} name={icon} size={22} />
      </View>
      <ThemedText type="defaultSemiBold">{title}</ThemedText>
      <ThemedText style={[styles.tileText, isDark && styles.mutedDark]}>{body}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 20,
    padding: 20,
    paddingBottom: Layout.tabBarContentInset,
    paddingTop: 64,
  },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  heroIcon: {
    borderRadius: 24,
    height: 86,
    width: 86,
  },
  subtitle: {
    color: BrandColors.lightMutedText,
  },
  mutedDark: {
    color: BrandColors.darkMutedText,
  },
  summaryBand: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  summaryBandDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  kicker: {
    color: BrandColors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  kickerDark: {
    color: BrandColors.darkInputText,
  },
  summaryText: {
    color: BrandColors.lightMutedText,
  },
  primaryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.primary,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 8,
    minHeight: 158,
    minWidth: 140,
    padding: 14,
  },
  tileDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  tileIcon: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  tileIconDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
  },
  tileText: {
    color: BrandColors.lightMutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    paddingBottom: 18,
  },
  noteText: {
    color: BrandColors.lightMutedText,
    fontSize: 13,
    lineHeight: 19,
  },
});
