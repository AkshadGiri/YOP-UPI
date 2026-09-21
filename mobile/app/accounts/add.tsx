import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TextField } from '../../components/TextField';
import * as accountService from '../../services/accountService';
import { getApiErrorMessage } from '../../services/api';
import { colors, spacing, typography } from '../../utils/theme';
import { AddAccountForm, addAccountFormSchema } from '../../utils/validation';

export default function AddAccountScreen() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddAccountForm>({
    resolver: zodResolver(addAccountFormSchema),
    defaultValues: {
      bankName: '',
      accountHolderName: '',
      accountNumber: '',
      confirmAccountNumber: '',
      ifsc: '',
    },
  });

  async function onSubmit(values: AddAccountForm) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await accountService.addAccount({
        bankName: values.bankName,
        accountHolderName: values.accountHolderName,
        accountNumber: values.accountNumber,
        ifsc: values.ifsc,
      });
      router.back();
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
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
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Add bank account</Text>
          <Text style={styles.subtitle}>
            This is a demo account — no real bank is contacted. Balances are simulated.
          </Text>

          <TextField
            label="Bank name"
            placeholder="HDFC Bank"
            autoCapitalize="words"
            value={form.watch('bankName')}
            onChangeText={(t) => form.setValue('bankName', t)}
            error={form.formState.errors.bankName?.message}
          />
          <TextField
            label="Account holder name"
            placeholder="As per bank records"
            autoCapitalize="words"
            value={form.watch('accountHolderName')}
            onChangeText={(t) => form.setValue('accountHolderName', t)}
            error={form.formState.errors.accountHolderName?.message}
          />
          <TextField
            label="Account number"
            placeholder="e.g. 50100112340001"
            keyboardType="number-pad"
            value={form.watch('accountNumber')}
            onChangeText={(t) => form.setValue('accountNumber', t)}
            error={form.formState.errors.accountNumber?.message}
          />
          <TextField
            label="Confirm account number"
            placeholder="Re-enter account number"
            keyboardType="number-pad"
            value={form.watch('confirmAccountNumber')}
            onChangeText={(t) => form.setValue('confirmAccountNumber', t)}
            error={form.formState.errors.confirmAccountNumber?.message}
          />
          <TextField
            label="IFSC code"
            placeholder="HDFC0001234"
            autoCapitalize="characters"
            maxLength={11}
            value={form.watch('ifsc')}
            onChangeText={(t) => form.setValue('ifsc', t.toUpperCase())}
            error={form.formState.errors.ifsc?.message}
          />

          {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
          <PrimaryButton
            label="Add account"
            loading={isSubmitting}
            onPress={form.handleSubmit(onSubmit)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, flexGrow: 1 },
  backLink: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontSize: typography.caption.fontSize,
  },
});
