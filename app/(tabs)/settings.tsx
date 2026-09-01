import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GlassView } from '@/components/glass-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  updateAppPreferences,
  useAccentPalette,
  useAppPreferences,
  type AppearanceMode,
  type AppLanguage,
  type RibbonTone,
} from '@/lib/app-preferences';
import { useAuth } from '@/lib/auth-context';
import { languageLabels, useI18n } from '@/lib/localization';

const languageOptions: { label: string; value: AppLanguage }[] = [
  { label: languageLabels.system, value: 'system' },
  { label: languageLabels.en, value: 'en' },
  { label: languageLabels.ar, value: 'ar' },
  { label: languageLabels.es, value: 'es' },
];
const secretLanguageOption: { label: string; value: AppLanguage } = {
  label: languageLabels.secret,
  value: 'secret',
};
const toneOptions: RibbonTone[] = ['warm', 'cold', 'aggressive', 'casual'];
const GOOGLE_AI_STUDIO_KEY_URL = 'https://aistudio.google.com/app/apikey';

export default function SettingsScreen() {
  const accent = useAccentPalette();
  const auth = useAuth();
  const preferences = useAppPreferences();
  const isDark = useColorScheme() === 'dark';
  const { text } = useI18n();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const availableLanguageOptions = preferences.secretLanguageUnlocked
    ? [...languageOptions, secretLanguageOption]
    : languageOptions;
  const appearanceOptions: { label: string; value: AppearanceMode }[] = [
    { label: text.settings.system, value: 'system' },
    { label: text.settings.light, value: 'light' },
    { label: text.settings.dark, value: 'dark' },
  ];

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="title">{text.settings.title}</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            {text.settings.subtitle}
          </ThemedText>
        </View>

        <GlassView style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">{text.settings.account}</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            {auth.isConfigured
              ? auth.user?.email ?? text.settings.accountSignedOut
              : text.settings.accountSetupNeeded}
          </ThemedText>
          <View style={styles.keyActions}>
            {auth.user ? (
              <Pressable
                disabled={isSigningOut}
                onPress={async () => {
                  setIsSigningOut(true);
                  try {
                    await auth.signOut();
                  } finally {
                    setIsSigningOut(false);
                  }
                }}
                style={[
                  styles.keyButton,
                  { backgroundColor: accent.primary, borderColor: accent.primary },
                  isSigningOut && styles.disabledButton,
                ]}>
                {isSigningOut ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText style={styles.pasteButtonText}>{text.account.signOut}</ThemedText>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/account')}
                style={[styles.keyButton, { backgroundColor: accent.primary, borderColor: accent.primary }]}>
                <ThemedText style={styles.pasteButtonText}>{text.account.signIn}</ThemedText>
              </Pressable>
            )}
          </View>
        </GlassView>

        <GlassView style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">{text.settings.geminiApiKey}</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            {text.settings.keyHelp}
          </ThemedText>
          <View style={[styles.keyInputWrap, isDark && styles.keyInputWrapDark]}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => updateAppPreferences({ geminiApiKey: value })}
              placeholder={text.settings.keyPlaceholder}
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
                {text.settings.getApiKey}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={async () => {
                const text = await Clipboard.getStringAsync();
                updateAppPreferences({ geminiApiKey: text.trim() });
              }}
              style={[styles.keyButton, { backgroundColor: accent.primary, borderColor: accent.primary }]}>
              <ThemedText style={styles.pasteButtonText}>{text.common.paste}</ThemedText>
            </Pressable>
          </View>
        </GlassView>

        <GlassView style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">{text.settings.appearance}</ThemedText>
          <Segmented
            accent={accent.primary}
            isDark={isDark}
            onChange={(value) => updateAppPreferences({ appearanceMode: value })}
            options={appearanceOptions}
            value={preferences.appearanceMode}
          />
        </GlassView>

        <GlassView style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">{text.settings.language}</ThemedText>
          <Dropdown
            accent={accent.primary}
            isOpen={isLanguageOpen}
            isDark={isDark}
            onChange={(value) => {
              updateAppPreferences({ language: value });
              setIsLanguageOpen(false);
            }}
            options={availableLanguageOptions}
            onToggle={() => setIsLanguageOpen((current) => !current)}
            value={preferences.language}
          />
        </GlassView>

        <GlassView style={[styles.panel, isDark && styles.panelDark]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: isAdvancedOpen }}
            onPress={() => setIsAdvancedOpen((current) => !current)}
            style={styles.advancedHeader}>
            <ThemedText type="subtitle">{text.settings.advanced}</ThemedText>
            <IconSymbol
              color={isDark ? BrandColors.darkInputText : BrandColors.lightInputText}
              name={isAdvancedOpen ? 'chevron.down' : 'chevron.right'}
              size={22}
            />
          </Pressable>

          {isAdvancedOpen ? (
            <View style={styles.advancedContent}>
              <ThemedText type="defaultSemiBold">{text.settings.ribbonTone}</ThemedText>
              <View style={[styles.toneList, isDark && styles.toneListDark]}>
                {toneOptions.map((tone) => {
                  const selected = preferences.ribbonTone === tone;
                  return (
                    <Pressable
                      key={tone}
                      onPress={() => updateAppPreferences({ ribbonTone: tone })}
                      style={[styles.toneRow, selected && { backgroundColor: accent.primary }]}>
                      <View style={styles.toneCopy}>
                        <ThemedText
                          style={[
                            styles.toneText,
                            isDark && styles.toneTextDark,
                            selected && styles.selectedToneText,
                          ]}>
                          {text.settings.ribbonToneLabels[tone]}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.toneDescription,
                            isDark && styles.toneDescriptionDark,
                            selected && styles.selectedToneDescription,
                          ]}>
                          ({text.settings.ribbonToneDescriptions[tone]})
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </GlassView>
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

function Dropdown<T extends string>({
  accent,
  isDark,
  isOpen,
  onChange,
  onToggle,
  options,
  value,
}: {
  accent: string;
  isDark: boolean;
  isOpen: boolean;
  onChange: (value: T) => void;
  onToggle: () => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <View style={styles.dropdown}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={onToggle}
        style={[
          styles.dropdownButton,
          isDark && styles.dropdownButtonDark,
          isOpen && { borderColor: accent },
        ]}>
        <ThemedText style={[styles.dropdownValue, isDark && styles.segmentTextDark]}>
          {selectedOption.label}
        </ThemedText>
        <IconSymbol color={isDark ? BrandColors.darkInputText : BrandColors.lightInputText} name="chevron.down" size={22} />
      </Pressable>

      {isOpen ? (
        <View style={[styles.dropdownMenu, isDark && styles.dropdownMenuDark]}>
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <Pressable
                key={option.value}
                onPress={() => onChange(option.value)}
                style={[
                  styles.dropdownOption,
                  selected && { backgroundColor: accent },
                ]}>
                <ThemedText
                  style={[
                    styles.dropdownOptionText,
                    isDark && styles.segmentTextDark,
                    selected && styles.segmentTextActive,
                  ]}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
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
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 18,
    boxShadow: '0 8px 16px rgba(24, 35, 31, 0.05)',
    elevation: 2,
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
    borderRadius: 14,
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
  disabledButton: {
    opacity: 0.7,
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
    borderRadius: 14,
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
  dropdown: {
    gap: 6,
  },
  dropdownButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  dropdownButtonDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  dropdownMenu: {
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownMenuDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  dropdownOption: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dropdownOptionText: {
    color: BrandColors.lightInputText,
    fontSize: 15,
    fontWeight: '800',
  },
  dropdownValue: {
    color: BrandColors.lightInputText,
    fontSize: 15,
    fontWeight: '800',
  },
  segmented: {
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 14,
    flexDirection: 'row',
    padding: 4,
  },
  segmentedDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 11,
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
  advancedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  advancedContent: {
    gap: 10,
  },
  toneList: {
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 14,
    gap: 4,
    padding: 4,
  },
  toneListDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
  },
  toneRow: {
    borderRadius: 11,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toneCopy: {
    gap: 2,
  },
  toneText: {
    color: BrandColors.lightInputText,
    fontWeight: '800',
  },
  toneDescription: {
    color: BrandColors.lightMutedText,
    fontSize: 12,
    lineHeight: 16,
  },
  toneDescriptionDark: {
    color: BrandColors.darkMutedText,
  },
  toneTextDark: {
    color: BrandColors.darkInputText,
  },
  selectedToneDescription: {
    color: '#e8f4ff',
  },
  selectedToneText: {
    color: '#ffffff',
  },
});
