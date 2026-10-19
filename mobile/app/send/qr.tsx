import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, radius, shadow, spacing, typography } from '../../utils/theme';
import { formatINR } from '../../utils/currency';
import { getApiErrorCode, getApiErrorMessage } from '../../services/api';
import * as qrService from '../../services/qrService';

type Step = 'confirm' | 'pin';

export default function QrPayScreen() {
  const params = useLocalSearchParams<{
    uri: string;
    name: string;
    upiId: string;
    amount: string;
  }>();

  const isStaticQr = !params.amount;
  const [step, setStep] = useState<Step>('confirm');
  const [amount, setAmount] = useState(params.amount ?? '');
  const [pin, setPin] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    if (isStaticQr && (!amount || Number(amount) <= 0)) {
      setError('Enter a valid amount');
      return;
    }
    setError(null);
    setStep('pin');
  }

  async function onPay() {
    if (!pin || pin.length !== 4) {
      setError('Enter your 4-digit UPI PIN');
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      const result = await qrService.payByQr({
        uri: params.uri,
        amount: isStaticQr ? amount : undefined,
        pin,
      });
      router.replace({
        pathname: '/send/success',
        params: {
          transactionId: result.transactionId,
          amount: result.amount,
          toLabel: result.recipient.name,
          toSubLabel: result.recipient.upiId,
        },
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
      if (getApiErrorCode(err) === 'INVALID_PIN') {
        setPin('');
      }
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => (step === 'pin' ? setStep('confirm') : router.back())}
            hitSlop={12}
          >
            <Text style={styles.back}>←</Text>
          </Pressable>

          <Text style={styles.title}>QR Payment</Text>

          {/* Recipient Card */}
          <View style={styles.recipientCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>
                {(params.name ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.recipientName}>{params.name}</Text>
            <Text style={styles.recipientUpi}>{params.upiId}</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {step === 'confirm' && (
            <>
              {isStaticQr ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Enter Amount</Text>
                  <View style={styles.amountInputRow}>
                    <Text style={styles.rupeePrefix}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.amountDisplay}>
                  <Text style={styles.amountLabel}>Amount</Text>
                  <Text style={styles.amountValue}>{formatINR(params.amount)}</Text>
                  <Text style={styles.amountNote}>Amount is fixed by the QR code</Text>
                </View>
              )}
              <PrimaryButton label="Continue" onPress={onConfirm} />
            </>
          )}

          {step === 'pin' && (
            <>
              <View style={styles.confirmSummary}>
                <Text style={styles.confirmLabel}>Paying</Text>
                <Text style={styles.confirmAmount}>{formatINR(amount)}</Text>
                <Text style={styles.confirmTo}>to {params.name}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Enter UPI PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={pin}
                  onChangeText={setPin}
                  placeholder="••••"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>

              <PrimaryButton label="Pay Now" onPress={onPay} loading={isBusy} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  back: { fontSize: 24, color: colors.textPrimary, marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.textPrimary },

  recipientCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { ...typography.h1, color: colors.primary },
  recipientName: { ...typography.h3, color: colors.textPrimary },
  recipientUpi: { ...typography.caption, color: colors.textSecondary },

  amountDisplay: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadow.sm,
  },
  amountLabel: { ...typography.caption, color: colors.textSecondary },
  amountValue: { ...typography.amountLarge, color: colors.textPrimary },
  amountNote: { ...typography.caption, color: colors.textTertiary },

  confirmSummary: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  confirmLabel: { ...typography.caption, color: colors.textSecondary },
  confirmAmount: { ...typography.amount, color: colors.primary },
  confirmTo: { ...typography.caption, color: colors.textSecondary },

  inputGroup: { gap: spacing.xs },
  inputLabel: { ...typography.captionMedium, color: colors.textSecondary },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  rupeePrefix: { ...typography.h2, color: colors.textSecondary, marginRight: spacing.xs },
  amountInput: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.h2,
    color: colors.textPrimary,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 8,
  },

  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { ...typography.caption, color: colors.danger },
});
