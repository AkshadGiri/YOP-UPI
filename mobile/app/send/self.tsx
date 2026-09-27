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
import { getApiErrorCode, getApiErrorMessage } from '../../services/api';
import * as paymentService from '../../services/paymentService';
import type { SafeBankAccount } from '../../types/account';
import { colors, radius, spacing, typography } from '../../utils/theme';
import { formatINR } from '../../utils/currency';
import {
  PayPinForm,
  payPinFormSchema,
  SelfTransferSelectForm,
  selfTransferSelectSchema,
} from '../../utils/validation';

type Step = 'select' | 'confirm' | 'pin';

export default function SelfTransferScreen() {
  const [accounts, setAccounts] = useState<SafeBankAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [step, setStep] = useState<Step>('select');
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectForm = useForm<SelfTransferSelectForm>({
    resolver: zodResolver(selfTransferSelectSchema),
    defaultValues: { fromAccountId: '', toAccountId: '', amount: '' },
  });
  const pinForm = useForm<PayPinForm>({
    resolver: zodResolver(payPinFormSchema),
    defaultValues: { pin: '' },
  });

  useEffect(() => {
    accountService
      .listAccounts()
      .then((data) => {
        setAccounts(data);
        const primary = data.find((a) => a.isPrimary);
        if (primary) selectForm.setValue('fromAccountId', primary.id);
      })
      .catch((err) => setErrorMessage(getApiErrorMessage(err)))
      .finally(() => setIsLoadingAccounts(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goBackAStep() {
    setErrorMessage(null);
    if (step === 'confirm') setStep('select');
    else if (step === 'pin') setStep('confirm');
  }

  function onSubmitSelect() {
    setStep('confirm');
  }

  async function onSubmitPin(values: PayPinForm) {
    setErrorMessage(null);
    setIsBusy(true);
    try {
      const { fromAccountId, toAccountId, amount } = selectForm.getValues();
      const result = await paymentService.selfTransfer({
        fromAccountId,
        toAccountId,
        amount,
        pin: values.pin,
      });
      const toAccount = accounts.find((a) => a.id === toAccountId);
      router.replace({
        pathname: '/send/success',
        params: {
          transactionId: result.transactionId,
          amount: result.amount,
          toLabel: toAccount?.bankName ?? 'Your account',
          toSubLabel: toAccount?.maskedAccountNumber ?? '',
          toCaption: 'Transferred to',
          toSubCaption: 'Account',
        },
      });
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
      if (getApiErrorCode(err) === 'INVALID_PIN') {
        pinForm.setValue('pin', '');
      }
    } finally {
      setIsBusy(false);
    }
  }

  const fromId = selectForm.watch('fromAccountId');
  const toId = selectForm.watch('toAccountId');
  const fromAccount = accounts.find((a) => a.id === fromId);
  const toAccount = accounts.find((a) => a.id === toId);

  if (isLoadingAccounts) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (accounts.length < 2) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Self Transfer</Text>
          <Text style={styles.subtitle}>
            You need at least two bank accounts to transfer between them.
          </Text>
          <PrimaryButton label="Add a bank account" onPress={() => router.push('/accounts/add')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => (step === 'select' ? router.back() : goBackAStep())}
            hitSlop={12}
          >
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>

          {step === 'select' && (
            <>
              <Text style={styles.title}>Self Transfer</Text>
              <Text style={styles.subtitle}>Move money between your own bank accounts</Text>

              <Text style={styles.label}>From</Text>
              {accounts.map((account) => (
                <AccountOption
                  key={account.id}
                  account={account}
                  isSelected={account.id === fromId}
                  onPress={() => selectForm.setValue('fromAccountId', account.id)}
                />
              ))}

              <Text style={[styles.label, { marginTop: spacing.md }]}>To</Text>
              {accounts
                .filter((a) => a.id !== fromId)
                .map((account) => (
                  <AccountOption
                    key={account.id}
                    account={account}
                    isSelected={account.id === toId}
                    onPress={() => selectForm.setValue('toAccountId', account.id)}
                  />
                ))}
              {selectForm.formState.errors.toAccountId ? (
                <Text style={styles.fieldError}>
                  {selectForm.formState.errors.toAccountId.message}
                </Text>
              ) : null}

              <TextField
                label="Amount"
                placeholder="0"
                keyboardType="decimal-pad"
                value={selectForm.watch('amount')}
                onChangeText={(t) => selectForm.setValue('amount', t)}
                error={selectForm.formState.errors.amount?.message}
                style={styles.amountInput}
              />

              {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
              <PrimaryButton label="Continue" onPress={selectForm.handleSubmit(onSubmitSelect)} />
            </>
          )}

          {step === 'confirm' && fromAccount && toAccount && (
            <>
              <Text style={styles.title}>Confirm transfer</Text>
              <View style={styles.confirmAmountBlock}>
                <Text style={styles.confirmAmount}>
                  {formatINR(selectForm.getValues('amount'))}
                </Text>
              </View>
              <View style={styles.transferRow}>
                <MiniAccountCard label="From" account={fromAccount} />
                <Text style={styles.arrow}>→</Text>
                <MiniAccountCard label="To" account={toAccount} />
              </View>
              <PrimaryButton label="Proceed to transfer" onPress={() => setStep('pin')} />
            </>
          )}

          {step === 'pin' && (
            <>
              <Text style={styles.title}>Enter UPI PIN</Text>
              <Text style={styles.subtitle}>
                Transferring {formatINR(selectForm.getValues('amount'))}
              </Text>
              <TextField
                label="UPI PIN"
                placeholder="••••"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                value={pinForm.watch('pin')}
                onChangeText={(t) => pinForm.setValue('pin', t)}
                error={pinForm.formState.errors.pin?.message}
              />
              {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
              {isBusy ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
              ) : (
                <PrimaryButton label="Transfer now" onPress={pinForm.handleSubmit(onSubmitPin)} />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AccountOption({
  account,
  isSelected,
  onPress,
}: {
  account: SafeBankAccount;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.accountOption, isSelected && styles.accountOptionSelected]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.accountBankName}>{account.bankName}</Text>
        <Text style={styles.accountNumber}>{account.maskedAccountNumber}</Text>
      </View>
      <Text style={styles.accountBalance}>{formatINR(account.balance)}</Text>
    </Pressable>
  );
}

function MiniAccountCard({ label, account }: { label: string; account: SafeBankAccount }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniCardLabel}>{label}</Text>
      <Text style={styles.miniCardBank}>{account.bankName}</Text>
      <Text style={styles.miniCardNumber}>{account.maskedAccountNumber}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  amountInput: { fontSize: 24, fontWeight: '700', marginTop: spacing.md },
  errorBanner: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontSize: typography.caption.fontSize,
  },
  confirmAmountBlock: { alignItems: 'center', marginVertical: spacing.lg },
  confirmAmount: { fontSize: 40, fontWeight: '700', color: colors.textPrimary },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  arrow: { fontSize: 20, color: colors.textSecondary, marginHorizontal: spacing.sm },
  miniCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  miniCardLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 4 },
  miniCardBank: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  miniCardNumber: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
