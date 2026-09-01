import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GlassView } from '@/components/glass-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getAppIconSource,
  updateAppPreferences,
  useAccentPalette,
  useAppPreferences,
} from '@/lib/app-preferences';
import { useHomeTipIndex } from '@/lib/home-tip';
import { useI18n } from '@/lib/localization';

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const accent = useAccentPalette();
  const preferences = useAppPreferences();
  const router = useRouter();
  const { text } = useI18n();
  const insets = useSafeAreaInsets();
  const [, setIconTapCount] = useState(0);
  const tipIndex = useHomeTipIndex(text.home.tips.length);
  const activeTip = text.home.tips[tipIndex] ?? text.home.tips[0];
  const scrollBottomInset = Layout.tabBarContentInset + insets.bottom;

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
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: scrollBottomInset,
            paddingTop: Math.max(insets.top + 28, 56),
          },
        ]}
        scrollIndicatorInsets={{ bottom: scrollBottomInset }}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <ThemedText style={[styles.kicker, isDark && styles.kickerDark]}>{text.home.today}</ThemedText>
            <ThemedText type="title">Diabeto</ThemedText>
            <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
              {text.home.subtitle}
            </ThemedText>
          </View>
          <Pressable accessibilityLabel="Diabeto app icon" onPress={handleIconPress} style={styles.iconButton}>
            <Image source={getAppIconSource()} style={styles.heroIcon} />
          </Pressable>
        </View>

        <GlassView style={[styles.tipPanel, isDark && styles.summaryBandDark]}>
          <View style={[styles.tipIcon, isDark && styles.tileIconDark]}>
            <IconSymbol color={accent.primary} name="lightbulb.fill" size={22} />
          </View>
          <View style={styles.tipCopy}>
            <ThemedText style={[styles.kicker, isDark && styles.kickerDark]}>{text.home.launchTip}</ThemedText>
            <ThemedText style={styles.tipText}>{activeTip}</ThemedText>
          </View>
        </GlassView>

        <GlassView style={[styles.summaryBand, isDark && styles.summaryBandDark]}>
          <View style={styles.summaryAccent} />
          <View style={styles.summaryContent}>
            <ThemedText type="subtitle">{text.home.quickRiskCheck}</ThemedText>
            <ThemedText style={[styles.summaryText, isDark && styles.mutedDark]}>
              {text.home.predictionHelps}
            </ThemedText>
            <View style={styles.metricRow}>
              <MetricChip label={text.home.metrics.riskLabel} value={text.home.metrics.riskValue} isDark={isDark} />
              <MetricChip label={text.home.metrics.habitsLabel} value={text.home.metrics.habitsValue} isDark={isDark} />
              <MetricChip label={text.home.metrics.coachLabel} value={text.home.metrics.coachValue} isDark={isDark} />
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/predict')}
              style={[styles.primaryAction, { backgroundColor: accent.primary }]}>
              <IconSymbol color="#ffffff" name="stethoscope" size={18} />
              <ThemedText style={styles.primaryActionText}>{text.home.openPredict}</ThemedText>
            </Pressable>
          </View>
        </GlassView>

        <View style={styles.menuHeader}>
          <ThemedText type="subtitle">{text.home.menuTitle}</ThemedText>
        </View>

        <View style={styles.menuStack}>
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
    <GlassView style={[styles.tile, isDark && styles.tileDark]}>
      <Pressable accessibilityRole="link" onPress={onPress} style={styles.tilePressable}>
        <View style={[styles.tileIcon, isDark && styles.tileIconDark]}>
          <IconSymbol color={iconColor} name={icon} size={22} />
        </View>
        <View style={styles.tileCopy}>
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
          <ThemedText style={[styles.tileText, isDark && styles.mutedDark]}>{body}</ThemedText>
        </View>
        <IconSymbol
          color={isDark ? BrandColors.darkMutedText : BrandColors.lightMutedText}
          name="chevron.right"
          size={18}
        />
      </Pressable>
    </GlassView>
  );
}

function MetricChip({ isDark, label, value }: { isDark: boolean; label: string; value: string }) {
  return (
    <View style={[styles.metricChip, isDark && styles.metricChipDark]}>
      <ThemedText style={[styles.metricLabel, isDark && styles.mutedDark]}>{label}</ThemedText>
      <ThemedText style={styles.metricValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
  },
  hero: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  heroIcon: {
    borderRadius: 22,
    height: 78,
    width: 78,
  },
  iconButton: {
    borderRadius: 24,
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
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
  },
  summaryBandDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  summaryAccent: {
    backgroundColor: BrandColors.accent,
    width: 8,
  },
  summaryContent: {
    flex: 1,
    gap: 12,
    padding: 18,
    paddingLeft: 14,
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
  tipPanel: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  tipIcon: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 16,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  tipCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  tipText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  primaryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 18,
  },
  primaryActionText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  menuHeader: {
    paddingTop: 4,
  },
  menuStack: {
    gap: 10,
  },
  tile: {
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 92,
  },
  tileDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  tilePressable: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  tileCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  tileIcon: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 14,
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
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricChip: {
    backgroundColor: BrandColors.lightSurfaceStrong,
    borderRadius: 14,
    minWidth: 82,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricChipDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
  },
  metricLabel: {
    color: BrandColors.lightMutedText,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
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
