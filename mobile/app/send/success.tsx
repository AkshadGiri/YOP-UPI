import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, radius, spacing, typography } from '../../utils/theme';
import { formatINR } from '../../utils/currency';
import { formatDate } from '../../utils/date';

/**
 * Generic payment receipt screen (Section 18 of the spec: "Payment
 * Successful" state). Reads its content from route params rather than
 * fetching anything itself, so any payment flow can navigate here and get
 * the same receipt UI — one implementation, not one per payment type.
 *
 * Params are deliberately generic (`toLabel`/`toSubLabel`), not
 * P2P-specific (`recipientName`/`recipientUpiId`): mobile pay passes the
 * recipient's name and UPI ID, self transfer passes the destination
 * account's bank name and masked number, and later bank transfer/QR
 * payment will do the same with their own values — the screen doesn't
 * need to know which.
 */
export default function PaymentSuccessScreen() {
  const params = useLocalSearchParams<{
    transactionId: string;
    amount: string;
    toLabel: string;
    toSubLabel: string;
    toCaption?: string;
    toSubCaption?: string;
  }>();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.title}>Payment Successful</Text>
        <Text style={styles.amount}>{formatINR(params.amount ?? '0')}</Text>

        <View style={styles.detailsCard}>
          <DetailRow label={params.toCaption ?? 'Paid to'} value={params.toLabel ?? '—'} />
          <DetailRow label={params.toSubCaption ?? 'UPI ID'} value={params.toSubLabel ?? '—'} />
          <DetailRow label="Transaction ID" value={params.transactionId ?? '—'} />
          <DetailRow label="Date" value={formatDate(new Date().toISOString())} />
        </View>

        <PrimaryButton label="Done" onPress={() => router.replace('/home')} />
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', alignItems: 'center' },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  checkMark: { color: colors.white, fontSize: 36, fontWeight: '700' },
  title: { ...typography.h1, color: colors.textPrimary },
  amount: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  detailLabel: { ...typography.caption, color: colors.textSecondary },
  detailValue: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
});
