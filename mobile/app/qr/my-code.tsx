import { useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TextField } from '../../components/TextField';
import { getApiErrorMessage } from '../../services/api';
import * as qrService from '../../services/qrService';
import type { GeneratedQr } from '../../types/qr';
import { colors, radius, spacing, typography } from '../../utils/theme';
import { formatINR } from '../../utils/currency';
import { QrAmountForm, qrAmountFormSchema } from '../../utils/validation';

const MAX_QR_SIZE = 300;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function MyQrScreen() {
  const { width } = useWindowDimensions();
  // Scale to the screen (small phones, large phones, web) instead of a fixed size.
  const qrSize = Math.min(width - spacing.lg * 4, MAX_QR_SIZE);

  const [qr, setQr] = useState<GeneratedQr | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<QrAmountForm>({
    resolver: zodResolver(qrAmountFormSchema),
    defaultValues: { amount: '' },
  });

  const load = useCallback(async (amount?: string) => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      setQr(await qrService.generateQr(amount));
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start with the static QR (no amount).
  useEffect(() => {
    load();
  }, [load]);

  function onSubmitAmount(values: QrAmountForm) {
    load(values.amount === '' ? undefined : values.amount);
  }

  function onClearAmount() {
    form.setValue('amount', '');
    load();
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
          <Text style={styles.title}>My QR code</Text>
          <Text style={styles.subtitle}>Let others scan this to pay you</Text>

          <View style={styles.qrCard}>
            {isLoading ? (
              <View style={[styles.qrPlaceholder, { width: qrSize, height: qrSize }]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : qr ? (
              <Image
                source={{ uri: qr.qrDataUrl }}
                style={{ width: qrSize, height: qrSize }}
                resizeMode="contain"
                accessibilityLabel={`Payment QR code for ${qr.upiId}`}
              />
            ) : null}

            {qr ? (
              <>
                <Text style={styles.qrName}>{qr.name}</Text>
                <Text style={styles.qrUpiId}>{qr.upiId}</Text>
                {qr.amount ? (
                  <View style={styles.amountBadge}>
                    <Text style={styles.amountBadgeText}>{formatINR(qr.amount)}</Text>
                  </View>
                ) : null}
                <Text style={styles.qrHint}>
                  {qr.expiresAt
                    ? `Valid until ${formatTime(qr.expiresAt)} · amount is fixed`
                    : 'Any amount · does not expire'}
                </Text>
              </>
            ) : null}
          </View>

          {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}

          <Text style={styles.sectionTitle}>Request a specific amount</Text>
          <TextField
            label="Amount (optional)"
            placeholder="Leave blank for any amount"
            keyboardType="decimal-pad"
            value={form.watch('amount')}
            onChangeText={(t) => form.setValue('amount', t)}
            error={form.formState.errors.amount?.message}
          />
          <PrimaryButton
            label="Generate QR"
            loading={isLoading}
            onPress={form.handleSubmit(onSubmitAmount)}
          />
          {qr?.amount ? (
            <Text style={styles.clearLink} onPress={onClearAmount}>
              Remove amount
            </Text>
          ) : null}
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
  qrCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  qrPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  qrName: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.md },
  qrUpiId: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  amountBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  amountBadgeText: { color: colors.white, fontWeight: '700' },
  qrHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  errorBanner: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontSize: typography.caption.fontSize,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  clearLink: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
});
