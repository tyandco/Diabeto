import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getAppIconSource,
  updateAppPreferences,
  useAccentPalette,
  useAppPreferences,
} from '@/lib/app-preferences';
import { useI18n } from '@/lib/localization';

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const accent = useAccentPalette();
  const preferences = useAppPreferences();
  const router = useRouter();
  const { text } = useI18n();
  const [, setIconTapCount] = useState(0);

  const handleIconPress = () => {
    if (preferences.secretLanguageUnlocked) {
      return;
    }

    setIconTapCount((current) => {
      const nextCount = current + 1;

      if (nextCount >= 5) {
        updateAppPreferences({ secretLanguageUnlocked: true });
        Alert.alert('meow!', 'mrrp meow purr.');
        return 0;
      }

      return nextCount;
    });
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Pressable accessibilityLabel="Diabeto app icon" onPress={handleIconPress}>
            <Image source={getAppIconSource()} style={styles.heroIcon} />
          </Pressable>
          <View style={styles.heroCopy}>
            <ThemedText type="title">Diabeto</ThemedText>
            <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
              {text.home.subtitle}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.summaryBand, isDark && styles.summaryBandDark]}>
          <ThemedText style={[styles.kicker, isDark && styles.kickerDark]}>{text.home.today}</ThemedText>
          <ThemedText type="subtitle">{text.home.quickRiskCheck}</ThemedText>
          <ThemedText style={[styles.summaryText, isDark && styles.mutedDark]}>
            {text.home.predictionHelps}
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(tabs)/predict')}
            style={[styles.primaryAction, { backgroundColor: accent.primary }]}>
            <IconSymbol color="#ffffff" name="stethoscope" size={18} />
            <ThemedText style={styles.primaryActionText}>{text.home.openPredict}</ThemedText>
          </Pressable>
        </View>

        <View style={styles.quickGrid}>
          <HomeTile
            body={text.home.guideBody}
            icon="fork.knife"
            iconColor={accent.primary}
            isDark={isDark}
            onPress={() => router.push('/(tabs)/explore')}
            title={text.tabs.guide}
          />
          <HomeTile
            body={text.home.dailyLogBody}
            icon="calendar"
            iconColor={accent.primary}
            isDark={isDark}
            onPress={() => router.push('/(tabs)/log')}
            title={text.home.dailyLog}
          />
          <HomeTile
            body={text.home.chatBody}
            icon="message.fill"
            iconColor={accent.primary}
            isDark={isDark}
            onPress={() => router.push('/(tabs)/chat')}
            title={text.tabs.chat}
          />
          <HomeTile
            body={text.home.settingsBody}
            icon="gearshape.fill"
            iconColor={accent.primary}
            isDark={isDark}
            onPress={() => router.push('/(tabs)/settings')}
            title={text.tabs.settings}
          />
        </View>

        <View style={styles.note}>
          <ThemedText style={[styles.noteText, isDark && styles.mutedDark]}>
            {text.home.disclaimer}
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
