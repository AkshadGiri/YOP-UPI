import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { getApiErrorMessage } from '../services/api';
import * as authService from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../utils/theme';
import { LoginForm, loginSchema } from '../utils/validation';

export default function LoginScreen() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  async function onSubmit(values: LoginForm) {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await authService.login(values.identifier, values.password);
      setSession(result.user, result);
      router.replace(result.user.pinSet ? '/home' : '/set-pin');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to your demo UPI account</Text>

          <View style={styles.form}>
            <TextField
              label="Phone or email"
              placeholder="9876543210 or you@example.com"
              autoCapitalize="none"
              value={form.watch('identifier')}
              onChangeText={(t) => form.setValue('identifier', t)}
              error={form.formState.errors.identifier?.message}
            />
            <TextField
              label="Password"
              placeholder="Your password"
              secureTextEntry
              value={form.watch('password')}
              onChangeText={(t) => form.setValue('password', t)}
              error={form.formState.errors.password?.message}
            />
            {submitError ? <Text style={styles.errorBanner}>{submitError}</Text> : null}
            <PrimaryButton
              label="Log in"
              loading={isSubmitting}
              onPress={form.handleSubmit(onSubmit)}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New here? </Text>
            <Link href="/signup" style={styles.footerLink}>
              Create an account
            </Link>
          </View>

          <Text style={styles.demoHint}>
            Demo login: phone 9876543210 (Akshad), password Demo@1234
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  form: {},
  errorBanner: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontSize: typography.caption.fontSize,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textSecondary },
  footerLink: { color: colors.primary, fontWeight: '600' },
  demoHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
