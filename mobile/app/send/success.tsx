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
 * fetching anything itself, so any payment flow (mobile pay today; self
 * transfer, bank transfer, and QR payment in later phases) can navigate
 * here with the same four params and get the same receipt UI — one
 * implementation, not one per payment type.
 */
export default function PaymentSuccessScreen() {
  const params = useLocalSearchParams<{
    transactionId: string;
    amount: string;
    recipientName: string;
    recipientUpiId: string;
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
          <DetailRow label="Paid to" value={params.recipientName ?? '—'} />
          <DetailRow label="UPI ID" value={params.recipientUpiId ?? '—'} />
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
