import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccentPalette } from '@/lib/app-preferences';
import { useAuth } from '@/lib/auth-context';

type AuthMode = 'sign-in' | 'sign-up';

export default function AccountScreen() {
  const accent = useAccentPalette();
  const isDark = useColorScheme() === 'dark';
  const { isConfigured, isLoading, signIn, signInWithGoogle, signOut, signUp, user } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignedIn = Boolean(user);

  async function handleSubmit() {
    const normalizedEmail = email.trim();

    setError('');
    setMessage('');

    if (!normalizedEmail || password.length < 6) {
      setError('Enter an email and a password with at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'sign-in') {
        await signIn(normalizedEmail, password);
        router.back();
      } else {
        const result = await signUp(normalizedEmail, password);
        setMessage(
          result.needsEmailConfirmation
            ? 'Check your email to confirm your account, then sign in.'
            : 'Account created. You are signed in.'
        );
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Google sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      await signOut();
      setMessage('Signed out.');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Sign-out failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={[styles.iconButton, isDark && styles.iconButtonDark]}>
              <IconSymbol color={isDark ? BrandColors.darkInputText : BrandColors.lightInputText} name="chevron.left" size={22} />
            </Pressable>
          </View>

          <View style={styles.header}>
            <ThemedText type="title">Account</ThemedText>
            <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
              Sign in to sync Diabeto data with your Supabase account.
            </ThemedText>
          </View>

          {!isConfigured ? (
            <View style={[styles.panel, isDark && styles.panelDark]}>
              <ThemedText type="subtitle">Supabase setup needed</ThemedText>
              <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
                Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local`, then restart Expo.
              </ThemedText>
            </View>
          ) : isLoading ? (
            <View style={[styles.panel, styles.loadingPanel, isDark && styles.panelDark]}>
              <ActivityIndicator color={accent.primary} />
            </View>
          ) : isSignedIn ? (
            <View style={[styles.panel, isDark && styles.panelDark]}>
              <ThemedText type="subtitle">Signed in</ThemedText>
              <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
                {user?.email}
              </ThemedText>
              {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
              {message ? <ThemedText style={[styles.messageText, isDark && styles.messageTextDark]}>{message}</ThemedText> : null}
              <Pressable
                disabled={isSubmitting}
                onPress={handleSignOut}
                style={[styles.primaryButton, { backgroundColor: accent.primary }, isSubmitting && styles.disabledButton]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Sign out</ThemedText>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={[styles.panel, isDark && styles.panelDark]}>
              <View style={[styles.segmented, isDark && styles.segmentedDark]}>
                {(['sign-in', 'sign-up'] as AuthMode[]).map((option) => {
                  const selected = option === mode;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setMode(option);
                        setError('');
                        setMessage('');
                      }}
                      style={[styles.segment, selected && { backgroundColor: accent.primary }]}>
                      <ThemedText
                        style={[
                          styles.segmentText,
                          isDark && styles.segmentTextDark,
                          selected && styles.segmentTextActive,
                        ]}>
                        {option === 'sign-in' ? 'Sign in' : 'Create account'}
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
                  placeholder="Email"
                  placeholderTextColor={isDark ? '#8faec5' : '#7890a1'}
                  style={[styles.input, isDark && styles.inputDark]}
                  value={email}
                />
              </View>

              <View style={[styles.inputWrap, isDark && styles.inputWrapDark]}>
                <TextInput
                  autoCapitalize="none"
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  onChangeText={setPassword}
                  placeholder="Password"
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
                onPress={handleSubmit}
                style={[styles.primaryButton, { backgroundColor: accent.primary }, isSubmitting && styles.disabledButton]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>
                    {mode === 'sign-in' ? 'Sign in' : 'Create account'}
                  </ThemedText>
                )}
              </Pressable>

              <Pressable
                disabled={isSubmitting}
                onPress={handleGoogleSignIn}
                style={[styles.googleButton, isDark && styles.googleButtonDark, isSubmitting && styles.disabledButton]}>
                <ThemedText style={[styles.googleButtonText, isDark && styles.googleButtonTextDark]}>
                  Sign in with Google
                </ThemedText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: Layout.tabBarContentInset,
    paddingTop: 58,
  },
  topBar: {
    alignItems: 'flex-start',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconButtonDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    color: BrandColors.lightMutedText,
  },
  mutedDark: {
    color: BrandColors.darkMutedText,
  },
  panel: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  panelDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  loadingPanel: {
    alignItems: 'center',
    minHeight: 130,
    justifyContent: 'center',
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
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 8,
  },
  segmentText: {
    color: BrandColors.lightInputText,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  segmentTextDark: {
    color: BrandColors.darkInputText,
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  inputWrap: {
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
  },
  inputWrapDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  input: {
    color: BrandColors.lightInputText,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  inputDark: {
    color: BrandColors.darkInputText,
  },
  errorText: {
    color: '#cc2f45',
    fontSize: 14,
    fontWeight: '800',
  },
  messageText: {
    color: BrandColors.lightInputText,
    fontSize: 14,
    fontWeight: '800',
  },
  messageTextDark: {
    color: BrandColors.darkInputText,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  googleButtonDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
  },
  googleButtonText: {
    color: BrandColors.lightInputText,
    fontWeight: '900',
  },
  googleButtonTextDark: {
    color: BrandColors.darkInputText,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
});
