import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TextField } from '../../components/TextField';
import * as accountService from '../../services/accountService';
import { getApiErrorMessage } from '../../services/api';
import * as walletService from '../../services/walletService';
import type { SafeBankAccount } from '../../types/account';
import { colors, radius, spacing, typography } from '../../utils/theme';
import { formatINR } from '../../utils/currency';
import { AddMoneyForm, addMoneyFormSchema } from '../../utils/validation';

export default function AddMoneyScreen() {
  const [accounts, setAccounts] = useState<SafeBankAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddMoneyForm>({
    resolver: zodResolver(addMoneyFormSchema),
    defaultValues: { bankAccountId: '', amount: '' },
  });

  useEffect(() => {
    accountService
      .listAccounts()
      .then((data) => {
        setAccounts(data);
        const primary = data.find((a) => a.isPrimary) ?? data[0];
        if (primary) form.setValue('bankAccountId', primary.id);
      })
      .catch((err) => setErrorMessage(getApiErrorMessage(err)))
      .finally(() => setIsLoadingAccounts(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(values: AddMoneyForm) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await walletService.addMoney({
        bankAccountId: values.bankAccountId,
        amount: Number(values.amount),
      });
      router.back();
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedId = form.watch('bankAccountId');

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
          <Text style={styles.title}>Add money</Text>
          <Text style={styles.subtitle}>Top up your wallet from a linked bank account</Text>

          {isLoadingAccounts ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : accounts.length === 0 ? (
            <View>
              <Text style={styles.errorBanner}>
                You don&apos;t have any bank accounts linked yet.
              </Text>
              <PrimaryButton
                label="Add a bank account"
                onPress={() => router.replace('/accounts/add')}
              />
            </View>
          ) : (
            <>
              <Text style={styles.label}>From account</Text>
              {accounts.map((account) => {
                const isSelected = account.id === selectedId;
                return (
                  <Pressable
                    key={account.id}
                    style={[styles.accountOption, isSelected && styles.accountOptionSelected]}
                    onPress={() => form.setValue('bankAccountId', account.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accountBankName}>{account.bankName}</Text>
                      <Text style={styles.accountNumber}>{account.maskedAccountNumber}</Text>
                    </View>
                    <Text style={styles.accountBalance}>{formatINR(account.balance)}</Text>
                  </Pressable>
                );
              })}
              {form.formState.errors.bankAccountId ? (
                <Text style={styles.fieldError}>{form.formState.errors.bankAccountId.message}</Text>
              ) : null}

              <TextField
                label="Amount"
                placeholder="0"
                keyboardType="decimal-pad"
                value={form.watch('amount')}
                onChangeText={(t) => form.setValue('amount', t)}
                error={form.formState.errors.amount?.message}
                style={styles.amountInput}
              />

              {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
              <PrimaryButton
                label="Add money"
                loading={isSubmitting}
                onPress={form.handleSubmit(onSubmit)}
              />
            </>
          )}
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
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  accountOptionSelected: { borderColor: colors.primary },
  accountBankName: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  accountNumber: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  accountBalance: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  fieldError: {
    color: colors.danger,
    fontSize: typography.caption.fontSize,
    marginBottom: spacing.md,
  },
  amountInput: { fontSize: 24, fontWeight: '700' },
  errorBanner: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontSize: typography.caption.fontSize,
  },
});
