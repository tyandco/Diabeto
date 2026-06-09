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
import { useI18n } from '@/lib/localization';
import { markOnboardingComplete } from '@/lib/onboarding-status';

const appIconImage = require('@/assets/images/icon.png');
const ribbonImage = require('@/assets/images/ribbon.png');
const ribbonPalmImage = require('@/assets/images/ribbon_right_palm.png');
const ribbonSmilingImage = require('@/assets/images/ribbon_smiling_eyesclosed.png');

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

export default function OnboardingScreen() {
  const isDark = useColorScheme() === 'dark';
  const { text } = useI18n();
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

    if (page < text.onboarding.pageTitles.length - 1) {
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
    await markOnboardingComplete();

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
          {text.onboarding.pageTitles.map((title, index) => {
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
            <ThemedText style={styles.secondaryButtonText}>{text.common.back}</ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          disabled={!canContinue}
          onPress={next}
          style={[styles.button, !canContinue && styles.buttonDisabled]}>
          <ThemedText style={styles.buttonText}>
            {page === text.onboarding.pageTitles.length - 1 ? text.onboarding.startDiabeto : text.common.continue}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function WelcomePage({ isDark }: { isDark: boolean }) {
  const { text } = useI18n();

  return (
    <View style={styles.page}>
      <View style={styles.logoMark}>
        <Image source={appIconImage} style={styles.logoImage} />
      </View>
      <ThemedText type="title" style={styles.title}>
        Diabeto
      </ThemedText>
      <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
        {text.onboarding.welcomeSubtitle}
      </ThemedText>
      <InfoCard
        isDark={isDark}
        items={text.onboarding.welcomeItems}
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
  const { text } = useI18n();

  return (
    <View style={styles.page}>
      <ThemedText type="title">{text.onboarding.beforeStart}</ThemedText>
      <View style={[styles.panel, isDark && styles.panelDark]}>
        <ThemedText type="subtitle">{text.onboarding.termsTitle}</ThemedText>
        <ThemedText>
          {text.onboarding.termsBody}
        </ThemedText>
        <ThemedText>
          {text.onboarding.termsResponsibility}
        </ThemedText>
      </View>
      <View style={[styles.panel, isDark && styles.panelDark]}>
        <ThemedText type="subtitle">{text.onboarding.privacyTitle}</ThemedText>
        <ThemedText>
          {text.onboarding.privacyBody}
        </ThemedText>
        <ThemedText>
          {text.onboarding.privacyWarning}
        </ThemedText>
      </View>
      <Checkbox
        checked={acceptedTerms}
        isDark={isDark}
        label={text.onboarding.agreeTerms}
        onPress={() => setAcceptedTerms(!acceptedTerms)}
      />
      <Checkbox
        checked={acceptedPrivacy}
        isDark={isDark}
        label={text.onboarding.understandPrivacy}
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
  const { text } = useI18n();

  return (
    <View style={styles.page}>
      <ThemedText type="title">{text.onboarding.yourDetails}</ThemedText>
      <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
        {text.onboarding.detailsHelp}
      </ThemedText>
      <View style={styles.grid}>
        <Field label={text.onboarding.age} value={form.age} onChangeText={(value) => update('age', value)} suffix={text.onboarding.years} isDark={isDark} />
        <Field label={text.onboarding.height} value={form.heightCm} onChangeText={(value) => update('heightCm', value)} suffix="cm" isDark={isDark} />
        <Field label={text.onboarding.weight} value={form.weightKg} onChangeText={(value) => update('weightKg', value)} suffix="kg" isDark={isDark} />
      </View>
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
      <Checkbox
        checked={form.familyHistory}
        isDark={isDark}
        label={text.onboarding.familyHistory}
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
  const { text } = useI18n();

  return (
    <View style={styles.page}>
      <ThemedText type="title">{text.onboarding.glucoseAccess}</ThemedText>
      <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
        {text.onboarding.glucoseHelp}
      </ThemedText>
      <OptionGroup
        label={text.onboarding.canMeasureGlucose}
        options={[
          [true, text.common.yes],
          [false, text.common.no],
        ]}
        value={form.canMeasureGlucose}
        onChange={(value) => update('canMeasureGlucose', value)}
        isDark={isDark}
      />
      {form.canMeasureGlucose ? (
        <Field
          label={text.onboarding.glucose}
          value={form.glucoseMgDl}
          onChangeText={(value) => update('glucoseMgDl', value)}
          suffix="mg/dL"
          isDark={isDark}
        />
      ) : null}
      <View style={[styles.panel, isDark && styles.panelDark]}>
        <ThemedText type="defaultSemiBold">{text.onboarding.whatThisMeans}</ThemedText>
        <ThemedText style={styles.helpText}>
          {text.onboarding.glucoseMeaning}
        </ThemedText>
      </View>
    </View>
  );
}

function RibbonPage({ isDark }: { isDark: boolean }) {
  const { text } = useI18n();
  const headTilt = useRef(new Animated.Value(0)).current;
  const handBob = useRef(new Animated.Value(0)).current;
  const handOpacity = useRef(new Animated.Value(0)).current;
  const handRotate = useRef(new Animated.Value(0)).current;
  const handTranslateY = useRef(new Animated.Value(44)).current;
  const [isSmiling, setIsSmiling] = useState(false);

  useEffect(() => {
    headTilt.setValue(0);
    handBob.setValue(0);
    handOpacity.setValue(0);
    handRotate.setValue(0);
    handTranslateY.setValue(44);
    setIsSmiling(false);

    const wave = Animated.sequence([
      Animated.parallel([
        Animated.timing(handBob, {
          duration: 95,
          easing: Easing.inOut(Easing.sin),
          toValue: -4,
          useNativeDriver: true,
        }),
        Animated.timing(handRotate, {
          duration: 95,
          easing: Easing.inOut(Easing.sin),
          toValue: -1,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(handBob, {
          duration: 120,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(handRotate, {
          duration: 120,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(handBob, {
          duration: 105,
          easing: Easing.inOut(Easing.sin),
          toValue: -3,
          useNativeDriver: true,
        }),
        Animated.timing(handRotate, {
          duration: 105,
          easing: Easing.inOut(Easing.sin),
          toValue: -1,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(handBob, {
          duration: 115,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(handRotate, {
          duration: 115,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(handBob, {
          duration: 105,
          easing: Easing.inOut(Easing.sin),
          toValue: -2,
          useNativeDriver: true,
        }),
        Animated.timing(handRotate, {
          duration: 105,
          easing: Easing.inOut(Easing.sin),
          toValue: -0.7,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(handBob, {
          duration: 170,
          easing: Easing.out(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(handRotate, {
          duration: 170,
          easing: Easing.out(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    ]);

    const animation = Animated.sequence([
      Animated.delay(360),
      Animated.timing(headTilt, {
        duration: 360,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.delay(140),
      Animated.parallel([
        Animated.timing(handOpacity, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(handTranslateY, {
          duration: 320,
          easing: Easing.out(Easing.back(1.2)),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
      wave,
      Animated.parallel([
        Animated.timing(handOpacity, {
          duration: 220,
          easing: Easing.in(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(handTranslateY, {
          duration: 260,
          easing: Easing.in(Easing.cubic),
          toValue: 44,
          useNativeDriver: true,
        }),
        Animated.timing(handBob, {
          duration: 260,
          easing: Easing.in(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(120),
      Animated.timing(headTilt, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]);

    const smileTimer = setTimeout(() => setIsSmiling(true), 360);
    animation.start(({ finished }) => {
      if (finished) {
        setIsSmiling(false);
      }
    });

    return () => {
      clearTimeout(smileTimer);
      animation.stop();
      setIsSmiling(false);
    };
  }, [handBob, handOpacity, handRotate, handTranslateY, headTilt]);

  const mascotRotate = headTilt.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-5deg'],
  });
  const mascotTranslateX = headTilt.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });
  const mascotTranslateY = headTilt.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });
  const palmRotate = handRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-8deg', '0deg', '7deg'],
  });
  const palmTranslateX = handRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-4, 0, 4],
  });

  return (
    <View style={styles.page}>
      <View style={styles.mascotMark}>
        <Animated.View
          style={[
            styles.mascotHead,
            {
              transform: [
                { translateX: mascotTranslateX },
                { translateY: mascotTranslateY },
                { rotate: mascotRotate },
              ],
            },
          ]}>
          <Image
            resizeMode="contain"
            source={isSmiling ? ribbonSmilingImage : ribbonImage}
            style={styles.mascotImage}
          />
        </Animated.View>
        <Animated.Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={ribbonPalmImage}
          style={[
            styles.mascotPalm,
            {
              opacity: handOpacity,
              transform: [
                { translateX: palmTranslateX },
                { translateY: handTranslateY },
                { translateY: handBob },
                { rotate: palmRotate },
              ],
            },
          ]}
        />
      </View>
      <ThemedText type="title" style={styles.title}>
        {text.onboarding.meetRibbon}
      </ThemedText>
      <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
        {text.onboarding.ribbonBody}
      </ThemedText>
      <InfoCard
        isDark={isDark}
        items={text.onboarding.ribbonItems}
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
  mascotHead: {
    height: 172,
    width: 172,
  },
  mascotMark: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 192,
    justifyContent: 'center',
    marginBottom: -2,
    overflow: 'visible',
    width: 204,
  },
  mascotPalm: {
    bottom: 7,
    height: 58,
    position: 'absolute',
    right: 4,
    width: 58,
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
