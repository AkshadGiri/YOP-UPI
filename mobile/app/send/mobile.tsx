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
import { Avatar } from '../../components/Avatar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TextField } from '../../components/TextField';
import { getApiErrorCode, getApiErrorMessage } from '../../services/api';
import * as paymentService from '../../services/paymentService';
import type { RecipientPreview } from '../../types/payment';
import { colors, radius, spacing, typography } from '../../utils/theme';
import { formatINR } from '../../utils/currency';
import {
  MobileNumberForm,
  mobileNumberFormSchema,
  PayAmountForm,
  payAmountFormSchema,
  PayPinForm,
  payPinFormSchema,
} from '../../utils/validation';

type Step = 'phone' | 'amount' | 'confirm' | 'pin';

export default function PayByMobileScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mobile, setMobile] = useState('');
  const [recipient, setRecipient] = useState<RecipientPreview | null>(null);
  const [amount, setAmount] = useState('');

  const phoneForm = useForm<MobileNumberForm>({
    resolver: zodResolver(mobileNumberFormSchema),
    defaultValues: { mobile: '' },
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
    if (step === 'amount') setStep('phone');
    else if (step === 'confirm') setStep('amount');
    else if (step === 'pin') setStep('confirm');
  }

  async function onSubmitPhone(values: MobileNumberForm) {
    setErrorMessage(null);
    setIsBusy(true);
    try {
      const found = await paymentService.resolveMobileRecipient(values.mobile);
      setMobile(values.mobile);
      setRecipient(found);
      setStep('amount');
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }

  function onSubmitAmount(values: PayAmountForm) {
    setAmount(values.amount);
    setStep('confirm');
  }

  async function onSubmitPin(values: PayPinForm) {
    setErrorMessage(null);
    setIsBusy(true);
    try {
      const result = await paymentService.payByMobile({ mobile, amount, pin: values.pin });
      router.replace({
        pathname: '/send/success',
        params: {
          transactionId: result.transactionId,
          amount: result.amount,
          recipientName: result.recipient.name,
          recipientUpiId: result.recipient.upiId,
        },
      });
    } catch (err) {
      const code = getApiErrorCode(err);
      // A wrong PIN should let the user try again without losing their
      // place in the flow; anything else (insufficient balance, recipient
      // no longer payable, etc.) also surfaces inline for the same reason.
      setErrorMessage(getApiErrorMessage(err));
      if (code === 'INVALID_PIN') {
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
            onPress={() => (step === 'phone' ? router.back() : goBackAStep())}
            hitSlop={12}
          >
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>

          {step === 'phone' && (
            <>
              <Text style={styles.title}>Send to mobile number</Text>
              <Text style={styles.subtitle}>
                Enter the recipient&apos;s registered mobile number
              </Text>
              <TextField
                label="Mobile number"
                placeholder="9876543210"
                keyboardType="number-pad"
                maxLength={10}
                value={phoneForm.watch('mobile')}
                onChangeText={(t) => phoneForm.setValue('mobile', t)}
                error={phoneForm.formState.errors.mobile?.message}
              />
              {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
              <PrimaryButton
                label="Find recipient"
                loading={isBusy}
                onPress={phoneForm.handleSubmit(onSubmitPhone)}
              />
            </>
          )}

          {step === 'amount' && recipient && (
            <>
              <Text style={styles.title}>Enter amount</Text>
              <RecipientCard recipient={recipient} mobile={mobile} />
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

          {step === 'confirm' && recipient && (
            <>
              <Text style={styles.title}>Confirm payment</Text>
              <View style={styles.confirmAmountBlock}>
                <Text style={styles.confirmAmount}>{formatINR(amount)}</Text>
                <Text style={styles.confirmToLabel}>to</Text>
              </View>
              <RecipientCard recipient={recipient} mobile={mobile} />
              <PrimaryButton label="Proceed to pay" onPress={() => setStep('pin')} />
            </>
          )}

          {step === 'pin' && recipient && (
            <>
              <Text style={styles.title}>Enter UPI PIN</Text>
              <Text style={styles.subtitle}>
                Paying {formatINR(amount)} to {recipient.name}
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

function RecipientCard({ recipient, mobile }: { recipient: RecipientPreview; mobile: string }) {
  return (
    <View style={styles.recipientCard}>
      <Avatar name={recipient.name} uri={recipient.profilePictureUrl} size={48} />
      <View style={{ marginLeft: spacing.md }}>
        <Text style={styles.recipientName}>{recipient.name}</Text>
        <Text style={styles.recipientMeta}>{recipient.upiId}</Text>
        <Text style={styles.recipientMeta}>{mobile}</Text>
      </View>
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
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginVertical: spacing.lg,
  },
  recipientName: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  recipientMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  confirmAmountBlock: { alignItems: 'center', marginTop: spacing.lg },
  confirmAmount: { fontSize: 40, fontWeight: '700', color: colors.textPrimary },
  confirmToLabel: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
});
