import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Easing,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  updateAppPreferences,
  useAccentPalette,
  useAppPreferences,
  type AppLanguage,
} from '@/lib/app-preferences';
import { useAuth } from '@/lib/auth-context';
import { predictDiabetesRisk, type DiabetesProfile } from '@/lib/diabetes-advisor';
import { saveHealthContext } from '@/lib/health-context';
import { languageLabels, useI18n } from '@/lib/localization';
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

export default function OnboardingScreen() {
  const isDark = useColorScheme() === 'dark';
  const { text } = useI18n();
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const pageOpacity = useRef(new Animated.Value(1)).current;
  const pageTranslateX = useRef(new Animated.Value(0)).current;

  const profile = useMemo(() => parseProfile(form), [form]);
  const pageTitles = useMemo(
    () => [text.account.title, ...text.onboarding.pageTitles],
    [text.account.title, text.onboarding.pageTitles]
  );
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

  const finishOnboarding = async () => {
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

    await finishOnboarding();
  };

  const back = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDirection(-1);
    setPage((current) => Math.max(0, current - 1));
  };

  const continueToSetup = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDirection(1);
    setPage(1);
  };

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
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
            {page === 0 ? (
              <OnboardingAccountPage auth={auth} isDark={isDark} onNeedsSetup={continueToSetup} />
            ) : null}
            {page === 1 ? <WelcomePage isDark={isDark} /> : null}
            {page === 2 ? (
              <TermsPage
                acceptedPrivacy={acceptedPrivacy}
                acceptedTerms={acceptedTerms}
                isDark={isDark}
                setAcceptedPrivacy={setAcceptedPrivacy}
                setAcceptedTerms={setAcceptedTerms}
              />
            ) : null}
            {page === 3 ? <HealthPage form={form} isDark={isDark} update={update} /> : null}
            {page === 4 ? <GlucosePage form={form} isDark={isDark} update={update} /> : null}
            {page === 5 ? <RibbonPage isDark={isDark} /> : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

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
        {page > 1 ? (
          <Pressable onPress={back} style={styles.secondaryButton}>
            <ThemedText style={styles.secondaryButtonText}>{text.common.back}</ThemedText>
          </Pressable>
        ) : null}
        {page > 0 ? (
          <Pressable
            disabled={!canContinue}
            onPress={next}
            style={[styles.button, !canContinue && styles.buttonDisabled]}>
            <ThemedText style={styles.buttonText}>
              {page === pageTitles.length - 1 ? text.onboarding.startDiabeto : text.common.continue}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
  );
}

function WelcomePage({ isDark }: { isDark: boolean }) {
  const accent = useAccentPalette();
  const { text } = useI18n();
  const preferences = useAppPreferences();
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const availableLanguageOptions = preferences.secretLanguageUnlocked
    ? [...languageOptions, secretLanguageOption]
    : languageOptions;

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
      <View style={[styles.languageRow, isDark && styles.languageRowDark]}>
        <ThemedText type="defaultSemiBold" style={styles.languageRowLabel}>
          {text.settings.language}
        </ThemedText>
        <LanguageDropdown
          accent={accent.primary}
          isDark={isDark}
          isOpen={isLanguageOpen}
          onChange={(value) => {
            updateAppPreferences({ language: value });
            setIsLanguageOpen(false);
          }}
          onToggle={() => setIsLanguageOpen((current) => !current)}
          options={availableLanguageOptions}
          value={preferences.language}
        />
      </View>
      <InfoCard
        isDark={isDark}
        items={text.onboarding.welcomeItems}
      />
    </View>
  );
}

function LanguageDropdown<T extends string>({
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
        <IconSymbol
          color={isDark ? BrandColors.darkInputText : BrandColors.lightInputText}
          name="chevron.down"
          size={22}
        />
      </Pressable>

      {isOpen ? (
        <View style={[styles.dropdownMenu, isDark && styles.dropdownMenuDark]}>
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <Pressable
                key={option.value}
                onPress={() => onChange(option.value)}
                style={[styles.dropdownOption, selected && { backgroundColor: accent }]}>
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
  const { language, text } = useI18n();

  return (
    <View style={styles.page}>
      <ThemedText type="title">{text.onboarding.yourDetails}</ThemedText>
      <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
        {text.onboarding.detailsHelp}
      </ThemedText>
      <View style={styles.grid}>
        <Field label={text.onboarding.age} value={form.age} onChangeText={(value) => update('age', value)} suffix={text.onboarding.years} isDark={isDark} />
        <Field label={text.onboarding.height} value={form.heightCm} onChangeText={(value) => update('heightCm', value)} suffix={language === 'secret' ? 'mrrrow' : 'cm'} isDark={isDark} />
        <Field label={text.onboarding.weight} value={form.weightKg} onChangeText={(value) => update('weightKg', value)} suffix={language === 'secret' ? 'purr' : 'kg'} isDark={isDark} />
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
  const { language, text } = useI18n();

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
          suffix={language === 'secret' ? 'hiss?' : 'mg/dL'}
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

function OnboardingAccountPage({
  auth,
  isDark,
  onNeedsSetup,
}: {
  auth: ReturnType<typeof useAuth>;
  isDark: boolean;
  onNeedsSetup: () => void;
}) {
  const accent = useAccentPalette();
  const { text } = useI18n();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const handledSignedInUser = useRef(false);

  useEffect(() => {
    if (!auth.user || auth.isLoading || handledSignedInUser.current) {
      return;
    }

    handledSignedInUser.current = true;
    setIsSubmitting(true);
    setMessage(text.account.restoringData);

    auth
      .restoreUserData()
      .then((result) => {
        if (result.hasHealthContext) {
          router.replace('/(tabs)');
          return;
        }

        onNeedsSetup();
      })
      .catch((restoreError) => {
        setError(restoreError instanceof Error ? restoreError.message : text.account.restoreFailed);
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsRedirecting(false);
      });
  }, [auth, onNeedsSetup, text.account.restoreFailed, text.account.restoringData]);

  async function continueAfterAuth() {
    const result = await auth.restoreUserData();

    if (result.hasHealthContext) {
      router.replace('/(tabs)');
      return;
    }

    onNeedsSetup();
  }

  async function handleEmailAuth() {
    const normalizedEmail = email.trim();

    setError('');
    setMessage('');

    if (!normalizedEmail || password.length < 6) {
      setError(text.account.invalidCredentials);
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'sign-in') {
        await auth.signIn(normalizedEmail, password);
        await continueAfterAuth();
      } else {
        const result = await auth.signUp(normalizedEmail, password);

        if (result.needsEmailConfirmation) {
          setMessage(text.account.confirmEmailGuest);
        }

        onNeedsSetup();
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : text.account.authFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signInWithGoogle() {
    setError('');
    setMessage(text.account.redirectingGoogle);
    setIsSubmitting(true);
    setIsRedirecting(true);

    try {
      await auth.signInWithGoogle('/onboarding');

      if (Platform.OS === 'web') {
        return;
      }

      await continueAfterAuth();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : text.account.googleStartFailed);
      setIsRedirecting(false);
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.page}>
      <ThemedText type="title" style={styles.title}>
        {text.account.onboardingTitle}
      </ThemedText>
      <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
        {text.account.onboardingSubtitle}
      </ThemedText>

      <View style={[styles.panel, isDark && styles.panelDark]}>
        {!auth.isConfigured ? (
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            {text.account.supabaseGuest}
          </ThemedText>
        ) : auth.isLoading || isRedirecting ? (
          <View style={styles.authLoading}>
            <ActivityIndicator color={accent.primary} />
            <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
              {isRedirecting ? text.account.waitingGoogle : text.account.loadingAccount}
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={[styles.segmented, isDark && styles.segmentedDark]}>
              {(['sign-in', 'sign-up'] as const).map((option) => {
                const selected = mode === option;

                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setMode(option);
                      setError('');
                      setMessage('');
                    }}
                    style={[styles.segment, selected && styles.segmentActive]}>
                    <ThemedText
                      style={[
                        styles.segmentText,
                        isDark && styles.segmentTextDark,
                        selected && styles.segmentTextActive,
                      ]}>
                      {option === 'sign-in' ? text.account.signIn : text.account.createAccount}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.inputWrap, isDark && styles.inputWrapDark]}>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                inputMode="email"
                onChangeText={setEmail}
                placeholder={text.account.email}
                placeholderTextColor={isDark ? '#8faec5' : '#7890a1'}
                style={[styles.input, isDark && styles.inputDark]}
                value={email}
              />
            </View>

            <View style={[styles.inputWrap, isDark && styles.inputWrapDark]}>
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setPassword}
                placeholder={text.account.password}
                placeholderTextColor={isDark ? '#8faec5' : '#7890a1'}
                secureTextEntry
                style={[styles.input, isDark && styles.inputDark]}
                value={password}
              />
            </View>

            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
            {message ? <ThemedText style={[styles.messageText, isDark && styles.messageTextDark]}>{message}</ThemedText> : null}

            <Pressable
              disabled={isSubmitting}
              onPress={handleEmailAuth}
              style={[styles.accountButton, { backgroundColor: accent.primary }, isSubmitting && styles.buttonDisabled]}>
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText style={styles.buttonText}>
                  {mode === 'sign-in' ? text.account.signIn : text.account.createAccount}
                </ThemedText>
              )}
            </Pressable>

            <Pressable
              disabled={isSubmitting}
              onPress={signInWithGoogle}
              style={[styles.googleButton, isDark && styles.googleButtonDark, isSubmitting && styles.buttonDisabled]}>
              {isRedirecting ? (
                <ActivityIndicator color={isDark ? BrandColors.darkInputText : BrandColors.lightInputText} />
              ) : (
                <ThemedText style={[styles.googleButtonText, isDark && styles.googleButtonTextDark]}>
                  {text.account.signInWithGoogle}
                </ThemedText>
              )}
            </Pressable>
          </>
        )}

        <Pressable
          disabled={isSubmitting}
          onPress={onNeedsSetup}
          style={[styles.guestButton, isSubmitting && styles.buttonDisabled]}>
          <ThemedText style={[styles.guestButtonText, { color: accent.primary }]}>
            {text.account.continueAsGuest}
          </ThemedText>
        </Pressable>
      </View>
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
        {checked ? <ThemedText style={styles.checkmark}>✓</ThemedText> : null}
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
  if (page === 2) {
    return acceptedTerms && acceptedPrivacy;
  }

  if (page === 3) {
    return Boolean(form.age && form.heightCm && form.weightKg);
  }

  if (page === 4) {
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
  keyboardView: {
    flex: 1,
  },
  page: {
    gap: 20,
  },
  languageRow: {
    alignItems: 'center',
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    zIndex: 5,
  },
  languageRowDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  languageRowLabel: {
    flex: 1,
    minWidth: 0,
  },
  dropdown: {
    flexBasis: 176,
    flexGrow: 0,
    flexShrink: 1,
    gap: 6,
    position: 'relative',
    zIndex: 10,
  },
  dropdownButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: 11,
  },
  dropdownButtonDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  dropdownMenu: {
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 48,
    width: '100%',
    zIndex: 20,
  },
  dropdownMenuDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  dropdownOption: {
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 11,
  },
  dropdownOptionText: {
    color: BrandColors.lightInputText,
    fontSize: 14,
    fontWeight: '800',
  },
  dropdownValue: {
    color: BrandColors.lightInputText,
    fontSize: 14,
    fontWeight: '800',
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
    boxShadow: '0 14px 22px rgba(8, 102, 101, 0.22)',
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
    boxShadow: '0 10px 18px rgba(23, 53, 50, 0.05)',
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
    boxShadow: '0 4px 8px rgba(8, 102, 101, 0.16)',
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
    boxShadow: '0 8px 14px rgba(8, 102, 101, 0.18)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  accountButton: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  authLoading: {
    alignItems: 'center',
    gap: 12,
    minHeight: 150,
    justifyContent: 'center',
  },
  errorText: {
    color: '#cc2f45',
    fontSize: 14,
    fontWeight: '800',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  googleButtonDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  googleButtonText: {
    color: BrandColors.lightInputText,
    fontSize: 16,
    fontWeight: '900',
  },
  googleButtonTextDark: {
    color: BrandColors.darkInputText,
  },
  guestButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  guestButtonText: {
    fontSize: 16,
    fontWeight: '900',
  },
  messageText: {
    color: BrandColors.lightInputText,
    fontSize: 14,
    fontWeight: '800',
  },
  messageTextDark: {
    color: BrandColors.darkInputText,
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
