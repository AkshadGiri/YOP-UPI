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
import {
  OtpCodeForm,
  otpCodeSchema,
  SignupDetailsForm,
  signupDetailsSchema,
} from '../utils/validation';

type Step = 'details' | 'otp';

export default function SignupScreen() {
  const [step, setStep] = useState<Step>('details');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [details, setDetails] = useState<SignupDetailsForm | null>(null);
  const setSession = useAuthStore((s) => s.setSession);

  const detailsForm = useForm<SignupDetailsForm>({
    resolver: zodResolver(signupDetailsSchema),
    defaultValues: { name: '', phone: '', email: '', password: '' },
  });

  const otpForm = useForm<OtpCodeForm>({
    resolver: zodResolver(otpCodeSchema),
    defaultValues: { code: '' },
  });

  async function onSubmitDetails(values: SignupDetailsForm) {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await authService.requestOtp(values.phone, 'SIGNUP');
      setDetails(values);
      setStep('otp');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmitOtp(values: OtpCodeForm) {
    if (!details) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const { otpTicket } = await authService.verifyOtp(details.phone, 'SIGNUP', values.code);
      const result = await authService.signup({ ...details, otpTicket });
      setSession(result.user, result);
      router.replace('/set-pin');
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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            {step === 'details'
              ? 'Set up your demo UPI identity in a minute'
              : `Enter the 6-digit code sent to ${details?.phone}`}
          </Text>

          {step === 'details' ? (
            <View style={styles.form}>
              <TextField
                label="Full name"
                placeholder="Akshad Patil"
                autoCapitalize="words"
                value={detailsForm.watch('name')}
                onChangeText={(t) => detailsForm.setValue('name', t)}
                error={detailsForm.formState.errors.name?.message}
              />
              <TextField
                label="Mobile number"
                placeholder="9876543210"
                keyboardType="number-pad"
                maxLength={10}
                value={detailsForm.watch('phone')}
                onChangeText={(t) => detailsForm.setValue('phone', t)}
                error={detailsForm.formState.errors.phone?.message}
              />
              <TextField
                label="Email"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={detailsForm.watch('email')}
                onChangeText={(t) => detailsForm.setValue('email', t)}
                error={detailsForm.formState.errors.email?.message}
              />
              <TextField
                label="Password"
                placeholder="At least 8 characters"
                secureTextEntry
                value={detailsForm.watch('password')}
                onChangeText={(t) => detailsForm.setValue('password', t)}
                error={detailsForm.formState.errors.password?.message}
              />
              {submitError ? <Text style={styles.errorBanner}>{submitError}</Text> : null}
              <PrimaryButton
                label="Send OTP"
                loading={isSubmitting}
                onPress={detailsForm.handleSubmit(onSubmitDetails)}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.mockOtpHint}>Development mode: use code 123456</Text>
              <TextField
                label="OTP code"
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                value={otpForm.watch('code')}
                onChangeText={(t) => otpForm.setValue('code', t)}
                error={otpForm.formState.errors.code?.message}
              />
              {submitError ? <Text style={styles.errorBanner}>{submitError}</Text> : null}
              <PrimaryButton
                label="Verify & create account"
                loading={isSubmitting}
                onPress={otpForm.handleSubmit(onSubmitOtp)}
              />
              <Text style={styles.linkText} onPress={() => setStep('details')}>
                ← Edit details
              </Text>
            </View>
          )}

          {step === 'details' ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/login" style={styles.footerLink}>
                Log in
              </Link>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, flexGrow: 1 },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.md },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  form: { gap: 0 },
  mockOtpHint: {
    ...typography.caption,
    color: colors.primary,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  errorBanner: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontSize: typography.caption.fontSize,
  },
  linkText: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: { color: colors.textSecondary },
  footerLink: { color: colors.primary, fontWeight: '600' },
});
