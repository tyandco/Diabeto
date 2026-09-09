import Feather from '@expo/vector-icons/Feather';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GlassView } from '@/components/glass-view';
import { BrandColors, Fonts, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccentPalette, useAppPreferences } from '@/lib/app-preferences';
import {
  calculateDailyLogStreak,
  formatDailyLogHistoryForAI,
  getTodayLogDate,
  initialDailyLog,
  loadDailyLog,
  loadDailyLogs,
  saveDailyLog,
  type DailyLog,
  type DailyLogEntry,
  type DailyLogMood,
} from '@/lib/daily-log';
import { predictDiabetesRisk, type DiabetesPrediction, type DiabetesProfile } from '@/lib/diabetes-advisor';
import { formatHealthContext, loadHealthContext, saveHealthContext, setHealthContext, type HealthContext } from '@/lib/health-context';
import {
  getDailyLogReminderEnabled,
  getDailyLogReminderTime,
  setDailyLogReminderEnabled,
  setDailyLogReminderTime,
  type ReminderTime,
} from '@/lib/log-reminders';
import { useI18n } from '@/lib/localization';
import { sendDiabetoChat, type ChatMessage } from '@/lib/diabeto-chatbot';

export default function DailyLogScreen() {
  const accent = useAccentPalette();
  const preferences = useAppPreferences();
  const isDark = useColorScheme() === 'dark';
  const { language, text } = useI18n();
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [draft, setDraft] = useState<DailyLog>(initialDailyLog);
  const [selectedLogDate, setSelectedLogDate] = useState(getTodayLogDate());
  const [healthContext, setLoadedHealthContext] = useState<HealthContext | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isReminderEnabled, setIsReminderEnabled] = useState(false);
  const [isReminderSaving, setIsReminderSaving] = useState(false);
  const [isRibbonReviewing, setIsRibbonReviewing] = useState(false);
  const [reminderTime, setReminderTime] = useState<ReminderTime>({ hour: 20, minute: 0 });
  const [reminderMessage, setReminderMessage] = useState('');
  const [ribbonReview, setRibbonReview] = useState('');
  const streak = calculateDailyLogStreak(entries);
  const latestProfile = useMemo(() => getLatestProfile(entries, healthContext?.profile ?? null), [entries, healthContext]);
  const prediction = useMemo(() => (latestProfile ? predictDiabetesRisk(latestProfile) : null), [latestProfile]);
  const trends = useMemo(() => analyzeLogTrends(entries), [entries]);

  const refreshLogs = useCallback(() => {
    loadDailyLogs(30)
      .then(setEntries)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  useEffect(() => {
    loadHealthContext()
      .then(setLoadedHealthContext)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setHealthContext(latestProfile && prediction ? { profile: latestProfile, prediction } : healthContext);
  }, [healthContext, latestProfile, prediction]);

  useEffect(() => {
    Promise.all([getDailyLogReminderEnabled(), getDailyLogReminderTime()])
      .then(([enabled, time]) => {
        setIsReminderEnabled(enabled);
        setReminderTime(time);
      })
      .catch(() => undefined);
  }, []);

  const openEditor = async () => {
    const today = getTodayLogDate();
    const todayLog = await loadDailyLog(today);
    setSelectedLogDate(today);
    setDraft(withProfileDefaults(todayLog ?? initialDailyLog, healthContext?.profile ?? latestProfile));
    setIsEditorOpen(true);
  };

  const adjustSelectedLogDate = async (daysDelta: number) => {
    const nextDate = addDaysToLogDate(selectedLogDate, daysDelta);
    const nextLog = await loadDailyLog(nextDate);

    setSelectedLogDate(nextDate);
    setDraft(withProfileDefaults(nextLog ?? initialDailyLog, healthContext?.profile ?? latestProfile));
  };

  const selectTodayLog = async () => {
    const today = getTodayLogDate();
    const todayLog = await loadDailyLog(today);

    setSelectedLogDate(today);
    setDraft(withProfileDefaults(todayLog ?? initialDailyLog, healthContext?.profile ?? latestProfile));
  };

  const update = <Key extends keyof DailyLog>(key: Key, value: DailyLog[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveDraft = async () => {
    await saveDailyLog(draft, selectedLogDate);
    const profile = parseProfileFromLog(draft);

    if (profile) {
      const nextHealthContext = {
        profile,
        prediction: predictDiabetesRisk(profile),
      };

      setLoadedHealthContext(nextHealthContext);
      await saveHealthContext(nextHealthContext);
    }

    setIsEditorOpen(false);
    refreshLogs();
  };

  const reviewLogsWithRibbon = async () => {
    if (!preferences.geminiApiKey.trim()) {
      setRibbonReview(text.log.ribbonNeedsKey);
      return;
    }

    setIsRibbonReviewing(true);
    setRibbonReview('');

    try {
      const healthForAI = latestProfile && prediction
        ? formatHealthContext({ profile: latestProfile, prediction })
        : formatHealthContext(healthContext);
      const recentLogs = formatDailyLogHistoryForAI(entries);
      const prompt = [
        'Review my recent Diabeto logs in detail.',
        'Explain the strongest trends in glucose, weight, activity, sleep, water, balanced meals, and mood.',
        'Give specific next steps for the next 7 days. Do not diagnose.',
      ].join(' ');
      const messages: ChatMessage[] = [{ id: `log-review-${Date.now()}`, role: 'user', text: prompt }];
      const reply = await sendDiabetoChat(
        messages,
        healthForAI,
        preferences.ribbonTone,
        recentLogs,
        preferences.geminiApiKey,
        language
      );

      setRibbonReview(reply);
    } catch (error) {
      setRibbonReview(error instanceof Error ? error.message : text.chat.fallbackError);
    } finally {
      setIsRibbonReviewing(false);
    }
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
        <PredictionPanel isDark={isDark} prediction={prediction} profile={latestProfile} />

        <GlassView style={[styles.summaryPanel, isDark && styles.panelDark]}>
          <View style={styles.summaryCopy}>
            <ThemedText type="subtitle">{text.log.trendsTitle}</ThemedText>
            {trends.length > 0 ? (
              <View style={styles.trendList}>
                {trends.map((trend) => (
                  <View key={trend} style={styles.trendRow}>
                    <View style={[styles.trendDot, { backgroundColor: accent.primary }]} />
                    <ThemedText style={styles.trendText}>{trend}</ThemedText>
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
                {text.log.trendsEmpty}
              </ThemedText>
            )}
          </View>
        </GlassView>

        <GlassView style={[styles.summaryPanel, isDark && styles.panelDark]}>
          <View style={styles.summaryCopy}>
            <ThemedText type="subtitle">{text.log.ribbonReviewTitle}</ThemedText>
            <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
              {preferences.geminiApiKey.trim() ? text.chat.usingAll : text.log.ribbonNeedsKey}
            </ThemedText>
          </View>
          <Pressable
            disabled={isRibbonReviewing}
            onPress={reviewLogsWithRibbon}
            style={[
              styles.reminderButton,
              { borderColor: accent.primary },
              preferences.geminiApiKey.trim() && { backgroundColor: accent.primary },
              isRibbonReviewing && styles.disabledButton,
            ]}>
            {isRibbonReviewing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText
                style={[
                  styles.reminderButtonText,
                  { color: preferences.geminiApiKey.trim() ? '#ffffff' : accent.primary },
                ]}>
                {text.log.ribbonReview}
              </ThemedText>
            )}
          </Pressable>
          {ribbonReview ? (
            <ThemedText style={[styles.ribbonReviewText, isDark && styles.mutedDark]}>
              {isRibbonReviewing ? text.log.ribbonReviewing : ribbonReview}
            </ThemedText>
          ) : null}
        </GlassView>

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
                  {formatDate(selectedLogDate, language)}
                </ThemedText>
              </View>
              <Pressable onPress={() => setIsEditorOpen(false)} style={styles.closeButton}>
                <Feather color={isDark ? BrandColors.darkInputText : BrandColors.lightInputText} name="x" size={20} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
              <View style={[styles.datePicker, isDark && styles.timePickerDark]}>
                <Pressable
                  accessibilityLabel={text.log.previousDay}
                  onPress={() => adjustSelectedLogDate(-1)}
                  style={styles.dateButton}>
                  <Feather color={accent.primary} name="chevron-left" size={20} />
                </Pressable>
                <View style={styles.dateCopy}>
                  <ThemedText type="defaultSemiBold">{formatDate(selectedLogDate, language)}</ThemedText>
                  <ThemedText style={[styles.reminderMessage, isDark && styles.mutedDark]}>
                    {selectedLogDate === getTodayLogDate() ? text.log.todayLog : text.log.pastLog}
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityLabel={text.log.nextDay}
                  disabled={selectedLogDate === getTodayLogDate()}
                  onPress={() => adjustSelectedLogDate(1)}
                  style={[styles.dateButton, selectedLogDate === getTodayLogDate() && styles.disabledButton]}>
                  <Feather color={accent.primary} name="chevron-right" size={20} />
                </Pressable>
                <Pressable onPress={selectTodayLog} style={[styles.todayButton, { borderColor: accent.primary }]}>
                  <ThemedText style={[styles.todayButtonText, { color: accent.primary }]}>{text.log.today}</ThemedText>
                </Pressable>
              </View>

              <ThemedText type="defaultSemiBold">{text.log.profileDetails}</ThemedText>
              <View style={styles.grid}>
                <Field
                  isDark={isDark}
                  label={text.onboarding.age}
                  onChangeText={(value) => update('age', value)}
                  placeholder="0"
                  suffix={text.onboarding.years}
                  value={draft.age}
                />
                <Field
                  isDark={isDark}
                  label={text.onboarding.height}
                  onChangeText={(value) => update('heightCm', value)}
                  placeholder="0"
                  suffix={language === 'secret' ? 'mrrrow' : 'cm'}
                  value={draft.heightCm}
                />
                <Field
                  isDark={isDark}
                  label={text.onboarding.weight}
                  onChangeText={(value) => update('weightKg', value)}
                  placeholder="0"
                  suffix={language === 'secret' ? 'purr' : 'kg'}
                  value={draft.weightKg}
                />
              </View>
              <OptionGroup
                isDark={isDark}
                label={text.onboarding.activity}
                onChange={(value) => update('activityLevel', value)}
                options={[
                  ['low', text.onboarding.low],
                  ['moderate', text.onboarding.moderate],
                  ['high', text.onboarding.high],
                ]}
                value={draft.activityLevel}
              />
              <OptionGroup
                isDark={isDark}
                label={text.onboarding.sugaryDrinks}
                onChange={(value) => update('sugaryDrinks', value)}
                options={[
                  ['rarely', text.onboarding.rarely],
                  ['sometimes', text.onboarding.sometimes],
                  ['often', text.onboarding.often],
                ]}
                value={draft.sugaryDrinks}
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: draft.familyHistory }}
                onPress={() => update('familyHistory', !draft.familyHistory)}
                style={[
                  styles.checkboxRow,
                  isDark && styles.checkboxRowDark,
                  draft.familyHistory && styles.checkboxRowActive,
                  draft.familyHistory && isDark && styles.checkboxRowActiveDark,
                ]}>
                <View style={[styles.checkbox, draft.familyHistory && styles.checkboxActive]}>
                  {draft.familyHistory ? <Feather color="#ffffff" name="check" size={15} /> : null}
                </View>
                <ThemedText type="defaultSemiBold">{text.onboarding.familyHistory}</ThemedText>
              </Pressable>

              <ThemedText type="defaultSemiBold">{text.log.habitsTitle}</ThemedText>
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

function PredictionPanel({
  isDark,
  prediction,
  profile,
}: {
  isDark: boolean;
  prediction: DiabetesPrediction | null;
  profile: DiabetesProfile | null;
}) {
  const { language, text } = useI18n();

  return (
    <GlassView style={[styles.predictionPanel, isDark && styles.panelDark]}>
      {profile && prediction ? (
        <>
          <View style={styles.resultTop}>
            <View>
              <ThemedText type="subtitle">{text.log.riskTitle}</ThemedText>
              <ThemedText style={[styles.muted, isDark && styles.mutedDark]}>
                {text.predict.bmi} {prediction.bmi}
              </ThemedText>
            </View>
            <View style={[styles.scorePill, riskStyle(prediction.riskLevel)]}>
              <ThemedText style={styles.scoreText}>{text.predict.riskLevels[prediction.riskLevel]}</ThemedText>
            </View>
          </View>

          <View style={[styles.scoreTrack, isDark && styles.scoreTrackDark]}>
            <View style={[styles.scoreFill, { width: `${prediction.score}%` }]} />
          </View>
          <ThemedText>{translatePredictionSummary(prediction, language)}</ThemedText>
        </>
      ) : (
        <>
          <ThemedText type="subtitle">{text.log.riskTitle}</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            {text.predict.enterValid}
          </ThemedText>
        </>
      )}
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

function OptionGroup<T extends string>({
  isDark,
  label,
  onChange,
  options,
  value,
}: {
  isDark: boolean;
  label: string;
  onChange: (value: T) => void;
  options: [T, string][];
  value: T;
}) {
  return (
    <View style={styles.optionGroup}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <View style={[styles.segmented, isDark && styles.segmentedDark]}>
        {options.map(([optionValue, optionLabel]) => {
          const selected = value === optionValue;

          return (
            <Pressable
              key={optionValue}
              onPress={() => onChange(optionValue)}
              style={[styles.segment, selected && { backgroundColor: BrandColors.primary }]}>
              <ThemedText
                style={[
                  styles.segmentText,
                  isDark && styles.segmentTextDark,
                  selected && styles.segmentTextActive,
                ]}>
                {optionLabel}
              </ThemedText>
            </Pressable>
          );
        })}
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

function addDaysToLogDate(date: string, daysDelta: number) {
  const [year, month, day] = date.split('-').map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day));

  nextDate.setUTCDate(nextDate.getUTCDate() + daysDelta);

  return nextDate.toISOString().slice(0, 10);
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

function withProfileDefaults(log: DailyLog, profile: DiabetesProfile | null): DailyLog {
  if (!profile) {
    return log;
  }

  return {
    ...log,
    age: log.age || String(profile.age),
    activityLevel: log.activityLevel || profile.activityLevel,
    familyHistory: log.familyHistory || profile.familyHistory,
    glucoseMgDl: log.glucoseMgDl || (typeof profile.glucoseMgDl === 'number' ? String(profile.glucoseMgDl) : ''),
    heightCm: log.heightCm || String(profile.heightCm),
    sugaryDrinks: log.sugaryDrinks || profile.sugaryDrinks,
    weightKg: log.weightKg || String(profile.weightKg),
  };
}

function getLatestProfile(entries: DailyLogEntry[], fallbackProfile: DiabetesProfile | null) {
  for (const entry of entries) {
    const profile = parseProfileFromLog(entry.log);

    if (profile) {
      return profile;
    }
  }

  return fallbackProfile;
}

function parseProfileFromLog(log: DailyLog): DiabetesProfile | null {
  const glucose = Number(log.glucoseMgDl);
  const profile: DiabetesProfile = {
    age: Number(log.age),
    activityLevel: log.activityLevel,
    canMeasureGlucose: Boolean(log.glucoseMgDl),
    familyHistory: log.familyHistory,
    glucoseMgDl: log.glucoseMgDl && Number.isFinite(glucose) && glucose > 0 ? glucose : undefined,
    heightCm: Number(log.heightCm),
    sugaryDrinks: log.sugaryDrinks,
    weightKg: Number(log.weightKg),
  };
  const requiredNumbers = [profile.age, profile.heightCm, profile.weightKg];

  return requiredNumbers.every((value) => Number.isFinite(value) && value > 0) ? profile : null;
}

function analyzeLogTrends(entries: DailyLogEntry[]) {
  const chronological = [...entries].reverse();
  const trends = [
    describeNumericTrend(chronological, 'glucoseMgDl', 'Glucose', 'mg/dL'),
    describeNumericTrend(chronological, 'weightKg', 'Weight', 'kg'),
    describeNumericTrend(chronological, 'activityMinutes', 'Activity', 'min'),
    describeNumericTrend(chronological, 'sleepHours', 'Sleep', 'h'),
    describeCountTrend(chronological, 'waterCups', 'Water'),
    describeCountTrend(chronological, 'balancedMeals', 'Balanced meals'),
  ].filter((trend): trend is string => Boolean(trend));

  return trends.slice(0, 4);
}

function describeNumericTrend(
  entries: DailyLogEntry[],
  key: 'activityMinutes' | 'glucoseMgDl' | 'sleepHours' | 'weightKg',
  label: string,
  suffix: string
) {
  const values = entries
    .map((entry) => Number(entry.log[key]))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length < 2) {
    return null;
  }

  return describeTrend(label, values[0], values.at(-1)!, suffix);
}

function describeCountTrend(
  entries: DailyLogEntry[],
  key: 'balancedMeals' | 'waterCups',
  label: string
) {
  const values = entries
    .map((entry) => Number(entry.log[key]))
    .filter((value) => Number.isFinite(value));

  if (values.length < 2) {
    return null;
  }

  return describeTrend(label, values[0], values.at(-1)!, '');
}

function describeTrend(label: string, first: number, latest: number, suffix: string) {
  const delta = Math.round((latest - first) * 10) / 10;
  const unit = suffix ? ` ${suffix}` : '';

  if (Math.abs(delta) < 0.5) {
    return `${label} is steady across logged entries.`;
  }

  return `${label} is ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}${unit} from earliest to latest log.`;
}

function riskStyle(riskLevel: DiabetesPrediction['riskLevel']) {
  if (riskLevel === 'High') {
    return styles.highRisk;
  }

  if (riskLevel === 'Moderate') {
    return styles.moderateRisk;
  }

  return styles.lowRisk;
}

function translatePredictionSummary(
  prediction: DiabetesPrediction,
  language: 'en' | 'ar' | 'es' | 'secret'
) {
  if (language === 'secret') {
    return `hiss? ${prediction.score}/100.`;
  }

  return prediction.summary;
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
  predictionPanel: {
    backgroundColor: 'rgba(238, 247, 244, 0.62)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  resultTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  muted: {
    color: BrandColors.lightMutedText,
  },
  scorePill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scoreText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  lowRisk: {
    backgroundColor: BrandColors.primary,
  },
  moderateRisk: {
    backgroundColor: '#f28c18',
  },
  highRisk: {
    backgroundColor: '#d23b3b',
  },
  scoreTrack: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
  },
  scoreTrackDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
  },
  scoreFill: {
    backgroundColor: BrandColors.primary,
    height: '100%',
  },
  trendList: {
    gap: 8,
  },
  trendRow: {
    flexDirection: 'row',
    gap: 10,
  },
  trendDot: {
    borderRadius: 4,
    height: 8,
    marginTop: 8,
    width: 8,
  },
  trendText: {
    flex: 1,
  },
  ribbonReviewText: {
    color: BrandColors.lightInputText,
    flexBasis: '100%',
    lineHeight: 22,
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
  datePicker: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    padding: 12,
  },
  dateButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  dateCopy: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    minWidth: 130,
  },
  todayButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '900',
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
  checkboxRow: {
    alignItems: 'center',
    borderColor: BrandColors.lightBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  checkboxRowDark: {
    borderColor: BrandColors.darkBorder,
  },
  checkboxRowActive: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
  },
  checkboxRowActiveDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#7caed3',
    borderRadius: 7,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
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
