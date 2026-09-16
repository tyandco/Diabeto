import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GlassView } from '@/components/glass-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, Fonts, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { predictDiabetesRisk, type DiabetesPrediction, type DiabetesProfile } from '@/lib/diabetes-advisor';
import { loadHealthContext, saveHealthContext, setHealthContext } from '@/lib/health-context';
import { useI18n } from '@/lib/localization';

type FormState = {
  age: string;
  canMeasureGlucose: boolean;
  glucoseMgDl: string;
  heightCm: string;
  weightKg: string;
  familyHistory: boolean;
  activityLevel: DiabetesProfile['activityLevel'];
  sugaryDrinks: DiabetesProfile['sugaryDrinks'];
};

const initialForm: FormState = {
  age: '32',
  canMeasureGlucose: false,
  glucoseMgDl: '',
  heightCm: '170',
  weightKg: '74',
  familyHistory: false,
  activityLevel: 'moderate',
  sugaryDrinks: 'sometimes',
};

export default function PredictScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { language, text } = useI18n();
  const [form, setForm] = useState<FormState>(initialForm);
  const [hasLoadedSavedProfile, setHasLoadedSavedProfile] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isReportBusy, setIsReportBusy] = useState(false);
  const [reportEmail, setReportEmail] = useState('');
  const [reportMessage, setReportMessage] = useState('');

  const profile = useMemo(() => parseProfile(form), [form]);
  const prediction = useMemo(() => (profile ? predictDiabetesRisk(profile) : null), [profile]);
  const reportSummary = useMemo(
    () => (prediction ? translateSummary(prediction.riskLevel, prediction.score, language) : ''),
    [language, prediction]
  );
  const reportAdvice = useMemo(
    () => (profile && prediction ? translateAdvice(profile, prediction.riskLevel, language) : []),
    [language, prediction, profile]
  );
  const canCreateReport = Boolean(profile && prediction);

  useEffect(() => {
    loadHealthContext()
      .then((context) => {
        if (!context) {
          setHasLoadedSavedProfile(true);
          return;
        }

        setForm({
          age: String(context.profile.age),
          canMeasureGlucose: context.profile.canMeasureGlucose,
          glucoseMgDl:
            typeof context.profile.glucoseMgDl === 'number' ? String(context.profile.glucoseMgDl) : '',
          heightCm: String(context.profile.heightCm),
          weightKg: String(context.profile.weightKg),
          familyHistory: context.profile.familyHistory,
          activityLevel: context.profile.activityLevel,
          sugaryDrinks: context.profile.sugaryDrinks,
        });
        setHasLoadedSavedProfile(true);
      })
      .catch(() => setHasLoadedSavedProfile(true));
  }, []);

  useEffect(() => {
    setHealthContext(profile && prediction ? { profile, prediction } : null);
  }, [profile, prediction]);

  useEffect(() => {
    if (!hasLoadedSavedProfile || !profile || !prediction) {
      return;
    }

    saveHealthContext({ profile, prediction }).catch(() => undefined);
  }, [hasLoadedSavedProfile, profile, prediction]);

  const update = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const createReportPdf = async () => {
    if (!profile || !prediction) {
      throw new Error(text.predict.enterValid);
    }

    const html = buildPredictionReportHtml({
      advice: reportAdvice,
      language,
      prediction,
      profile,
      summary: reportSummary,
      text,
    });
    const result = await Print.printToFileAsync({
      html,
      margins: {
        bottom: 36,
        left: 36,
        right: 36,
        top: 36,
      },
    });

    return result.uri;
  };

  const exportReport = async () => {
    if (!canCreateReport) {
      setReportMessage(text.predict.enterValid);
      return;
    }

    setIsReportBusy(true);
    setReportMessage('');

    try {
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

  const emailReport = async () => {
    const recipient = reportEmail.trim();

    if (!canCreateReport) {
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
      const canEmail = await MailComposer.isAvailableAsync();

      if (!canEmail) {
        setReportMessage(text.predict.emailUnavailable);
        return;
      }

      const uri = await createReportPdf();

      await MailComposer.composeAsync({
        attachments: [uri],
        body: text.predict.emailBody,
        recipients: [recipient],
        subject: text.predict.reportSubject,
      });
      setIsEmailModalOpen(false);
      setReportMessage(text.predict.reportReady);
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : text.predict.reportFailed);
    } finally {
      setIsReportBusy(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ThemedText type="title">Diabeto</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            {text.predict.subtitle}
          </ThemedText>
        </View>

        <GlassView style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">{text.predict.yourDetails}</ThemedText>

          <View style={styles.grid}>
            <Field
              label={text.onboarding.age}
              value={form.age}
              onChangeText={(value) => update('age', value)}
              suffix={text.onboarding.years}
              isDark={isDark}
            />
            <Field
              label={text.onboarding.height}
              value={form.heightCm}
              onChangeText={(value) => update('heightCm', value)}
              suffix={language === 'secret' ? 'mrrrow' : 'cm'}
              isDark={isDark}
            />
            <Field
              label={text.onboarding.weight}
              value={form.weightKg}
              onChangeText={(value) => update('weightKg', value)}
              suffix={language === 'secret' ? 'purr' : 'kg'}
              isDark={isDark}
            />
          </View>

          <OptionGroup
            label={text.predict.canMeasureGlucose}
            options={[
              [true, text.common.yes],
              [false, text.common.no],
            ]}
            value={form.canMeasureGlucose}
            onChange={(value) => update('canMeasureGlucose', value)}
            isDark={isDark}
          />
          {form.canMeasureGlucose ? (
            <View style={styles.grid}>
            <Field
              label={text.onboarding.glucose}
              value={form.glucoseMgDl}
              onChangeText={(value) => update('glucoseMgDl', value)}
              suffix={language === 'secret' ? 'hiss?' : 'mg/dL'}
              isDark={isDark}
            />
            </View>
          ) : null}

          <OptionGroup
            label={text.onboarding.activity}
            options={[
              ['low', text.onboarding.low],
              ['moderate', text.onboarding.moderate],
              ['high', text.onboarding.high],
            ]}
            value={form.activityLevel}
            onChange={(value) => update('activityLevel', value)}
            isDark={isDark}
          />

          <OptionGroup
            label={text.onboarding.sugaryDrinks}
            options={[
              ['rarely', text.onboarding.rarely],
              ['sometimes', text.onboarding.sometimes],
              ['often', text.onboarding.often],
            ]}
            value={form.sugaryDrinks}
            onChange={(value) => update('sugaryDrinks', value)}
            isDark={isDark}
          />

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.familyHistory }}
            onPress={() => update('familyHistory', !form.familyHistory)}
            style={[
              styles.checkboxRow,
              isDark && styles.checkboxRowDark,
              form.familyHistory && styles.checkboxRowActive,
              form.familyHistory && isDark && styles.checkboxRowActiveDark,
            ]}>
            <View style={[styles.checkbox, form.familyHistory && styles.checkboxActive]}>
              {form.familyHistory ? <IconSymbol color="#ffffff" name="checkmark" size={16} /> : null}
            </View>
            <ThemedText type="defaultSemiBold">{text.onboarding.familyHistory}</ThemedText>
          </Pressable>
        </GlassView>

        <View style={[styles.reportBox, isDark && styles.reportBoxDark]}>
          <View style={styles.reportCopy}>
            <ThemedText type="defaultSemiBold">{text.predict.reportTitle}</ThemedText>
            <ThemedText style={[styles.reportHint, isDark && styles.mutedDark]}>
              {text.predict.reportDisclaimer}
            </ThemedText>
          </View>
          <View style={styles.reportActions}>
            <Pressable
              disabled={!canCreateReport || isReportBusy}
              onPress={exportReport}
              style={[
                styles.reportButton,
                { borderColor: BrandColors.primary },
                (!canCreateReport || isReportBusy) && styles.disabledReportButton,
              ]}>
              {isReportBusy && canCreateReport ? (
                <ActivityIndicator color={BrandColors.primary} />
              ) : (
                <IconSymbol color={BrandColors.primary} name="square.and.arrow.up" size={16} />
              )}
              <ThemedText style={[styles.reportButtonText, { color: BrandColors.primary }]}>
                {text.predict.exportPdf}
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={!canCreateReport || isReportBusy}
              onPress={() => {
                if (!canCreateReport) {
                  setReportMessage(text.predict.enterValid);
                  return;
                }

                setReportMessage('');
                setIsEmailModalOpen(true);
              }}
              style={[
                styles.reportButton,
                styles.reportButtonPrimary,
                (!canCreateReport || isReportBusy) && styles.disabledReportButton,
              ]}>
              <IconSymbol color="#ffffff" name="envelope.fill" size={16} />
              <ThemedText style={styles.reportButtonPrimaryText}>{text.predict.emailReport}</ThemedText>
            </Pressable>
          </View>
          {reportMessage || !canCreateReport ? (
            <ThemedText style={[styles.reportMessage, isDark && styles.mutedDark]}>
              {reportMessage || text.predict.enterValid}
            </ThemedText>
          ) : null}
        </View>

        <GlassView style={[styles.resultPanel, isDark && styles.panelDark]}>
          {profile && prediction ? (
            <>
              <View style={styles.resultTop}>
                <View>
                  <ThemedText type="subtitle">{text.predict.prediction}</ThemedText>
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
              <ThemedText>{reportSummary}</ThemedText>

              <View style={styles.adviceList}>
                <ThemedText type="defaultSemiBold">{text.predict.personalAdvice}</ThemedText>
                {reportAdvice.map((item) => (
                  <View key={item} style={styles.adviceItem}>
                    <View style={styles.bullet} />
                    <ThemedText style={styles.adviceText}>{item}</ThemedText>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <ThemedText>{text.predict.enterValid}</ThemedText>
          )}
        </GlassView>

        <ThemedText style={[styles.disclaimer, isDark && styles.mutedDark]}>
          {text.predict.disclaimer}
        </ThemedText>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsEmailModalOpen(false)}
        transparent
        visible={isEmailModalOpen}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.emailModal, isDark && styles.emailModalDark]}>
            <View style={styles.emailModalTop}>
              <ThemedText type="subtitle">{text.predict.emailTitle}</ThemedText>
              <Pressable onPress={() => setIsEmailModalOpen(false)} style={styles.closeButton}>
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
              style={[styles.emailInput, isDark && styles.inputDark, isDark && styles.emailInputDark]}
              value={reportEmail}
            />
            {reportMessage ? (
              <ThemedText style={[styles.reportMessage, isDark && styles.mutedDark]}>
                {reportMessage}
              </ThemedText>
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
    </ThemedView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  suffix,
  isDark,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  suffix: string;
  isDark: boolean;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <View style={[styles.inputWrap, isDark && styles.inputWrapDark]}>
        <TextInput
          keyboardType="numeric"
          onChangeText={onChangeText}
          placeholder="0"
          placeholderTextColor={isDark ? '#8faec5' : '#7890a1'}
          style={[styles.input, isDark && styles.inputDark]}
          value={value}
        />
        <ThemedText style={[styles.suffix, isDark && styles.mutedDark]}>{suffix}</ThemedText>
      </View>
    </View>
  );
}

function OptionGroup<T extends string | boolean>({
  label,
  options,
  value,
  onChange,
  isDark,
}: {
  label: string;
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
  isDark: boolean;
}) {
  return (
    <View style={styles.optionGroup}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <View style={[styles.segmented, isDark && styles.segmentedDark]}>
        {options.map(([optionValue, optionLabel]) => {
          const selected = value === optionValue;
          return (
            <Pressable
              key={String(optionValue)}
              onPress={() => onChange(optionValue)}
              style={[styles.segment, selected && styles.segmentActive]}>
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

function buildPredictionReportHtml({
  advice,
  language,
  prediction,
  profile,
  summary,
  text,
}: {
  advice: string[];
  language: 'en' | 'ar' | 'es' | 'secret';
  prediction: DiabetesPrediction;
  profile: DiabetesProfile;
  summary: string;
  text: ReturnType<typeof useI18n>['text'];
}) {
  const generatedAt = new Date().toLocaleString(language === 'secret' ? 'en' : language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const isRtl = language === 'ar';
  const details = [
    [text.onboarding.age, `${profile.age} ${text.onboarding.years}`],
    [text.onboarding.height, `${profile.heightCm} cm`],
    [text.onboarding.weight, `${profile.weightKg} kg`],
    [text.predict.bmi, String(prediction.bmi)],
    [text.onboarding.glucose, typeof profile.glucoseMgDl === 'number' ? `${profile.glucoseMgDl} mg/dL` : text.common.optional],
  ];
  const factors = [
    [text.onboarding.activity, text.onboarding[profile.activityLevel]],
    [text.onboarding.sugaryDrinks, text.onboarding[profile.sugaryDrinks]],
    [text.onboarding.familyHistory, profile.familyHistory ? text.common.yes : text.common.no],
  ];

  return `<!DOCTYPE html>
<html dir="${isRtl ? 'rtl' : 'ltr'}" lang="${language === 'secret' ? 'en' : language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { margin: 34px; }
      * { box-sizing: border-box; }
      body {
        color: #18311f;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        line-height: 1.45;
        margin: 0;
      }
      .header {
        border-bottom: 3px solid #0b948d;
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding-bottom: 18px;
      }
      .brand { color: #0b948d; font-size: 13px; font-weight: 800; text-transform: uppercase; }
      h1 { font-size: 34px; line-height: 1.05; margin: 5px 0 8px; }
      .muted { color: #63746d; font-size: 12px; }
      .score {
        background: ${riskReportColor(prediction.riskLevel)};
        border-radius: 18px;
        color: white;
        min-width: 142px;
        padding: 14px 16px;
        text-align: center;
      }
      .score strong { display: block; font-size: 30px; line-height: 1; }
      .score span { font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .summary {
        background: #eef8f6;
        border: 1px solid #cce9e4;
        border-radius: 14px;
        margin: 20px 0;
        padding: 16px;
      }
      .grid {
        display: grid;
        gap: 14px;
        grid-template-columns: 1fr 1fr;
        margin: 18px 0;
      }
      .card {
        border: 1px solid #d9e5df;
        border-radius: 14px;
        padding: 15px;
      }
      h2 { font-size: 17px; margin: 0 0 12px; }
      .row {
        border-top: 1px solid #edf2ef;
        display: flex;
        justify-content: space-between;
        gap: 18px;
        padding: 8px 0;
      }
      .row:first-of-type { border-top: 0; }
      .label { color: #63746d; }
      .value { font-weight: 800; text-align: ${isRtl ? 'left' : 'right'}; }
      ul { margin: 0; padding-${isRtl ? 'right' : 'left'}: 20px; }
      li { margin: 8px 0; }
      .disclaimer {
        border-top: 1px solid #d9e5df;
        color: #63746d;
        font-size: 11px;
        margin-top: 22px;
        padding-top: 12px;
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
      <div class="score">
        <span>${escapeHtml(text.predict.riskLevels[prediction.riskLevel])}</span>
        <strong>${prediction.score}</strong>
        <span>/ 100</span>
      </div>
    </section>
    <section class="summary">${escapeHtml(summary)}</section>
    <section class="grid">
      <div class="card">
        <h2>${escapeHtml(text.predict.reportDetails)}</h2>
        ${details.map(([label, value]) => reportRow(label, value)).join('')}
      </div>
      <div class="card">
        <h2>${escapeHtml(text.predict.riskFactors)}</h2>
        ${factors.map(([label, value]) => reportRow(label, value)).join('')}
      </div>
    </section>
    <section class="card">
      <h2>${escapeHtml(text.predict.personalAdvice)}</h2>
      <ul>${advice.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </section>
    <p class="disclaimer">${escapeHtml(text.predict.reportDisclaimer)}</p>
  </body>
</html>`;
}

function reportRow(label: string, value: string) {
  return `<div class="row"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;
}

function escapeHtml(value: string | number) {
  return String(value)
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

  return '#0b948d';
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseProfile(form: FormState): DiabetesProfile | null {
  const profile = {
    age: Number(form.age),
    canMeasureGlucose: form.canMeasureGlucose,
    glucoseMgDl: form.canMeasureGlucose ? Number(form.glucoseMgDl) : undefined,
    heightCm: Number(form.heightCm),
    weightKg: Number(form.weightKg),
    familyHistory: form.familyHistory,
    activityLevel: form.activityLevel,
    sugaryDrinks: form.sugaryDrinks,
  };

  const numbers = [profile.age, profile.heightCm, profile.weightKg];

  if (form.canMeasureGlucose) {
    numbers.push(Number(form.glucoseMgDl));
  }

  const valid = numbers.every((value) => Number.isFinite(value) && value > 0);
  return valid ? profile : null;
}

function riskStyle(riskLevel: string) {
  if (riskLevel === 'High') {
    return styles.highRisk;
  }

  if (riskLevel === 'Moderate') {
    return styles.moderateRisk;
  }

  return styles.lowRisk;
}

function translateSummary(
  riskLevel: 'Low' | 'Moderate' | 'High',
  score: number,
  language: 'en' | 'ar' | 'es' | 'secret'
) {
  if (language === 'secret') {
    if (riskLevel === 'High') {
      return `hiss mrrrow ${score}/100.`;
    }

    if (riskLevel === 'Moderate') {
      return `mrrp meow ${score}/100.`;
    }

    return `purr mew ${score}/100.`;
  }

  if (language === 'es') {
    if (riskLevel === 'High') {
      return `Tu riesgo estimado es alto (${score}/100). Esto no es un diagnóstico, pero conviene comentarlo con un profesional sanitario.`;
    }

    if (riskLevel === 'Moderate') {
      return `Tu riesgo estimado es moderado (${score}/100). Mejorar los hábitos diarios puede reducir el riesgo con el tiempo.`;
    }

    return `Tu riesgo estimado es bajo (${score}/100). Sigue construyendo hábitos que apoyen una glucosa estable.`;
  }

  if (language !== 'ar') {
    if (riskLevel === 'High') {
      return `Your estimated risk is high (${score}/100). This is not a diagnosis, but it is worth discussing with a healthcare professional.`;
    }

    if (riskLevel === 'Moderate') {
      return `Your estimated risk is moderate (${score}/100). Improving daily habits can lower your risk over time.`;
    }

    return `Your estimated risk is low (${score}/100). Keep building habits that support steady blood sugar.`;
  }

  if (riskLevel === 'High') {
    return `مستوى الخطورة المقدر مرتفع (${score}/100). هذا ليس تشخيصا، لكنه يستحق المناقشة مع مختص رعاية صحية.`;
  }

  if (riskLevel === 'Moderate') {
    return `مستوى الخطورة المقدر متوسط (${score}/100). تحسين العادات اليومية يمكن أن يقلل الخطورة مع الوقت.`;
  }

  return `مستوى الخطورة المقدر منخفض (${score}/100). استمر في بناء عادات تدعم استقرار سكر الدم.`;
}

function translateAdvice(
  profile: DiabetesProfile,
  riskLevel: 'Low' | 'Moderate' | 'High',
  language: 'en' | 'ar' | 'es' | 'secret'
) {
  const bmi = profile.weightKg / ((profile.heightCm / 100) * (profile.heightCm / 100));

  if (language === 'secret') {
    const advice = [
      'meow mew mrrp purr.',
      'mrrp purr 150.',
      'mew meow purr. hiss hiss.',
    ];

    if (bmi >= 25) {
      advice.push('purr 5-7% mrrrow.');
    }

    if (typeof profile.glucoseMgDl === 'number' && profile.glucoseMgDl >= 100) {
      advice.push('hiss mrrp 100. mew mew.');
    } else if (!profile.canMeasureGlucose) {
      advice.push('mrrp mew? purr purr.');
    }

    if (profile.sugaryDrinks !== 'rarely') {
      advice.push('hiss hiss. meow purr.');
    }

    if (profile.activityLevel === 'low') {
      advice.push('mew mrrrow 10.');
    }

    if (profile.familyHistory || riskLevel === 'High') {
      advice.push('mrrrow hiss mew.');
    }

    return advice.slice(0, 6);
  }

  if (language === 'es') {
    const advice = [
      'Construye tus comidas alrededor de verduras, proteína magra, frijoles, lentejas, cereales integrales, frutos secos y bebidas sin azúcar.',
      'Intenta hacer 150 minutos de actividad moderada cada semana, como caminar rápido, montar en bicicleta o nadar.',
      'Elige fruta, yogur o frutos secos en lugar de dulces cuando quieras un snack.',
    ];

    if (bmi >= 25) {
      advice.push('Un objetivo pequeño de pérdida de peso, incluso 5% a 7% del peso corporal, puede mejorar la sensibilidad a la insulina.');
    }

    if (typeof profile.glucoseMgDl === 'number' && profile.glucoseMgDl >= 100) {
      advice.push('Tu valor de glucosa está elevado, así que considera revisar glucosa en ayunas o A1C con un clínico.');
    } else if (!profile.canMeasureGlucose) {
      advice.push('Si es posible, pregunta en una clínica o farmacia por una prueba de glucosa en ayunas o A1C para tener una imagen más clara.');
    }

    if (profile.sugaryDrinks !== 'rarely') {
      advice.push('Cambia refrescos, té dulce, jugos y bebidas energéticas por agua o té sin azúcar la mayoría de los días.');
    }

    if (profile.activityLevel === 'low') {
      advice.push('Empieza con una caminata de 10 minutos después de una comida al día, y aumenta poco a poco.');
    }

    if (profile.familyHistory || riskLevel === 'High') {
      advice.push('Como tus factores de riesgo son más fuertes, programa revisiones regulares y pregunta por un plan de prevención.');
    }

    return advice.slice(0, 6);
  }

  if (language !== 'ar') {
    return predictDiabetesRisk(profile).advice;
  }

  const advice = [
    'اجعل وجباتك مبنية حول الخضار والبروتين قليل الدهون والفاصوليا والعدس والحبوب الكاملة والمكسرات والمشروبات غير المحلاة.',
    'استهدف 150 دقيقة من النشاط المتوسط أسبوعيا، مثل المشي السريع أو ركوب الدراجة أو السباحة.',
    'اختر الفاكهة أو اللبن أو المكسرات بدلا من الحلويات عندما ترغب في وجبة خفيفة.',
  ];

  if (bmi >= 25) {
    advice.push('هدف صغير لفقدان الوزن، حتى 5% إلى 7% من وزن الجسم، يمكن أن يحسن حساسية الإنسولين.');
  }

  if (typeof profile.glucoseMgDl === 'number' && profile.glucoseMgDl >= 100) {
    advice.push('قيمة الجلوكوز المدخلة مرتفعة، لذلك فكر في فحص الجلوكوز الصائم أو A1C مع طبيب.');
  } else if (!profile.canMeasureGlucose) {
    advice.push('إن أمكن، اسأل عيادة أو صيدلية عن فحص الجلوكوز الصائم أو A1C للحصول على صورة أوضح.');
  }

  if (profile.sugaryDrinks !== 'rarely') {
    advice.push('استبدل المشروبات الغازية والشاي المحلى والعصير ومشروبات الطاقة بالماء أو الشاي غير المحلى في معظم الأيام.');
  }

  if (profile.activityLevel === 'low') {
    advice.push('ابدأ بالمشي 10 دقائق بعد وجبة واحدة يوميا، ثم زد المدة تدريجيا.');
  }

  if (profile.familyHistory || riskLevel === 'High') {
    advice.push('لأن عوامل الخطورة لديك أقوى، حدد مواعيد فحص منتظمة واسأل عن خطة وقاية.');
  }

  return advice.slice(0, 6);
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
  panel: {
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
    padding: 18,
    boxShadow: '0 10px 18px rgba(24, 35, 31, 0.06)',
    elevation: 2,
  },
  panelDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  field: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 6,
    minWidth: 135,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  inputWrapDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  input: {
    color: BrandColors.lightInputText,
    flex: 1,
    fontFamily: Fonts.display,
    fontSize: 17,
    paddingVertical: 10,
  },
  inputDark: {
    color: BrandColors.darkInputText,
  },
  suffix: {
    color: BrandColors.lightMutedText,
    fontSize: 13,
  },
  mutedDark: {
    color: BrandColors.darkMutedText,
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
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentActive: {
    backgroundColor: BrandColors.primary,
  },
  segmentText: {
    color: BrandColors.lightInputText,
    fontSize: 14,
    textAlign: 'center',
  },
  segmentTextDark: {
    color: BrandColors.darkInputText,
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '700',
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
  resultPanel: {
    backgroundColor: 'rgba(238, 247, 244, 0.62)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  resultTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
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
  adviceList: {
    gap: 10,
  },
  adviceItem: {
    flexDirection: 'row',
    gap: 10,
  },
  bullet: {
    backgroundColor: BrandColors.primary,
    borderRadius: 4,
    height: 8,
    marginTop: 8,
    width: 8,
  },
  adviceText: {
    flex: 1,
  },
  reportBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderColor: BrandColors.glassBorder,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  reportBoxDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
    borderColor: BrandColors.darkBorder,
  },
  reportCopy: {
    gap: 4,
  },
  reportHint: {
    color: BrandColors.lightMutedText,
    fontSize: 13,
    lineHeight: 18,
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
    minHeight: 44,
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
  disabledReportButton: {
    opacity: 0.45,
  },
  reportMessage: {
    color: BrandColors.lightMutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  disabledButton: {
    opacity: 0.7,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(5, 18, 24, 0.52)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  emailModal: {
    backgroundColor: BrandColors.lightBackground,
    borderRadius: 20,
    gap: 14,
    maxWidth: 460,
    padding: 18,
    width: '100%',
  },
  emailModalDark: {
    backgroundColor: BrandColors.darkSurface,
  },
  emailModalTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  closeButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  closeText: {
    color: BrandColors.lightMutedText,
    fontSize: 26,
    lineHeight: 28,
  },
  emailInput: {
    backgroundColor: '#ffffff',
    borderColor: BrandColors.lightBorder,
    borderRadius: 14,
    borderWidth: 1,
    color: BrandColors.lightInputText,
    fontFamily: Fonts.display,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  emailInputDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  emailSendButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  emailSendText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  disclaimer: {
    color: BrandColors.lightMutedText,
    fontSize: 13,
    lineHeight: 19,
    paddingBottom: 18,
  },
});
