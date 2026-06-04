import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { predictDiabetesRisk, type DiabetesProfile } from '@/lib/diabetes-advisor';
import { saveHealthContext } from '@/lib/health-context';

const appIconImage = require('@/assets/images/icon.png');
const ribbonImage = require('@/assets/images/ribbon.png');

type FormState = {
  age: string;
  heightCm: string;
  weightKg: string;
  familyHistory: boolean;
  activityLevel: DiabetesProfile['activityLevel'];
  sugaryDrinks: DiabetesProfile['sugaryDrinks'];
  canMeasureGlucose: boolean | null;
  glucoseMgDl: string;
};

const initialForm: FormState = {
  age: '',
  heightCm: '',
  weightKg: '',
  familyHistory: false,
  activityLevel: 'moderate',
  sugaryDrinks: 'sometimes',
  canMeasureGlucose: null,
  glucoseMgDl: '',
};

const pageTitles = ['Welcome', 'Terms', 'Health Details', 'Glucose Access', 'Ribbon'];

export default function OnboardingScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const pageOpacity = useRef(new Animated.Value(1)).current;
  const pageTranslateX = useRef(new Animated.Value(0)).current;

  const profile = useMemo(() => parseProfile(form), [form]);
  const canContinue = getCanContinue(page, acceptedTerms, acceptedPrivacy, form, profile);

  const update = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    pageOpacity.setValue(0);
    pageTranslateX.setValue(18 * direction);

    Animated.parallel([
      Animated.timing(pageOpacity, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(pageTranslateX, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [direction, page, pageOpacity, pageTranslateX]);

  const next = async () => {
    if (!canContinue) {
      return;
    }

    if (page < pageTitles.length - 1) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDirection(1);
      setPage((current) => current + 1);
      return;
    }

    if (!profile) {
      return;
    }

    await saveHealthContext({
      profile,
      prediction: predictDiabetesRisk(profile),
    });

    router.replace('/(tabs)');
  };

  const back = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDirection(-1);
    setPage((current) => Math.max(0, current - 1));
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View
          key={page}
          style={[
            styles.pageTransition,
            {
              opacity: pageOpacity,
              transform: [{ translateX: pageTranslateX }],
            },
          ]}>
          {page === 0 ? <WelcomePage isDark={isDark} /> : null}
          {page === 1 ? (
            <TermsPage
              acceptedPrivacy={acceptedPrivacy}
              acceptedTerms={acceptedTerms}
              isDark={isDark}
              setAcceptedPrivacy={setAcceptedPrivacy}
              setAcceptedTerms={setAcceptedTerms}
            />
          ) : null}
          {page === 2 ? <HealthPage form={form} isDark={isDark} update={update} /> : null}
          {page === 3 ? <GlucosePage form={form} isDark={isDark} update={update} /> : null}
          {page === 4 ? <RibbonPage isDark={isDark} /> : null}
        </Animated.View>

      </ScrollView>

      <View style={[styles.progressRail, isDark && styles.progressRailDark]}>
        <View style={styles.progressRow}>
          {pageTitles.map((title, index) => {
            const isCurrent = index === page;

            return (
              <View
                accessibilityLabel={`${title} step`}
                key={title}
                style={[
                  styles.progressDot,
                  isDark && styles.progressDotDark,
                  isCurrent && styles.progressDotCurrent,
                ]}
              />
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.footer,
          isDark && styles.footerDark,
          { paddingBottom: Math.max(insets.bottom, 14) },
        ]}>
        {page > 0 ? (
          <Pressable onPress={back} style={styles.secondaryButton}>
            <ThemedText style={styles.secondaryButtonText}>Back</ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          disabled={!canContinue}
          onPress={next}
          style={[styles.button, !canContinue && styles.buttonDisabled]}>
          <ThemedText style={styles.buttonText}>
            {page === pageTitles.length - 1 ? 'Start Diabeto' : 'Continue'}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function WelcomePage({ isDark }: { isDark: boolean }) {
  return (
    <View style={styles.page}>
      <View style={styles.logoMark}>
        <Image source={appIconImage} style={styles.logoImage} />
      </View>
      <ThemedText type="title" style={styles.title}>
        Diabeto
      </ThemedText>
      <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
        A diabetes prevention assistant that estimates risk and gives practical habit advice from simple health details.
      </ThemedText>
      <InfoCard
        isDark={isDark}
        items={[
          'Quick lifestyle-based risk estimate',
          'Personal advice from your details',
          'Optional AI chat for meals and food images',
        ]}
      />
    </View>
  );
}

function TermsPage({
  acceptedPrivacy,
  acceptedTerms,
  isDark,
  setAcceptedPrivacy,
  setAcceptedTerms,
}: {
  acceptedPrivacy: boolean;
  acceptedTerms: boolean;
  isDark: boolean;
  setAcceptedPrivacy: (value: boolean) => void;
  setAcceptedTerms: (value: boolean) => void;
}) {
  return (
    <View style={styles.page}>
      <ThemedText type="title">Before You Start</ThemedText>
      <View style={[styles.panel, isDark && styles.panelDark]}>
        <ThemedText type="subtitle">Terms of Service</ThemedText>
        <ThemedText>
          Diabeto is for education and prevention support only. It does not diagnose diabetes,
          replace a doctor, or provide emergency care.
        </ThemedText>
        <ThemedText>
          You are responsible for checking important health decisions with a qualified healthcare professional.
        </ThemedText>
      </View>
      <View style={[styles.panel, isDark && styles.panelDark]}>
        <ThemedText type="subtitle">Privacy Policy</ThemedText>
        <ThemedText>
          Diabeto uses the details you enter to estimate risk and personalize the AI companion&apos;s replies.
          Chat messages and selected images may be sent to the configured Gemini API.
        </ThemedText>
        <ThemedText>
          Do not upload private medical documents, IDs, or photos you do not want processed by the AI provider.
        </ThemedText>
      </View>
      <Checkbox
        checked={acceptedTerms}
        isDark={isDark}
        label="I agree to the Terms of Service"
        onPress={() => setAcceptedTerms(!acceptedTerms)}
      />
      <Checkbox
        checked={acceptedPrivacy}
        isDark={isDark}
        label="I understand the Privacy Policy"
        onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
      />
    </View>
  );
}

function HealthPage({
  form,
  isDark,
  update,
}: {
  form: FormState;
  isDark: boolean;
  update: <Key extends keyof FormState>(key: Key, value: FormState[Key]) => void;
}) {
  return (
    <View style={styles.page}>
      <ThemedText type="title">Your Details</ThemedText>
      <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
        These details help Diabeto make a first estimate. You can adjust them later.
      </ThemedText>
      <View style={styles.grid}>
        <Field label="Age" value={form.age} onChangeText={(value) => update('age', value)} suffix="years" isDark={isDark} />
        <Field label="Height" value={form.heightCm} onChangeText={(value) => update('heightCm', value)} suffix="cm" isDark={isDark} />
        <Field label="Weight" value={form.weightKg} onChangeText={(value) => update('weightKg', value)} suffix="kg" isDark={isDark} />
      </View>
      <OptionGroup
        label="Activity"
        options={[
          ['low', 'Low'],
          ['moderate', 'Moderate'],
          ['high', 'High'],
        ]}
        value={form.activityLevel}
        onChange={(value) => update('activityLevel', value)}
        isDark={isDark}
      />
      <OptionGroup
        label="Sugary drinks"
        options={[
          ['rarely', 'Rarely'],
          ['sometimes', 'Sometimes'],
          ['often', 'Often'],
        ]}
        value={form.sugaryDrinks}
        onChange={(value) => update('sugaryDrinks', value)}
        isDark={isDark}
      />
      <Checkbox
        checked={form.familyHistory}
        isDark={isDark}
        label="Family history of diabetes"
        onPress={() => update('familyHistory', !form.familyHistory)}
      />
    </View>
  );
}

function GlucosePage({
  form,
  isDark,
  update,
}: {
  form: FormState;
  isDark: boolean;
  update: <Key extends keyof FormState>(key: Key, value: FormState[Key]) => void;
}) {
  return (
    <View style={styles.page}>
      <ThemedText type="title">Glucose Access</ThemedText>
      <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
        Not everyone can measure blood glucose at home. Diabeto will not require a glucose value.
      </ThemedText>
      <OptionGroup
        label="Are you able to measure your blood glucose right now?"
        options={[
          [true, 'Yes'],
          [false, 'No'],
        ]}
        value={form.canMeasureGlucose}
        onChange={(value) => update('canMeasureGlucose', value)}
        isDark={isDark}
      />
      {form.canMeasureGlucose ? (
        <Field
          label="Glucose"
          value={form.glucoseMgDl}
          onChangeText={(value) => update('glucoseMgDl', value)}
          suffix="mg/dL"
          isDark={isDark}
        />
      ) : null}
      <View style={[styles.panel, isDark && styles.panelDark]}>
        <ThemedText type="defaultSemiBold">What this means</ThemedText>
        <ThemedText style={styles.helpText}>
          If you cannot measure glucose, Diabeto estimates risk using age, BMI, family history,
          activity, and sugary drink habits. A lab glucose or A1C test can make the picture clearer later.
        </ThemedText>
      </View>
    </View>
  );
}

function RibbonPage({ isDark }: { isDark: boolean }) {
  return (
    <View style={styles.page}>
      <View style={styles.mascotMark}>
        <Image source={ribbonImage} style={styles.mascotImage} />
      </View>
      <ThemedText type="title" style={styles.title}>
        Meet Ribbon
      </ThemedText>
      <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
        Ribbon is your Diabeto health companion. She can help you turn your risk estimate into
        practical meal ideas, food swaps, activity goals, and safer daily habits.
      </ThemedText>
      <InfoCard
        isDark={isDark}
        items={[
          'Uses your saved health details when you chat',
          'Can review food or drink images you attach',
          'Requires your own Gemini API key from Google AI Studio',
          'Paste the key in Settings before using chat',
          'Keeps advice educational, supportive, and practical',
        ]}
      />
    </View>
  );
}

function InfoCard({ isDark, items }: { isDark: boolean; items: string[] }) {
  return (
    <View style={[styles.panel, isDark && styles.panelDark]}>
      {items.map((item) => (
        <View key={item} style={styles.infoRow}>
          <View style={styles.infoDot} />
          <ThemedText style={styles.infoText}>{item}</ThemedText>
        </View>
      ))}
    </View>
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

function OptionGroup<T extends string | boolean | null>({
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

function Checkbox({
  checked,
  isDark,
  label,
  onPress,
}: {
  checked: boolean;
  isDark: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={[
        styles.checkboxRow,
        isDark && styles.checkboxRowDark,
        checked && styles.checkboxRowActive,
        checked && isDark && styles.checkboxRowActiveDark,
      ]}>
      <View style={[styles.checkbox, checked && styles.checkboxActive]}>
        {checked ? <ThemedText style={styles.checkmark}>Y</ThemedText> : null}
      </View>
      <ThemedText type="defaultSemiBold" style={styles.checkboxText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function parseProfile(form: FormState): DiabetesProfile | null {
  if (form.canMeasureGlucose === null) {
    return null;
  }

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

function getCanContinue(
  page: number,
  acceptedTerms: boolean,
  acceptedPrivacy: boolean,
  form: FormState,
  profile: DiabetesProfile | null
) {
  if (page === 1) {
    return acceptedTerms && acceptedPrivacy;
  }

  if (page === 2) {
    return Boolean(form.age && form.heightCm && form.weightKg);
  }

  if (page === 3) {
    return Boolean(form.canMeasureGlucose === false || (form.canMeasureGlucose === true && form.glucoseMgDl));
  }

  return true;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 22,
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 24,
    paddingBottom: 24,
    paddingTop: 56,
  },
  pageTransition: {
    flex: 1,
  },
  page: {
    gap: 20,
  },
  progressRail: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderTopColor: BrandColors.lightBorder,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    paddingTop: 12,
  },
  progressRailDark: {
    backgroundColor: 'rgba(7, 19, 31, 0.88)',
    borderTopColor: BrandColors.darkBorder,
  },
  progressRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  progressDot: {
    backgroundColor: BrandColors.lightBorder,
    borderRadius: 999,
    height: 8,
    opacity: 0.95,
    width: 8,
  },
  progressDotDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
    borderColor: BrandColors.darkBorder,
    borderWidth: 1,
  },
  progressDotCurrent: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
    width: 30,
  },
  logoMark: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 28,
    borderWidth: 1,
    height: 92,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: BrandColors.primaryDark,
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    width: 92,
  },
  logoImage: {
    height: 92,
    width: 92,
  },
  mascotImage: {
    height: 172,
    width: 172,
  },
  mascotMark: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 172,
    justifyContent: 'center',
    marginBottom: -2,
    width: 172,
  },
  title: {
    color: BrandColors.primary,
    textAlign: 'center',
  },
  subtitle: {
    color: BrandColors.lightMutedText,
    fontSize: 16,
    lineHeight: 23,
  },
  mutedDark: {
    color: BrandColors.darkMutedText,
  },
  panel: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    shadowColor: '#173532',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  panelDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  helpText: {
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  infoDot: {
    backgroundColor: BrandColors.primary,
    borderRadius: 4,
    height: 8,
    marginTop: 8,
    width: 8,
  },
  infoText: {
    flex: 1,
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
    backgroundColor: '#fbfdfc',
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  inputWrapDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  input: {
    color: BrandColors.lightInputText,
    flex: 1,
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
  optionGroup: {
    gap: 8,
  },
  segmented: {
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    padding: 5,
  },
  segmentedDark: {
    backgroundColor: BrandColors.darkSurfaceStrong,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentActive: {
    backgroundColor: BrandColors.primary,
    shadowColor: BrandColors.primaryDark,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
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
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    borderColor: '#8dafaa',
    borderRadius: 5,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  checkboxText: {
    flex: 1,
  },
  footer: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderColor: BrandColors.lightBorder,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerDark: {
    backgroundColor: 'rgba(7, 19, 31, 0.88)',
    borderTopColor: BrandColors.darkBorder,
  },
  button: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 8,
    flex: 1,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: BrandColors.primaryDark,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: BrandColors.primaryDark,
    fontWeight: '800',
  },
});
