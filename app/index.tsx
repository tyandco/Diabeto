import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { BrandColors } from '@/constants/theme';
import { hasCompletedOnboarding } from '@/lib/onboarding-status';

export default function IndexScreen() {
  const [completedOnboarding, setCompletedOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    hasCompletedOnboarding()
      .then(setCompletedOnboarding)
      .catch(() => setCompletedOnboarding(false));
  }, []);

  if (completedOnboarding === null) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator color={BrandColors.primary} />
      </ThemedView>
    );
  }

  return <Redirect href={completedOnboarding ? '/(tabs)' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
