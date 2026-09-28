import { useState } from 'react';
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
import { getApiErrorCode, getApiErrorMessage } from '../../services/api';
import * as paymentService from '../../services/paymentService';
import { colors, radius, spacing, typography } from '../../utils/theme';
import { formatINR } from '../../utils/currency';
import {
  BankTransferDetailsForm,
  bankTransferDetailsSchema,
  PayAmountForm,
  payAmountFormSchema,
  PayPinForm,
  payPinFormSchema,
} from '../../utils/validation';

type Step = 'details' | 'amount' | 'confirm' | 'pin';

export default function BankTransferScreen() {
  const [step, setStep] = useState<Step>('details');
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [details, setDetails] = useState<BankTransferDetailsForm | null>(null);
  const [amount, setAmount] = useState('');

  const detailsForm = useForm<BankTransferDetailsForm>({
    resolver: zodResolver(bankTransferDetailsSchema),
    defaultValues: { accountNumber: '', confirmAccountNumber: '', ifsc: '', accountHolderName: '' },
  });
  const amountForm = useForm<PayAmountForm>({
    resolver: zodResolver(payAmountFormSchema),
    defaultValues: { amount: '' },
  });
  const pinForm = useForm<PayPinForm>({
    resolver: zodResolver(payPinFormSchema),
    defaultValues: { pin: '' },
  });

  function goBackAStep() {
    setErrorMessage(null);
    if (step === 'amount') setStep('details');
    else if (step === 'confirm') setStep('amount');
    else if (step === 'pin') setStep('confirm');
  }

  function onSubmitDetails(values: BankTransferDetailsForm) {
    setDetails(values);
    setStep('amount');
  }

  function onSubmitAmount(values: PayAmountForm) {
    setAmount(values.amount);
    setStep('confirm');
  }

  async function onSubmitPin(values: PayPinForm) {
    if (!details) return;
    setErrorMessage(null);
    setIsBusy(true);
    try {
      const result = await paymentService.bankTransfer({
        accountNumber: details.accountNumber,
        ifsc: details.ifsc,
        accountHolderName: details.accountHolderName,
        amount,
        pin: values.pin,
      });
      router.replace({
        pathname: '/send/success',
        params: {
          transactionId: result.transactionId,
          amount: result.amount,
          toLabel: result.destination.accountHolderName,
          toSubLabel: result.destination.maskedAccountNumber,
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => (step === 'details' ? router.back() : goBackAStep())}
            hitSlop={12}
          >
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>

          {step === 'details' && (
            <>
              <Text style={styles.title}>Bank transfer</Text>
              <Text style={styles.subtitle}>
                Transfer to any bank account by account number and IFSC
              </Text>
              <TextField
                label="Account number"
                placeholder="e.g. 50100112340001"
                keyboardType="number-pad"
                value={detailsForm.watch('accountNumber')}
                onChangeText={(t) => detailsForm.setValue('accountNumber', t)}
                error={detailsForm.formState.errors.accountNumber?.message}
              />
              <TextField
                label="Confirm account number"
                placeholder="Re-enter account number"
                keyboardType="number-pad"
                value={detailsForm.watch('confirmAccountNumber')}
                onChangeText={(t) => detailsForm.setValue('confirmAccountNumber', t)}
                error={detailsForm.formState.errors.confirmAccountNumber?.message}
              />
              <TextField
                label="IFSC code"
                placeholder="HDFC0001234"
                autoCapitalize="characters"
                maxLength={11}
                value={detailsForm.watch('ifsc')}
                onChangeText={(t) => detailsForm.setValue('ifsc', t.toUpperCase())}
                error={detailsForm.formState.errors.ifsc?.message}
              />
              <TextField
                label="Account holder name"
                placeholder="As per bank records"
                autoCapitalize="words"
                value={detailsForm.watch('accountHolderName')}
                onChangeText={(t) => detailsForm.setValue('accountHolderName', t)}
                error={detailsForm.formState.errors.accountHolderName?.message}
              />
              {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
              <PrimaryButton label="Continue" onPress={detailsForm.handleSubmit(onSubmitDetails)} />
            </>
          )}

          {step === 'amount' && details && (
            <>
              <Text style={styles.title}>Enter amount</Text>
              <DestinationCard details={details} />
              <TextField
                label="Amount"
                placeholder="0"
                keyboardType="decimal-pad"
                value={amountForm.watch('amount')}
                onChangeText={(t) => amountForm.setValue('amount', t)}
                error={amountForm.formState.errors.amount?.message}
                style={styles.amountInput}
              />
              <PrimaryButton label="Continue" onPress={amountForm.handleSubmit(onSubmitAmount)} />
            </>
          )}

          {step === 'confirm' && details && (
            <>
              <Text style={styles.title}>Confirm transfer</Text>
              <View style={styles.confirmAmountBlock}>
                <Text style={styles.confirmAmount}>{formatINR(amount)}</Text>
                <Text style={styles.confirmToLabel}>to</Text>
              </View>
              <DestinationCard details={details} />
              <PrimaryButton label="Proceed to pay" onPress={() => setStep('pin')} />
            </>
          )}

          {step === 'pin' && details && (
            <>
              <Text style={styles.title}>Enter UPI PIN</Text>
              <Text style={styles.subtitle}>
                Transferring {formatINR(amount)} to {details.accountHolderName}
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
                <PrimaryButton label="Pay now" onPress={pinForm.handleSubmit(onSubmitPin)} />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DestinationCard({ details }: { details: BankTransferDetailsForm }) {
  return (
    <View style={styles.destinationCard}>
      <Text style={styles.destinationName}>{details.accountHolderName}</Text>
      <Text style={styles.destinationMeta}>{details.accountNumber}</Text>
      <Text style={styles.destinationMeta}>{details.ifsc}</Text>
    </View>
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
  amountInput: { fontSize: 24, fontWeight: '700' },
  destinationCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginVertical: spacing.lg,
  },
  destinationName: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  destinationMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  confirmAmountBlock: { alignItems: 'center', marginTop: spacing.lg },
  confirmAmount: { fontSize: 40, fontWeight: '700', color: colors.textPrimary },
  confirmToLabel: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
});
