import { useMemo, useState } from 'react';
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
import { predictDiabetesRisk, type DiabetesProfile } from '@/lib/diabetes-advisor';

type FormState = {
  age: string;
  heightCm: string;
  weightKg: string;
  glucoseMgDl: string;
  familyHistory: boolean;
  activityLevel: DiabetesProfile['activityLevel'];
  sugaryDrinks: DiabetesProfile['sugaryDrinks'];
};

const initialForm: FormState = {
  age: '32',
  heightCm: '170',
  weightKg: '74',
  glucoseMgDl: '96',
  familyHistory: false,
  activityLevel: 'moderate',
  sugaryDrinks: 'sometimes',
};

export default function PredictScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [form, setForm] = useState<FormState>(initialForm);

  const profile = useMemo(() => parseProfile(form), [form]);
  const prediction = profile ? predictDiabetesRisk(profile) : null;

  const update = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ThemedText type="title">Diabeto</ThemedText>
          <ThemedText style={styles.subtitle}>
            AI-style diabetes risk prediction and habit advice.
          </ThemedText>
        </View>

        <View style={[styles.panel, isDark && styles.panelDark]}>
          <ThemedText type="subtitle">Your Details</ThemedText>

          <View style={styles.grid}>
            <Field
              label="Age"
              value={form.age}
              onChangeText={(value) => update('age', value)}
              suffix="years"
            />
            <Field
              label="Height"
              value={form.heightCm}
              onChangeText={(value) => update('heightCm', value)}
              suffix="cm"
            />
            <Field
              label="Weight"
              value={form.weightKg}
              onChangeText={(value) => update('weightKg', value)}
              suffix="kg"
            />
            <Field
              label="Glucose"
              value={form.glucoseMgDl}
              onChangeText={(value) => update('glucoseMgDl', value)}
              suffix="mg/dL"
            />
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
          />

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.familyHistory }}
            onPress={() => update('familyHistory', !form.familyHistory)}
            style={[styles.checkboxRow, form.familyHistory && styles.checkboxRowActive]}>
            <View style={[styles.checkbox, form.familyHistory && styles.checkboxActive]}>
              {form.familyHistory ? <ThemedText style={styles.checkmark}>Y</ThemedText> : null}
            </View>
            <ThemedText type="defaultSemiBold">Family history of diabetes</ThemedText>
          </Pressable>
        </View>

        <View style={[styles.resultPanel, isDark && styles.panelDark]}>
          {prediction ? (
            <>
              <View style={styles.resultTop}>
                <View>
                  <ThemedText type="subtitle">Prediction</ThemedText>
                  <ThemedText style={styles.muted}>BMI {prediction.bmi}</ThemedText>
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
        </View>

        <ThemedText style={styles.disclaimer}>
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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  suffix: string;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <View style={styles.inputWrap}>
        <TextInput
          keyboardType="numeric"
          onChangeText={onChangeText}
          placeholder="0"
          style={styles.input}
          value={value}
        />
        <ThemedText style={styles.suffix}>{suffix}</ThemedText>
      </View>
    </View>
  );
}

function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionGroup}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <View style={styles.segmented}>
        {options.map(([optionValue, optionLabel]) => {
          const selected = value === optionValue;
          return (
            <Pressable
              key={optionValue}
              onPress={() => onChange(optionValue)}
              style={[styles.segment, selected && styles.segmentActive]}>
              <ThemedText style={[styles.segmentText, selected && styles.segmentTextActive]}>
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
    heightCm: Number(form.heightCm),
    weightKg: Number(form.weightKg),
    glucoseMgDl: Number(form.glucoseMgDl),
    familyHistory: form.familyHistory,
    activityLevel: form.activityLevel,
    sugaryDrinks: form.sugaryDrinks,
  };

  const numbers = [profile.age, profile.heightCm, profile.weightKg, profile.glucoseMgDl];
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
    color: '#51615c',
  },
  panel: {
    backgroundColor: '#f7fbf8',
    borderColor: '#d9e8df',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  panelDark: {
    backgroundColor: '#17201c',
    borderColor: '#304239',
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
    backgroundColor: '#ffffff',
    borderColor: '#c8d8cf',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  input: {
    color: '#13231b',
    flex: 1,
    fontSize: 17,
    paddingVertical: 10,
  },
  suffix: {
    color: '#69766f',
    fontSize: 13,
  },
  optionGroup: {
    gap: 8,
  },
  segmented: {
    backgroundColor: '#e8f1ec',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
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
    backgroundColor: '#16724a',
  },
  segmentText: {
    color: '#355044',
    fontSize: 14,
    textAlign: 'center',
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  checkboxRow: {
    alignItems: 'center',
    borderColor: '#d4e5da',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  checkboxRowActive: {
    backgroundColor: '#e7f5ee',
    borderColor: '#16724a',
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#84958d',
    borderRadius: 5,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxActive: {
    backgroundColor: '#16724a',
    borderColor: '#16724a',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  resultPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#d9e8df',
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
    color: '#66736d',
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
    backgroundColor: '#16724a',
  },
  moderateRisk: {
    backgroundColor: '#b46b13',
  },
  highRisk: {
    backgroundColor: '#b3261e',
  },
  scoreTrack: {
    backgroundColor: '#dfe9e4',
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
  },
  scoreFill: {
    backgroundColor: '#16724a',
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
    backgroundColor: '#16724a',
    borderRadius: 4,
    height: 8,
    marginTop: 8,
    width: 8,
  },
  adviceText: {
    flex: 1,
  },
  disclaimer: {
    color: '#66736d',
    fontSize: 13,
    lineHeight: 19,
    paddingBottom: 18,
  },
});
