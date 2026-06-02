import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LiquidGlassView } from '@/components/ui/liquid-glass-view';
import { BrandColors } from '@/constants/theme';
import { predictDiabetesRisk, type DiabetesProfile } from '@/lib/diabetes-advisor';
import { loadHealthContext, saveHealthContext, setHealthContext } from '@/lib/health-context';

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
  const [form, setForm] = useState<FormState>(initialForm);
  const [hasLoadedSavedProfile, setHasLoadedSavedProfile] = useState(false);

  const profile = useMemo(() => parseProfile(form), [form]);
  const prediction = useMemo(() => (profile ? predictDiabetesRisk(profile) : null), [profile]);

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

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ThemedText type="title">Diabeto</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            AI-style diabetes risk prediction and habit advice.
          </ThemedText>
        </View>

        <LiquidGlassView isDark={isDark} style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">Your Details</ThemedText>

          <View style={styles.grid}>
            <Field
              label="Age"
              value={form.age}
              onChangeText={(value) => update('age', value)}
              suffix="years"
              isDark={isDark}
            />
            <Field
              label="Height"
              value={form.heightCm}
              onChangeText={(value) => update('heightCm', value)}
              suffix="cm"
              isDark={isDark}
            />
            <Field
              label="Weight"
              value={form.weightKg}
              onChangeText={(value) => update('weightKg', value)}
              suffix="kg"
              isDark={isDark}
            />
          </View>

          <OptionGroup
            label="Can measure glucose now?"
            options={[
              [true, 'Yes'],
              [false, 'No'],
            ]}
            value={form.canMeasureGlucose}
            onChange={(value) => update('canMeasureGlucose', value)}
            isDark={isDark}
          />
          {form.canMeasureGlucose ? (
            <View style={styles.grid}>
            <Field
              label="Glucose"
              value={form.glucoseMgDl}
              onChangeText={(value) => update('glucoseMgDl', value)}
              suffix="mg/dL"
              isDark={isDark}
            />
            </View>
          ) : null}

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
              {form.familyHistory ? <ThemedText style={styles.checkmark}>Y</ThemedText> : null}
            </View>
            <ThemedText type="defaultSemiBold">Family history of diabetes</ThemedText>
          </Pressable>
        </LiquidGlassView>

        <LiquidGlassView isDark={isDark} style={[styles.resultPanel, isDark && styles.panelDark]}>
          {prediction ? (
            <>
              <View style={styles.resultTop}>
                <View>
                  <ThemedText type="subtitle">Prediction</ThemedText>
                  <ThemedText style={[styles.muted, isDark && styles.mutedDark]}>
                    BMI {prediction.bmi}
                  </ThemedText>
                </View>
                <View style={[styles.scorePill, riskStyle(prediction.riskLevel)]}>
                  <ThemedText style={styles.scoreText}>{prediction.riskLevel}</ThemedText>
                </View>
              </View>

              <View style={styles.scoreTrack}>
                <View style={[styles.scoreFill, { width: `${prediction.score}%` }]} />
              </View>
              <ThemedText>{prediction.summary}</ThemedText>

              <View style={styles.adviceList}>
                <ThemedText type="defaultSemiBold">Personal advice</ThemedText>
                {prediction.advice.map((item) => (
                  <View key={item} style={styles.adviceItem}>
                    <View style={styles.bullet} />
                    <ThemedText style={styles.adviceText}>{item}</ThemedText>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <ThemedText>Enter valid numbers to see your prediction.</ThemedText>
          )}
        </LiquidGlassView>

        <ThemedText style={[styles.disclaimer, isDark && styles.mutedDark]}>
          This app is for education only and does not diagnose diabetes.
        </ThemedText>
      </ScrollView>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 18,
    padding: 20,
    paddingTop: 64,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    color: BrandColors.lightMutedText,
  },
  panel: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
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
    borderRadius: 8,
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
    borderRadius: 8,
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
  resultPanel: {
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
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
    backgroundColor: BrandColors.lightSurfaceStrong,
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
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
  disclaimer: {
    color: BrandColors.lightMutedText,
    fontSize: 13,
    lineHeight: 19,
    paddingBottom: 18,
  },
});
