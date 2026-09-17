import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { getApiErrorMessage } from '../services/api';
import * as authService from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../utils/theme';
import { SetPinForm, setPinFormSchema } from '../utils/validation';

export default function SetPinScreen() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const form = useForm<SetPinForm>({
    resolver: zodResolver(setPinFormSchema),
    defaultValues: { pin: '', confirmPin: '' },
  });

  async function onSubmit(values: SetPinForm) {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await authService.setPin(values.pin);
      if (user) setUser({ ...user, pinSet: true });
      router.replace('/home');
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
        <View style={styles.container}>
          <Text style={styles.title}>Set your UPI PIN</Text>
          <Text style={styles.subtitle}>
            You&apos;ll use this 4-digit PIN to authorize every payment. Keep it secret.
          </Text>

          <TextField
            label="New PIN"
            placeholder="••••"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            value={form.watch('pin')}
            onChangeText={(t) => form.setValue('pin', t)}
            error={form.formState.errors.pin?.message}
          />
          <TextField
            label="Confirm PIN"
            placeholder="••••"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            value={form.watch('confirmPin')}
            onChangeText={(t) => form.setValue('confirmPin', t)}
            error={form.formState.errors.confirmPin?.message}
          />
          {submitError ? <Text style={styles.errorBanner}>{submitError}</Text> : null}
          <PrimaryButton
            label="Set PIN"
            loading={isSubmitting}
            onPress={form.handleSubmit(onSubmit)}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  errorBanner: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontSize: typography.caption.fontSize,
  },
});
