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
import { colors, radius, spacing, typography } from '../utils/theme';
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoLetter}>Y</Text>
            </View>
            <Text style={styles.logoText}>YOP Pay</Text>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.title}>Welcome back 👋</Text>
            <Text style={styles.subtitle}>Log in to your demo UPI account</Text>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <TextField
              label="Phone or Email"
              placeholder="9876543210 or you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
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

            {submitError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {submitError}</Text>
              </View>
            ) : null}

            <PrimaryButton
              label="Log in"
              loading={isSubmitting}
              onPress={form.handleSubmit(onSubmit)}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>New here? </Text>
              <Link href="/signup" style={styles.footerLink}>
                Create an account
              </Link>
            </View>
          </View>

          {/* Demo hint */}
          <View style={styles.demoBox}>
            <Text style={styles.demoLabel}>DEMO CREDENTIALS</Text>
            <Text style={styles.demoText}>📱 9876543210 (Akshad)</Text>
            <Text style={styles.demoText}>🔑 Demo@1234 · PIN: 1234</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.lg },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { fontSize: 20, fontWeight: '800', color: colors.background },
  logoText: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },

  hero: { gap: spacing.xs },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },

  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },

  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: { ...typography.caption, color: colors.danger },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md },
  footerText: { ...typography.body, color: colors.textSecondary },
  footerLink: { ...typography.bodyMedium, color: colors.primary },

  demoBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  demoLabel: { fontSize: 10, fontWeight: '700', color: colors.textTertiary, letterSpacing: 1 },
  demoText: { ...typography.caption, color: colors.textSecondary },
});
