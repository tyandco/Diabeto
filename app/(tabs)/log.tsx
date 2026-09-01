import Feather from '@expo/vector-icons/Feather';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GlassView } from '@/components/glass-view';
import { BrandColors, Fonts, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccentPalette } from '@/lib/app-preferences';
import {
  calculateDailyLogStreak,
  getTodayLogDate,
  initialDailyLog,
  loadDailyLog,
  loadDailyLogs,
  saveDailyLog,
  type DailyLog,
  type DailyLogEntry,
  type DailyLogMood,
} from '@/lib/daily-log';
import {
  getDailyLogReminderEnabled,
  getDailyLogReminderTime,
  setDailyLogReminderEnabled,
  setDailyLogReminderTime,
  type ReminderTime,
} from '@/lib/log-reminders';
import { useI18n } from '@/lib/localization';

export default function DailyLogScreen() {
  const accent = useAccentPalette();
  const isDark = useColorScheme() === 'dark';
  const { language, text } = useI18n();
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [draft, setDraft] = useState<DailyLog>(initialDailyLog);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isReminderEnabled, setIsReminderEnabled] = useState(false);
  const [isReminderSaving, setIsReminderSaving] = useState(false);
  const [reminderTime, setReminderTime] = useState<ReminderTime>({ hour: 20, minute: 0 });
  const [reminderMessage, setReminderMessage] = useState('');
  const streak = calculateDailyLogStreak(entries);

  const refreshLogs = useCallback(() => {
    loadDailyLogs(30)
      .then(setEntries)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  useEffect(() => {
    Promise.all([getDailyLogReminderEnabled(), getDailyLogReminderTime()])
      .then(([enabled, time]) => {
        setIsReminderEnabled(enabled);
        setReminderTime(time);
      })
      .catch(() => undefined);
  }, []);

  const openEditor = async () => {
    const todayLog = await loadDailyLog();
    setDraft(todayLog ?? initialDailyLog);
    setIsEditorOpen(true);
  };

  const update = <Key extends keyof DailyLog>(key: Key, value: DailyLog[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveDraft = async () => {
    await saveDailyLog(draft);
    setIsEditorOpen(false);
    refreshLogs();
  };

  const toggleReminder = async () => {
    setIsReminderSaving(true);
    setReminderMessage('');

    try {
      const result = await setDailyLogReminderEnabled(!isReminderEnabled, reminderTime);
      setIsReminderEnabled(result.enabled);
      setReminderMessage(result.reason ?? (result.enabled ? text.log.reminderSet(formatReminderTime(reminderTime, language)) : text.log.reminderOff));
    } finally {
      setIsReminderSaving(false);
    }
  };

  const adjustReminderTime = async (minutesDelta: number) => {
    const nextTime = addMinutesToReminderTime(reminderTime, minutesDelta);

    setReminderTime(nextTime);
    setIsReminderSaving(true);
    setReminderMessage('');

    try {
      const result = await setDailyLogReminderTime(nextTime);
      setIsReminderEnabled(result.enabled);

      if (result.reason) {
        setReminderMessage(result.reason);
      } else if (result.enabled) {
        setReminderMessage(text.log.reminderSet(formatReminderTime(nextTime, language)));
      }
    } finally {
      setIsReminderSaving(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText type="title">{text.log.title}</ThemedText>
        <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
          {text.log.subtitle}
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.historyContent}>
        <GlassView style={[styles.summaryPanel, isDark && styles.panelDark]}>
          <View style={styles.summaryCopy}>
            <ThemedText type="subtitle">{text.log.streakTitle(streak)}</ThemedText>
            <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
              {streak > 0 ? text.log.streakActive : text.log.streakEmpty}
            </ThemedText>
          </View>
          <Pressable
            disabled={isReminderSaving}
            onPress={toggleReminder}
            style={[
              styles.reminderButton,
              { borderColor: accent.primary },
              isReminderEnabled && { backgroundColor: accent.primary },
              isReminderSaving && styles.disabledButton,
            ]}>
            {isReminderSaving ? (
              <ActivityIndicator color={isReminderEnabled ? '#ffffff' : accent.primary} />
            ) : (
              <ThemedText style={[styles.reminderButtonText, { color: isReminderEnabled ? '#ffffff' : accent.primary }]}>
                {isReminderEnabled ? text.log.reminderOn : text.log.remindMe}
              </ThemedText>
            )}
          </Pressable>
          {reminderMessage ? (
            <ThemedText style={[styles.reminderMessage, isDark && styles.mutedDark]}>
              {reminderMessage}
            </ThemedText>
          ) : null}
          <View style={[styles.timePicker, isDark && styles.timePickerDark]}>
            <View style={styles.timeCopy}>
              <ThemedText type="defaultSemiBold">{text.log.reminderTime}</ThemedText>
              <ThemedText style={[styles.reminderMessage, isDark && styles.mutedDark]}>
                {text.log.reminderTimeHelp}
              </ThemedText>
            </View>
            <View style={styles.timeActions}>
              <Pressable
                disabled={isReminderSaving}
                onPress={() => adjustReminderTime(-15)}
                style={[styles.timeButton, isReminderSaving && styles.disabledButton]}>
                <Feather color={accent.primary} name="minus" size={18} />
              </Pressable>
              <ThemedText style={styles.timeValue}>{formatReminderTime(reminderTime, language)}</ThemedText>
              <Pressable
                disabled={isReminderSaving}
                onPress={() => adjustReminderTime(15)}
                style={[styles.timeButton, isReminderSaving && styles.disabledButton]}>
                <Feather color={accent.primary} name="plus" size={18} />
              </Pressable>
            </View>
          </View>
        </GlassView>

        {entries.length === 0 ? (
          <GlassView style={[styles.emptyPanel, isDark && styles.panelDark]}>
            <ThemedText type="subtitle">{text.log.noLogs}</ThemedText>
            <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
              {text.log.emptyHelp}
            </ThemedText>
          </GlassView>
        ) : (
          entries.map((entry) => <HistoryCard entry={entry} isDark={isDark} key={entry.date} />)
        )}
      </ScrollView>

      <Pressable
        accessibilityLabel={text.log.logYourDay}
        onPress={openEditor}
        style={[styles.fab, { backgroundColor: accent.primary }]}>
        <Feather color="#ffffff" name="edit-3" size={18} />
        <ThemedText style={styles.fabText}>{text.log.logYourDay}</ThemedText>
      </Pressable>

      <Modal animationType="slide" onRequestClose={() => setIsEditorOpen(false)} transparent visible={isEditorOpen}>
        <View style={styles.modalBackdrop}>
          <ThemedView style={[styles.editor, isDark && styles.editorDark]}>
            <View style={styles.editorHeader}>
              <View>
                <ThemedText type="subtitle">{text.log.logYourDay}</ThemedText>
                <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
                  {formatDate(getTodayLogDate(), language)}
                </ThemedText>
              </View>
              <Pressable onPress={() => setIsEditorOpen(false)} style={styles.closeButton}>
                <Feather color={isDark ? BrandColors.darkInputText : BrandColors.lightInputText} name="x" size={20} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
              <View style={styles.grid}>
                <Field
                  isDark={isDark}
                  label={text.log.glucose}
                  onChangeText={(value) => update('glucoseMgDl', value)}
                  placeholder={text.common.optional}
                  suffix={language === 'secret' ? 'hiss?' : 'mg/dL'}
                  value={draft.glucoseMgDl}
                />
                <Field
                  isDark={isDark}
                  label={text.log.activity}
                  onChangeText={(value) => update('activityMinutes', value)}
                  placeholder="0"
                  suffix={language === 'secret' ? 'mrrp' : 'min'}
                  value={draft.activityMinutes}
                />
                <Field
                  isDark={isDark}
                  label={text.log.sleep}
                  onChangeText={(value) => update('sleepHours', value)}
                  placeholder="0"
                  suffix={text.log.hours}
                  value={draft.sleepHours}
                />
              </View>

              <Counter
                accent={accent.primary}
                label={text.log.water}
                onChange={(value) => update('waterCups', value)}
                suffix={text.log.cups}
                value={draft.waterCups}
              />
              <Counter
                accent={accent.primary}
                label={text.log.balancedMeals}
                max={6}
                onChange={(value) => update('balancedMeals', value)}
                suffix={text.log.meals}
                value={draft.balancedMeals}
              />

              <View style={styles.optionGroup}>
                <ThemedText type="defaultSemiBold">{text.log.mood}</ThemedText>
                <View style={[styles.segmented, isDark && styles.segmentedDark]}>
                  {(['steady', 'good', 'tired', 'stressed'] as DailyLogMood[]).map((mood) => {
                    const selected = draft.mood === mood;
                    return (
                      <Pressable
                        key={mood}
                        onPress={() => update('mood', mood)}
                        style={[styles.segment, selected && { backgroundColor: accent.primary }]}>
                        <ThemedText
                          style={[
                            styles.segmentText,
                            isDark && styles.segmentTextDark,
                            selected && styles.segmentTextActive,
                          ]}>
                          {text.log.moods[mood]}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <TextInput
                multiline
                onChangeText={(value) => update('notes', value)}
                placeholder={text.log.notesPlaceholder}
                placeholderTextColor={isDark ? '#8faec5' : '#7890a1'}
                style={[styles.notesInput, isDark && styles.inputDark]}
                value={draft.notes}
              />

              <Pressable onPress={saveDraft} style={[styles.saveButton, { backgroundColor: accent.primary }]}>
                <ThemedText style={styles.saveText}>{text.log.saveLog}</ThemedText>
              </Pressable>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

function HistoryCard({ entry, isDark }: { entry: DailyLogEntry; isDark: boolean }) {
  const { language, text } = useI18n();
  const { log } = entry;
  const stats = [
    log.glucoseMgDl ? `${log.glucoseMgDl} ${language === 'secret' ? 'hiss?' : 'mg/dL'}` : text.log.noGlucose,
    `${log.activityMinutes || '0'} ${language === 'secret' ? 'mrrp' : 'min'}`,
    log.sleepHours ? `${log.sleepHours}h ${language === 'secret' ? 'purr' : text.log.sleep}` : text.log.noSleep,
    `${log.waterCups} ${text.log.water}`,
    `${log.balancedMeals} ${text.log.balancedMeals}`,
  ];

  return (
    <GlassView style={[styles.historyCard, isDark && styles.panelDark]}>
      <View style={styles.cardTop}>
        <ThemedText type="defaultSemiBold">{formatDate(entry.date, language)}</ThemedText>
        <ThemedText style={[styles.mood, isDark && styles.mutedDark]}>{text.log.moods[log.mood]}</ThemedText>
      </View>
      <View style={styles.statWrap}>
        {stats.map((stat) => (
          <View key={stat} style={[styles.statPill, isDark && styles.statPillDark]}>
            <ThemedText style={[styles.statText, isDark && styles.mutedDark]}>{stat}</ThemedText>
          </View>
        ))}
      </View>
      {log.notes ? <ThemedText style={styles.notesPreview}>{log.notes}</ThemedText> : null}
    </GlassView>
  );
}

function Field({
  isDark,
  label,
  onChangeText,
  placeholder,
  suffix,
  value,
}: {
  isDark: boolean;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  suffix: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <View style={[styles.inputWrap, isDark && styles.inputWrapDark]}>
        <TextInput
          keyboardType="numeric"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#8faec5' : '#7890a1'}
          style={[styles.input, isDark && styles.inputDark]}
          value={value}
        />
        <ThemedText style={[styles.suffix, isDark && styles.mutedDark]}>{suffix}</ThemedText>
      </View>
    </View>
  );
}

function Counter({
  accent,
  label,
  max = 12,
  onChange,
  suffix,
  value,
}: {
  accent: string;
  label: string;
  max?: number;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <View style={styles.counterRow}>
      <View>
        <ThemedText type="defaultSemiBold">{label}</ThemedText>
        <ThemedText style={styles.counterMeta}>
          {value} {suffix}
        </ThemedText>
      </View>
      <View style={styles.counterActions}>
        <Pressable onPress={() => onChange(Math.max(0, value - 1))} style={styles.counterButton}>
          <Feather color={accent} name="minus" size={18} />
        </Pressable>
        <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={styles.counterButton}>
          <Feather color={accent} name="plus" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

function formatDate(date: string, language: 'en' | 'ar' | 'es' | 'secret') {
  if (language === 'secret') {
    return date;
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString(language, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });
}

function addMinutesToReminderTime(time: ReminderTime, minutesDelta: number): ReminderTime {
  const totalMinutes = (time.hour * 60 + time.minute + minutesDelta + 24 * 60) % (24 * 60);

  return {
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
}

function formatReminderTime(time: ReminderTime, language: 'en' | 'ar' | 'es' | 'secret') {
  if (language === 'secret') {
    return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
  }

  return new Date(2026, 0, 1, time.hour, time.minute).toLocaleTimeString(language, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    gap: 6,
    padding: 20,
    paddingBottom: 10,
    paddingTop: 64,
  },
  subtitle: {
    color: BrandColors.lightMutedText,
  },
  mutedDark: {
    color: BrandColors.darkMutedText,
  },
  historyContent: {
    gap: 10,
    padding: 20,
    paddingBottom: Layout.tabBarContentInset + 86,
    paddingTop: 6,
  },
  summaryPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 18,
    boxShadow: '0 10px 18px rgba(24, 35, 31, 0.06)',
    elevation: 2,
  },
  summaryCopy: {
    flex: 1,
    gap: 6,
    minWidth: 180,
  },
  reminderButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 120,
    paddingHorizontal: 14,
  },
  reminderButtonText: {
    fontWeight: '900',
  },
  reminderMessage: {
    color: BrandColors.lightMutedText,
    flexBasis: '100%',
    fontSize: 13,
  },
  disabledButton: {
    opacity: 0.7,
  },
  timePicker: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    padding: 12,
  },
  timePickerDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
    borderColor: BrandColors.darkBorder,
  },
  timeCopy: {
    flex: 1,
    minWidth: 150,
  },
  timeActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  timeButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '900',
    minWidth: 76,
    textAlign: 'center',
  },
  emptyPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  panelDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    boxShadow: '0 8px 14px rgba(24, 35, 31, 0.05)',
    elevation: 1,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  mood: {
    color: BrandColors.lightMutedText,
    fontSize: 13,
    fontWeight: '800',
  },
  statWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statPill: {
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statPillDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
  },
  statText: {
    color: BrandColors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  notesPreview: {
    fontSize: 14,
    lineHeight: 20,
  },
  fab: {
    alignItems: 'center',
    borderRadius: 18,
    bottom: Layout.tabBarContentInset + 10,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 18,
    boxShadow: '0 10px 16px rgba(24, 35, 31, 0.16)',
    elevation: 8,
  },
  fabText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  editor: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '86%',
    paddingTop: 16,
  },
  editorDark: {
    backgroundColor: BrandColors.darkBackground,
  },
  editorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  closeButton: {
    alignItems: 'center',
    borderColor: BrandColors.lightBorder,
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  editorContent: {
    gap: 14,
    padding: 20,
    paddingBottom: 34,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  field: {
    flexBasis: '30%',
    flexGrow: 1,
    gap: 6,
    minWidth: 104,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  inputWrapDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  input: {
    color: BrandColors.lightInputText,
    flex: 1,
    fontFamily: Fonts?.display,
    fontSize: 16,
    paddingVertical: 8,
  },
  inputDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
    color: BrandColors.darkInputText,
  },
  suffix: {
    color: BrandColors.lightMutedText,
    fontSize: 12,
  },
  counterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  counterMeta: {
    color: BrandColors.lightMutedText,
    fontSize: 13,
  },
  counterActions: {
    flexDirection: 'row',
    gap: 8,
  },
  counterButton: {
    alignItems: 'center',
    borderColor: BrandColors.lightBorder,
    borderRadius: 12,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  optionGroup: {
    gap: 8,
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
    minHeight: 38,
    paddingHorizontal: 6,
  },
  segmentText: {
    color: BrandColors.lightInputText,
    fontSize: 13,
    textAlign: 'center',
  },
  segmentTextDark: {
    color: BrandColors.darkInputText,
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  notesInput: {
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 14,
    borderWidth: 1,
    color: BrandColors.lightInputText,
    fontFamily: Fonts?.display,
    fontSize: 16,
    minHeight: 90,
    padding: 12,
    textAlignVertical: 'top',
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 16,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  saveText: {
    color: '#ffffff',
    fontWeight: '900',
  },
});
