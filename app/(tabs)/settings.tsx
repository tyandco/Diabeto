import * as Clipboard from 'expo-clipboard';
import { Image, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  accentPalettes,
  getAppIconSource,
  ribbonToneLabels,
  updateAppPreferences,
  useAccentPalette,
  useAppPreferences,
  type AccentTheme,
  type AppIconChoice,
  type AppearanceMode,
  type RibbonTone,
} from '@/lib/app-preferences';

const appearanceOptions: { label: string; value: AppearanceMode }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

const iconOptions: { label: string; value: AppIconChoice }[] = [
  { label: 'Diabeto', value: 'diabeto' },
  { label: 'Ribbon', value: 'ribbon' },
  { label: 'Minimal', value: 'minimal' },
];

const toneOptions: RibbonTone[] = ['warm', 'cold', 'aggressive', 'casual'];
const GOOGLE_AI_STUDIO_KEY_URL = 'https://aistudio.google.com/app/apikey';

export default function SettingsScreen() {
  const accent = useAccentPalette();
  const preferences = useAppPreferences();
  const isDark = useColorScheme() === 'dark';

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="title">Settings</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            Personalize Diabeto and Ribbon.
          </ThemedText>
        </View>

        <View style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">Gemini API Key</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            Ribbon uses your own Google AI Studio key. It stays on this device.
          </ThemedText>
          <View style={[styles.keyInputWrap, isDark && styles.keyInputWrapDark]}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => updateAppPreferences({ geminiApiKey: value })}
              placeholder="Paste Gemini API key"
              placeholderTextColor={isDark ? '#8faec5' : '#7890a1'}
              secureTextEntry
              style={[styles.keyInput, isDark && styles.keyInputDark]}
              value={preferences.geminiApiKey}
            />
          </View>
          <View style={styles.keyActions}>
            <Pressable
              onPress={() => Linking.openURL(GOOGLE_AI_STUDIO_KEY_URL)}
              style={[styles.keyButton, { borderColor: accent.primary }]}>
              <ThemedText style={[styles.keyButtonText, { color: accent.primary }]}>
                Get an API key
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={async () => {
                const text = await Clipboard.getStringAsync();
                updateAppPreferences({ geminiApiKey: text.trim() });
              }}
              style={[styles.keyButton, { backgroundColor: accent.primary, borderColor: accent.primary }]}>
              <ThemedText style={styles.pasteButtonText}>Paste</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">Appearance</ThemedText>
          <Segmented
            accent={accent.primary}
            isDark={isDark}
            onChange={(value) => updateAppPreferences({ appearanceMode: value })}
            options={appearanceOptions}
            value={preferences.appearanceMode}
          />
        </View>

        <View style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">Color Theme</ThemedText>
          <View style={styles.swatchGrid}>
            {(Object.keys(accentPalettes) as AccentTheme[]).map((theme) => {
              const palette = accentPalettes[theme];
              const selected = preferences.accentTheme === theme;
              return (
                <Pressable
                  key={theme}
                  onPress={() => updateAppPreferences({ accentTheme: theme })}
                  style={[
                    styles.swatchOption,
                    isDark && styles.swatchOptionDark,
                    selected && { borderColor: palette.primary },
                  ]}>
                  <View style={[styles.swatch, { backgroundColor: palette.primary }]} />
                  <ThemedText style={styles.optionText}>{palette.name}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">App Icon</ThemedText>
          <View style={styles.iconGrid}>
            {iconOptions.map((option) => {
              const selected = preferences.appIcon === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => updateAppPreferences({ appIcon: option.value })}
                  style={[
                    styles.iconOption,
                    isDark && styles.iconOptionDark,
                    selected && { borderColor: accent.primary },
                  ]}>
                  <Image source={getAppIconSource(option.value)} style={styles.iconPreview} />
                  <ThemedText style={styles.optionText}>{option.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">Ribbon Tone</ThemedText>
          <View style={[styles.toneList, isDark && styles.toneListDark]}>
            {toneOptions.map((tone) => {
              const selected = preferences.ribbonTone === tone;
              return (
                <Pressable
                  key={tone}
                  onPress={() => updateAppPreferences({ ribbonTone: tone })}
                  style={[styles.toneRow, selected && { backgroundColor: accent.primary }]}>
                  <ThemedText
                    style={[
                      styles.toneText,
                      isDark && styles.toneTextDark,
                      selected && styles.selectedToneText,
                    ]}>
                    {ribbonToneLabels[tone]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Segmented<T extends string>({
  accent,
  isDark,
  onChange,
  options,
  value,
}: {
  accent: string;
  isDark: boolean;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <View style={[styles.segmented, isDark && styles.segmentedDark]}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: accent }]}>
            <ThemedText
              style={[
                styles.segmentText,
                isDark && styles.segmentTextDark,
                selected && styles.segmentTextActive,
              ]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
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
  panel: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  panelDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  keyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  keyButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 130,
    paddingHorizontal: 14,
  },
  keyButtonText: {
    fontWeight: '900',
  },
  keyInput: {
    color: BrandColors.lightInputText,
    flex: 1,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  keyInputDark: {
    color: BrandColors.darkInputText,
  },
  keyInputWrap: {
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
  },
  keyInputWrapDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  pasteButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  segmented: {
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
  },
  segmentedDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 6,
  },
  segmentText: {
    color: BrandColors.lightInputText,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  segmentTextDark: {
    color: BrandColors.darkInputText,
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatchOption: {
    alignItems: 'center',
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 10,
    minHeight: 50,
    minWidth: 132,
    padding: 10,
  },
  swatchOptionDark: {
    borderColor: BrandColors.darkBorder,
  },
  swatch: {
    borderRadius: 999,
    height: 24,
    width: 24,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconOption: {
    alignItems: 'center',
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '30%',
    flexGrow: 1,
    gap: 8,
    minWidth: 94,
    padding: 10,
  },
  iconOptionDark: {
    borderColor: BrandColors.darkBorder,
  },
  iconPreview: {
    borderRadius: 14,
    height: 54,
    width: 54,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  toneList: {
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 8,
    gap: 4,
    padding: 4,
  },
  toneListDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
  },
  toneRow: {
    borderRadius: 6,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  toneText: {
    color: BrandColors.lightInputText,
    fontWeight: '800',
  },
  toneTextDark: {
    color: BrandColors.darkInputText,
  },
  selectedToneText: {
    color: '#ffffff',
  },
});
