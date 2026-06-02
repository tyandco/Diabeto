export type DiabetesProfile = {
  age: number;
  canMeasureGlucose: boolean;
  heightCm: number;
  weightKg: number;
  glucoseMgDl?: number;
  familyHistory: boolean;
  activityLevel: 'low' | 'moderate' | 'high';
  sugaryDrinks: 'rarely' | 'sometimes' | 'often';
};

export type DiabetesPrediction = {
  bmi: number;
  score: number;
  riskLevel: 'Low' | 'Moderate' | 'High';
  summary: string;
  advice: string[];
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const round = (value: number, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export function predictDiabetesRisk(profile: DiabetesProfile): DiabetesPrediction {
  const heightMeters = profile.heightCm / 100;
  const bmi = profile.weightKg / (heightMeters * heightMeters);

  let score = 8;

  if (profile.age >= 45) {
    score += 18;
  } else if (profile.age >= 35) {
    score += 10;
  }

  if (bmi >= 35) {
    score += 24;
  } else if (bmi >= 30) {
    score += 18;
  } else if (bmi >= 25) {
    score += 10;
  }

  if (typeof profile.glucoseMgDl === 'number') {
    if (profile.glucoseMgDl >= 126) {
      score += 30;
    } else if (profile.glucoseMgDl >= 100) {
      score += 18;
    } else if (profile.glucoseMgDl >= 90) {
      score += 6;
    }
  }

  if (profile.familyHistory) {
    score += 14;
  }

  if (profile.activityLevel === 'low') {
    score += 14;
  } else if (profile.activityLevel === 'moderate') {
    score += 5;
  }

  if (profile.sugaryDrinks === 'often') {
    score += 12;
  } else if (profile.sugaryDrinks === 'sometimes') {
    score += 6;
  }

  const finalScore = Math.round(clamp(score, 0, 100));
  const riskLevel = finalScore >= 65 ? 'High' : finalScore >= 35 ? 'Moderate' : 'Low';

  return {
    bmi: round(bmi),
    score: finalScore,
    riskLevel,
    summary: buildSummary(riskLevel, finalScore),
    advice: buildAdvice(profile, bmi, riskLevel),
  };
}

function buildSummary(riskLevel: DiabetesPrediction['riskLevel'], score: number) {
  if (riskLevel === 'High') {
    return `Your estimated risk is high (${score}/100). This is not a diagnosis, but it is worth discussing with a healthcare professional.`;
  }

  if (riskLevel === 'Moderate') {
    return `Your estimated risk is moderate (${score}/100). Improving daily habits can lower your risk over time.`;
  }

  return `Your estimated risk is low (${score}/100). Keep building habits that support steady blood sugar.`;
}

function buildAdvice(
  profile: DiabetesProfile,
  bmi: number,
  riskLevel: DiabetesPrediction['riskLevel']
) {
  const advice = [
    'Build meals around vegetables, lean protein, beans, lentils, whole grains, nuts, and unsweetened drinks.',
    'Aim for 150 minutes of moderate activity each week, such as brisk walking, cycling, or swimming.',
    'Choose fruit, yogurt, or nuts instead of sweets when you want a snack.',
  ];

  if (bmi >= 25) {
    advice.push('A small weight loss goal, even 5% to 7% of body weight, can improve insulin sensitivity.');
  }

  if (typeof profile.glucoseMgDl === 'number' && profile.glucoseMgDl >= 100) {
    advice.push('Your glucose entry is elevated, so consider checking fasting glucose or A1C with a clinician.');
  } else if (!profile.canMeasureGlucose) {
    advice.push('If possible, ask a clinic or pharmacy about checking fasting glucose or A1C for a clearer risk picture.');
  }

  if (profile.sugaryDrinks !== 'rarely') {
    advice.push('Replace soda, sweet tea, juice, and energy drinks with water or unsweetened tea most days.');
  }

  if (profile.activityLevel === 'low') {
    advice.push('Start with a 10 minute walk after one meal each day, then increase slowly.');
  }

  if (profile.familyHistory || riskLevel === 'High') {
    advice.push('Because your risk factors are stronger, schedule regular screening and ask about a prevention plan.');
  }

  return advice.slice(0, 6);
}
