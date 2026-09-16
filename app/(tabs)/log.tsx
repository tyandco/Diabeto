import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MarkdownText } from '@/components/markdown-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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

const RIBBON_TIPS_CACHE_KEY = 'diabeto.ribbon-risk-tips.v1';

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
        <PredictionPanel entries={entries} isDark={isDark} prediction={prediction} profile={latestProfile} />

        <View style={[styles.summaryPanel, isDark && styles.panelDark]}>
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
        </View>

        <View style={[styles.summaryPanel, isDark && styles.panelDark]}>
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
        </View>

        <View style={[styles.summaryPanel, isDark && styles.panelDark]}>
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
        </View>

        {entries.length === 0 ? (
          <View style={[styles.emptyPanel, isDark && styles.panelDark]}>
            <ThemedText type="subtitle">{text.log.noLogs}</ThemedText>
            <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
              {text.log.emptyHelp}
            </ThemedText>
          </View>
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
    <View style={[styles.historyCard, isDark && styles.panelDark]}>
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
    </View>
  );
}

function PredictionPanel({
  entries,
  isDark,
  prediction,
  profile,
}: {
  entries: DailyLogEntry[];
  isDark: boolean;
  prediction: DiabetesPrediction | null;
  profile: DiabetesProfile | null;
}) {
  const preferences = useAppPreferences();
  const { language, text } = useI18n();
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false);
  const [isReportBusy, setIsReportBusy] = useState(false);
  const [recommendations, setRecommendations] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const tipsSignature = useMemo(
    () => (profile && prediction ? createRibbonTipsSignature(profile, prediction, entries, language) : ''),
    [entries, language, prediction, profile]
  );

  const createReportPdf = async () => {
    if (!profile || !prediction) {
      throw new Error(text.predict.enterValid);
    }

    const result = await Print.printToFileAsync({
      html: buildLogPredictionReportHtml({ language, prediction, profile, text }),
      margins: {
        bottom: 36,
        left: 36,
        right: 36,
        top: 36,
      },
    });

    return result.uri;
  };

  const createWebReportPdfBytes = () => {
    if (!profile || !prediction) {
      throw new Error(text.predict.enterValid);
    }

    const margin = 42;
    const pageWidth = 612;
    const contentWidth = pageWidth - margin * 2;
    const commands: string[] = [];
    let y = 792 - margin;

    drawPdfText(commands, 'DIABETO', margin, y, 12, true, [15, 159, 154]);
    y -= 30;

    drawPdfText(commands, text.predict.reportTitle, margin, y, 26, true, [20, 48, 44]);
    y -= 20;

    drawPdfText(commands, `${text.predict.generatedOn} ${new Date().toLocaleString()}`, margin, y, 10, false, [95, 117, 111]);
    y -= 24;

    drawPdfLine(commands, margin, y, pageWidth - margin, y, [15, 159, 154], 2);
    y -= 56;

    drawPdfRect(commands, margin, y, 132, 42, riskReportRgb255(prediction.riskLevel));
    drawPdfText(
      commands,
      `${text.predict.riskLevels[prediction.riskLevel]} ${prediction.score}/100`,
      margin + 16,
      y + 15,
      14,
      true,
      [255, 255, 255]
    );
    y -= 42;

    drawPdfRect(commands, margin, y - 72, contentWidth, 72, [237, 248, 246], [184, 226, 221]);
    wrapPdfText(translatePredictionSummary(prediction, language), 12, contentWidth - 28).forEach((line, index) => {
      drawPdfText(commands, line, margin + 14, y - 24 - index * 16, 12, false, [20, 48, 44]);
    });
    y -= 104;

    drawPdfText(commands, text.predict.reportDetails, margin, y, 16, true, [20, 48, 44]);
    y -= 24;

    const rows = getReportRows(profile, prediction, text);
    rows.forEach(([label, value]) => {
      drawPdfText(commands, label, margin, y, 11, true, [95, 117, 111]);
      drawPdfText(commands, value, margin + 210, y, 11, false, [20, 48, 44]);
      y -= 24;
    });

    y -= 22;
    drawPdfRect(commands, margin, y - 48, contentWidth, 48, [247, 247, 243]);
    wrapPdfText(text.predict.reportDisclaimer, 10, contentWidth - 24).forEach((line, index) => {
      drawPdfText(commands, line, margin + 12, y - 18 - index * 13, 10, false, [95, 117, 111]);
    });

    return createSimplePdf(commands.join('\n'));
  };

  const downloadWebReport = async () => {
    downloadPdfBytes(createWebReportPdfBytes(), 'diabeto-risk-report.pdf');
  };

  const exportReport = async () => {
    if (!profile || !prediction) {
      setReportMessage(text.predict.enterValid);
      return;
    }

    setIsReportBusy(true);
    setReportMessage('');

    try {
      if (Platform.OS === 'web') {
        await downloadWebReport();
        setReportMessage(text.predict.reportReady);
        return;
      }

      const uri = await createReportPdf();
      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        setReportMessage(text.predict.reportUnavailable);
        return;
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: text.predict.reportTitle,
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
      setReportMessage(text.predict.reportReady);
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : text.predict.reportFailed);
    } finally {
      setIsReportBusy(false);
    }
  };

  const generateRecommendations = useCallback(async (signature = tipsSignature) => {
    if (!profile || !prediction) {
      setRecommendations(text.predict.enterValid);
      return;
    }

    if (!preferences.geminiApiKey.trim()) {
      setRecommendations(text.predict.recommendationsNeedKey);
      return;
    }

    setIsRecommendationsLoading(true);

    try {
      const messages: ChatMessage[] = [
        {
          id: `predict-tips-${Date.now()}`,
          role: 'user',
          text: [
            'Create personalized diabetes-prevention tips from my current Diabeto risk prediction.',
            'Return exactly 4 markdown bullet points and nothing else.',
            'Do not include a greeting, intro sentence, signoff, encouragement line, or "you got this".',
            'Start each bullet with a bold label, for example **Food:**.',
            'Cover food, activity, glucose or weight tracking, and the next habit to focus on.',
            'Do not diagnose or prescribe medication.',
          ].join(' '),
        },
      ];
      const reply = await sendDiabetoChat(
        messages,
        formatHealthContext({ profile, prediction }),
        preferences.ribbonTone,
        formatDailyLogHistoryForAI(entries),
        preferences.geminiApiKey,
        language
      );
      const cleanedReply = cleanRibbonTips(reply) || reply.trim();

      setRecommendations(cleanedReply);
      await AsyncStorage.setItem(
        RIBBON_TIPS_CACHE_KEY,
        JSON.stringify({ signature, tips: cleanedReply })
      );
    } catch (error) {
      setRecommendations(error instanceof Error ? error.message : text.predict.recommendationsFailed);
    } finally {
      setIsRecommendationsLoading(false);
    }
  }, [
    entries,
    language,
    prediction,
    preferences.geminiApiKey,
    preferences.ribbonTone,
    profile,
    text.predict.enterValid,
    text.predict.recommendationsFailed,
    text.predict.recommendationsNeedKey,
    tipsSignature,
  ]);

  useEffect(() => {
    let isMounted = true;

    if (!profile || !prediction || !tipsSignature) {
      setRecommendations('');
      return () => {
        isMounted = false;
      };
    }

    AsyncStorage.getItem(RIBBON_TIPS_CACHE_KEY)
      .then((value) => {
        if (!isMounted) {
          return;
        }

        const cached = parseRibbonTipsCache(value);

        if (cached?.signature === tipsSignature) {
          setRecommendations(cached.tips);
          return;
        }

        if (!preferences.geminiApiKey.trim()) {
          setRecommendations(text.predict.recommendationsNeedKey);
          return;
        }

        generateRecommendations(tipsSignature);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        if (!preferences.geminiApiKey.trim()) {
          setRecommendations(text.predict.recommendationsNeedKey);
          return;
        }

        generateRecommendations(tipsSignature);
      });

    return () => {
      isMounted = false;
    };
  }, [
    generateRecommendations,
    prediction,
    preferences.geminiApiKey,
    profile,
    text.predict.recommendationsNeedKey,
    tipsSignature,
  ]);

  const emailReport = async () => {
    const recipient = reportEmail.trim();

    if (!profile || !prediction) {
      setReportMessage(text.predict.enterValid);
      return;
    }

    if (!isValidEmail(recipient)) {
      setReportMessage(text.predict.invalidEmail);
      return;
    }

    setIsReportBusy(true);
    setReportMessage('');

    try {
      const response = await fetch(getReportEmailUrl(), {
        body: JSON.stringify({
          body: text.predict.emailBody,
          fileName: 'diabeto-risk-report.pdf',
          pdfBase64: bytesToBase64(createWebReportPdfBytes()),
          recipient,
          subject: text.predict.reportSubject,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? text.predict.reportFailed);
      }

      setIsEmailModalOpen(false);
      setReportMessage(text.predict.emailSent);
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : text.predict.reportFailed);
    } finally {
      setIsReportBusy(false);
    }
  };

  return (
    <View style={[styles.predictionPanel, isDark && styles.panelDark]}>
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
          <View style={styles.reportActions}>
            <Pressable
              disabled={isReportBusy}
              onPress={exportReport}
              style={[styles.reportButton, { borderColor: BrandColors.primary }, isReportBusy && styles.disabledButton]}>
              {isReportBusy ? (
                <ActivityIndicator color={BrandColors.primary} />
              ) : (
                <Feather color={BrandColors.primary} name="share" size={16} />
              )}
              <ThemedText style={[styles.reportButtonText, { color: BrandColors.primary }]}>
                {text.predict.exportPdf}
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={isReportBusy}
              onPress={() => {
                setReportMessage('');
                setIsEmailModalOpen(true);
              }}
              style={[styles.reportButton, styles.reportButtonPrimary, isReportBusy && styles.disabledButton]}>
              <Feather color="#ffffff" name="mail" size={16} />
              <ThemedText style={styles.reportButtonPrimaryText}>{text.predict.emailReport}</ThemedText>
            </Pressable>
          </View>
          {reportMessage ? (
            <ThemedText style={[styles.reportMessage, isDark && styles.mutedDark]}>{reportMessage}</ThemedText>
          ) : null}

          <View style={[styles.recommendationsBox, isDark && styles.recommendationsBoxDark]}>
            <View style={styles.summaryCopy}>
              <ThemedText type="defaultSemiBold">{text.predict.recommendationsTitle}</ThemedText>
              <ThemedText style={[styles.reportMessage, isDark && styles.mutedDark]}>
                {preferences.geminiApiKey.trim()
                  ? text.predict.recommendationsBody
                  : text.predict.recommendationsNeedKey}
              </ThemedText>
            </View>
            {isRecommendationsLoading ? (
              <View style={styles.recommendationsLoadingRow}>
                <ActivityIndicator color={BrandColors.primary} />
                <ThemedText style={[styles.reportMessage, isDark && styles.mutedDark]}>
                  {text.predict.recommendationsLoading}
                </ThemedText>
              </View>
            ) : null}
            {recommendations ? (
              <MarkdownText isDark={isDark} style={[styles.recommendationsText, isDark && styles.mutedDark]} text={recommendations} />
            ) : null}
          </View>

          <Modal
            animationType="fade"
            onRequestClose={() => setIsEmailModalOpen(false)}
            transparent
            visible={isEmailModalOpen}>
            <View style={styles.reportModalBackdrop}>
              <View style={[styles.emailModal, isDark && styles.panelDark]}>
                <View style={styles.emailModalTop}>
                  <ThemedText type="subtitle">{text.predict.emailTitle}</ThemedText>
                  <Pressable onPress={() => setIsEmailModalOpen(false)} style={styles.reportCloseButton}>
                    <ThemedText style={[styles.closeText, isDark && styles.mutedDark]}>×</ThemedText>
                  </Pressable>
                </View>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  inputMode="email"
                  onChangeText={setReportEmail}
                  placeholder={text.predict.emailPlaceholder}
                  placeholderTextColor={isDark ? '#8faec5' : '#7890a1'}
                  style={[styles.emailInput, isDark && styles.inputDark]}
                  value={reportEmail}
                />
                {reportMessage ? (
                  <ThemedText style={[styles.reportMessage, isDark && styles.mutedDark]}>{reportMessage}</ThemedText>
                ) : null}
                <Pressable
                  disabled={isReportBusy}
                  onPress={emailReport}
                  style={[styles.emailSendButton, isReportBusy && styles.disabledButton]}>
                  {isReportBusy ? <ActivityIndicator color="#ffffff" /> : null}
                  <ThemedText style={styles.emailSendText}>{text.predict.sendEmail}</ThemedText>
                </Pressable>
              </View>
            </View>
          </Modal>
        </>
      ) : (
        <>
          <ThemedText type="subtitle">{text.log.riskTitle}</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            {text.predict.enterValid}
          </ThemedText>
        </>
      )}
    </View>
  );
}

function buildLogPredictionReportHtml({
  language,
  prediction,
  profile,
  text,
}: {
  language: 'en' | 'ar' | 'es' | 'secret';
  prediction: DiabetesPrediction;
  profile: DiabetesProfile;
  text: ReturnType<typeof useI18n>['text'];
}) {
  const generatedAt = new Date().toLocaleString();
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const rows = getReportRows(profile, prediction, text);

  return `<!doctype html>
<html dir="${direction}">
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 34px; }
    body {
      color: #14302c;
      font-family: Arial, sans-serif;
      line-height: 1.45;
      margin: 0;
    }
    .header {
      align-items: flex-start;
      border-bottom: 2px solid #0f9f9a;
      display: flex;
      justify-content: space-between;
      gap: 18px;
      padding-bottom: 18px;
    }
    .brand { color: #0f9f9a; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    h1 { font-size: 30px; margin: 4px 0 6px; }
    h2 { font-size: 18px; margin: 22px 0 10px; }
    .muted { color: #5f756f; }
    .score {
      background: ${riskReportColor(prediction.riskLevel)};
      border-radius: 999px;
      color: #fff;
      font-size: 18px;
      font-weight: 800;
      padding: 12px 18px;
      text-align: center;
      white-space: nowrap;
    }
    .summary {
      background: #edf8f6;
      border: 1px solid #b8e2dd;
      border-radius: 14px;
      margin-top: 18px;
      padding: 16px;
    }
    table {
      border-collapse: collapse;
      margin-top: 8px;
      width: 100%;
    }
    td {
      border-bottom: 1px solid #d8e7e3;
      padding: 9px 6px;
      vertical-align: top;
    }
    td:first-child { color: #5f756f; font-weight: 700; width: 42%; }
    .disclaimer {
      background: #f7f7f3;
      border-radius: 12px;
      color: #5f756f;
      font-size: 12px;
      margin-top: 24px;
      padding: 12px;
    }
  </style>
</head>
<body>
  <section class="header">
    <div>
      <div class="brand">Diabeto</div>
      <h1>${escapeHtml(text.predict.reportTitle)}</h1>
      <div class="muted">${escapeHtml(text.predict.generatedOn)} ${escapeHtml(generatedAt)}</div>
    </div>
    <div class="score">${escapeHtml(text.predict.riskLevels[prediction.riskLevel])}<br />${prediction.score}/100</div>
  </section>

  <section class="summary">
    ${escapeHtml(translatePredictionSummary(prediction, language))}
  </section>

  <h2>${escapeHtml(text.predict.reportDetails)}</h2>
  <table>
    ${rows.map(([label, value]) => reportRow(label, value)).join('')}
  </table>

  <div class="disclaimer">${escapeHtml(text.predict.reportDisclaimer)}</div>
</body>
</html>`;
}

function reportRow(label: string, value: string) {
  return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
}

function getReportRows(
  profile: DiabetesProfile,
  prediction: DiabetesPrediction,
  text: ReturnType<typeof useI18n>['text']
) {
  return [
    [text.onboarding.age, `${profile.age}`],
    [text.onboarding.height, `${profile.heightCm} cm`],
    [text.onboarding.weight, `${profile.weightKg} kg`],
    [text.predict.bmi, `${prediction.bmi}`],
    [text.onboarding.glucose, typeof profile.glucoseMgDl === 'number' ? `${profile.glucoseMgDl} mg/dL` : 'N/A'],
    [text.onboarding.activity, text.onboarding[profile.activityLevel]],
    [text.onboarding.sugaryDrinks, text.onboarding[profile.sugaryDrinks]],
    [text.onboarding.familyHistory, profile.familyHistory ? text.common.yes : text.common.no],
  ];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function riskReportColor(riskLevel: DiabetesPrediction['riskLevel']) {
  if (riskLevel === 'High') {
    return '#d23b3b';
  }

  if (riskLevel === 'Moderate') {
    return '#f28c18';
  }

  return '#0f9f9a';
}

function riskReportRgb255(riskLevel: DiabetesPrediction['riskLevel']): [number, number, number] {
  if (riskLevel === 'High') {
    return [210, 59, 59];
  }

  if (riskLevel === 'Moderate') {
    return [242, 140, 24];
  }

  return [15, 159, 154];
}

function wrapPdfText(text: string, size: number, maxWidth: number) {
  const lines: string[] = [];
  let currentLine = '';
  const averageCharWidth = size * 0.54;
  const maxChars = Math.max(20, Math.floor(maxWidth / averageCharWidth));

  text.split(/\s+/).forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= maxChars) {
      currentLine = nextLine;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawPdfText(
  commands: string[],
  text: string,
  x: number,
  y: number,
  size: number,
  bold: boolean,
  color: [number, number, number]
) {
  commands.push(
    'BT',
    `${pdfColor(color)} rg`,
    `/${bold ? 'F2' : 'F1'} ${size} Tf`,
    `${x} ${y} Td`,
    `(${escapePdfText(toPdfSafeText(text))}) Tj`,
    'ET'
  );
}

function drawPdfLine(
  commands: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number],
  width: number
) {
  commands.push(`${pdfColor(color)} RG`, `${width} w`, `${x1} ${y1} m`, `${x2} ${y2} l`, 'S');
}

function drawPdfRect(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  fill: [number, number, number],
  stroke?: [number, number, number]
) {
  commands.push(`${pdfColor(fill)} rg`);

  if (stroke) {
    commands.push(`${pdfColor(stroke)} RG`, `${x} ${y} ${width} ${height} re`, 'B');
    return;
  }

  commands.push(`${x} ${y} ${width} ${height} re`, 'f');
}

function createSimplePdf(pageCommands: string) {
  const stream = `${pageCommands}\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);

  for (let index = 0; index < pdf.length; index += 1) {
    bytes[index] = pdf.charCodeAt(index) & 0xff;
  }

  return bytes;
}

function pdfColor([red, green, blue]: [number, number, number]) {
  return `${red / 255} ${green / 255} ${blue / 255}`;
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function toPdfSafeText(text: string) {
  return text.replace(/[^\x20-\x7e]/g, '-');
}

function downloadPdfBytes(bytes: Uint8Array, fileName: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const pdfBytes = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfBytes).set(bytes);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getReportEmailUrl() {
  if (Platform.OS === 'web') {
    return '/api/report-email';
  }

  const siteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl) {
    throw new Error('Add EXPO_PUBLIC_SITE_URL to email reports from the installed app.');
  }

  return `${siteUrl.replace(/\/$/, '')}/api/report-email`;
}

function bytesToBase64(bytes: Uint8Array) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let index = 0;

  for (; index + 2 < bytes.length; index += 3) {
    output += chars[bytes[index] >> 2];
    output += chars[((bytes[index] & 3) << 4) | (bytes[index + 1] >> 4)];
    output += chars[((bytes[index + 1] & 15) << 2) | (bytes[index + 2] >> 6)];
    output += chars[bytes[index + 2] & 63];
  }

  if (index < bytes.length) {
    output += chars[bytes[index] >> 2];

    if (index + 1 < bytes.length) {
      output += chars[((bytes[index] & 3) << 4) | (bytes[index + 1] >> 4)];
      output += chars[(bytes[index + 1] & 15) << 2];
      output += '=';
    } else {
      output += chars[(bytes[index] & 3) << 4];
      output += '==';
    }
  }

  return output;
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

function createRibbonTipsSignature(
  profile: DiabetesProfile,
  prediction: DiabetesPrediction,
  entries: DailyLogEntry[],
  language: 'en' | 'ar' | 'es' | 'secret'
) {
  return JSON.stringify({
    activityLevel: profile.activityLevel,
    age: profile.age,
    bmi: prediction.bmi,
    canMeasureGlucose: profile.canMeasureGlucose,
    familyHistory: profile.familyHistory,
    glucoseMgDl: profile.glucoseMgDl ?? null,
    heightCm: profile.heightCm,
    language,
    riskLevel: prediction.riskLevel,
    score: prediction.score,
    sugaryDrinks: profile.sugaryDrinks,
    weightKg: profile.weightKg,
    recentLogs: entries.slice(0, 7).map((entry) => ({
      activityMinutes: entry.log.activityMinutes,
      balancedMeals: entry.log.balancedMeals,
      date: entry.date,
      glucoseMgDl: entry.log.glucoseMgDl,
      mood: entry.log.mood,
      sleepHours: entry.log.sleepHours,
      waterCups: entry.log.waterCups,
      weightKg: entry.log.weightKg,
    })),
  });
}

function parseRibbonTipsCache(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as { signature?: unknown; tips?: unknown };

    if (typeof parsed.signature === 'string' && typeof parsed.tips === 'string') {
      return { signature: parsed.signature, tips: parsed.tips };
    }
  } catch {
    return null;
  }

  return null;
}

function cleanRibbonTips(reply: string) {
  const lines = reply
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const firstBulletIndex = lines.findIndex((line) => /^[-*]\s+/.test(line));
  const bulletLines = firstBulletIndex >= 0 ? lines.slice(firstBulletIndex) : lines;
  const withoutSignoff = bulletLines.filter(
    (line) => !/^(you('|’)ve got this!?|you got this!?|hope this helps!?|let('|’)s keep|hello|hi\b)/i.test(line)
  );

  return withoutSignoff.join('\n').trim();
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: BrandColors.lightBorder,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 18,
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
  reportActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reportButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  reportButtonPrimary: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  reportButtonText: {
    fontSize: 13,
    fontWeight: '900',
  },
  reportButtonPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  reportMessage: {
    color: BrandColors.lightMutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  recommendationsBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  recommendationsBoxDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
    borderColor: BrandColors.darkBorder,
  },
  recommendationsButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  recommendationsText: {
    color: BrandColors.lightInputText,
    lineHeight: 22,
  },
  recommendationsLoadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
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
  reportModalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(5, 18, 24, 0.52)',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  emailModal: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 18,
    width: '100%',
  },
  emailModalTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  reportCloseButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  closeText: {
    color: BrandColors.lightMutedText,
    fontSize: 28,
    lineHeight: 30,
  },
  emailInput: {
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 14,
    borderWidth: 1,
    color: BrandColors.lightInputText,
    fontFamily: Fonts.display,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  emailSendButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  emailSendText: {
    color: '#ffffff',
    fontWeight: '900',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: BrandColors.lightBorder,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  panelDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: BrandColors.lightBorder,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 14,
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
