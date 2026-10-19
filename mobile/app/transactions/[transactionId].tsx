import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as transactionService from '../../services/transactionService';
import { colors, radius, shadow, spacing, typography } from '../../utils/theme';
import { formatINR } from '../../utils/currency';
import { formatDate, formatDateTime } from '../../utils/date';

export default function TransactionDetailScreen() {
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  const [txn, setTxn] = useState<transactionService.TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) return;
    transactionService
      .getTransactionDetail(transactionId)
      .then(setTxn)
      .catch(() => setError('Transaction not found'))
      .finally(() => setLoading(false));
  }, [transactionId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !txn) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error ?? 'Something went wrong'}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isSuccess = txn.status === 'SUCCESS';
  const isFailed = txn.status === 'FAILED';
  const statusColor = isSuccess ? colors.success : isFailed ? colors.danger : colors.warning;
  const statusBg = isSuccess
    ? colors.successLight
    : isFailed
      ? colors.dangerLight
      : colors.warningLight;
  const amountColor =
    txn.direction === 'CREDIT'
      ? colors.credit
      : txn.direction === 'SELF'
        ? colors.self
        : colors.debit;
  const amountPrefix = txn.direction === 'CREDIT' ? '+' : txn.direction === 'SELF' ? '↔ ' : '-';

  const counterparty =
    txn.direction === 'CREDIT' ? txn.sender : txn.direction === 'DEBIT' ? txn.receiver : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Transaction Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status + Amount Hero */}
        <View style={[styles.heroCard, { backgroundColor: statusBg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{txn.status}</Text>
          <Text style={[styles.heroAmount, { color: amountColor }]}>
            {amountPrefix}
            {formatINR(txn.amount)}
          </Text>
          {txn.description && <Text style={styles.heroDescription}>{txn.description}</Text>}
        </View>

        {/* Counterparty */}
        {counterparty && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{txn.direction === 'CREDIT' ? 'From' : 'To'}</Text>
            <View style={styles.counterpartyRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{counterparty.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.counterpartyName}>{counterparty.name}</Text>
                <Text style={styles.counterpartyUpi}>{counterparty.upiId}</Text>
              </View>
            </View>
          </View>
        )}

        {/* External destination */}
        {txn.destination && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>To</Text>
            <Text style={styles.counterpartyName}>{txn.destination.accountHolderName}</Text>
            <Text style={styles.counterpartyUpi}>{txn.destination.maskedAccountNumber}</Text>
            <Text style={styles.counterpartyUpi}>{txn.destination.ifsc}</Text>
          </View>
        )}

        {/* Transaction Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <InfoRow label="Transaction ID" value={txn.transactionId} />
          <InfoRow label="Reference ID" value={txn.referenceId} />
          <InfoRow label="Type" value={txn.type.replace(/_/g, ' ')} />
          <InfoRow label="Payment Method" value={txn.provider.toUpperCase()} />
          <InfoRow label="Date" value={formatDate(txn.createdAt)} />
          <InfoRow label="Time" value={new Date(txn.createdAt).toLocaleTimeString()} />
          {txn.failureReason && (
            <InfoRow label="Failure Reason" value={txn.failureReason} valueColor={colors.danger} />
          )}
        </View>

        <Pressable style={styles.doneBtn} onPress={() => router.replace('/home')}>
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : {}]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  back: { fontSize: 24, color: colors.textPrimary },
  headerTitle: { ...typography.h3, color: colors.textPrimary },

  content: { padding: spacing.lg, gap: spacing.md },

  heroCard: { borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...typography.captionMedium },
  heroAmount: { ...typography.amountLarge },
  heroDescription: { ...typography.caption, color: colors.textSecondary },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
    gap: spacing.sm,
  },
  cardTitle: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs },

  counterpartyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { ...typography.h3, color: colors.primary },
  counterpartyName: { ...typography.bodyMedium, color: colors.textPrimary },
  counterpartyUpi: { ...typography.caption, color: colors.textSecondary },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  infoValue: {
    ...typography.captionMedium,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },

  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  doneBtnText: { ...typography.bodyMedium, color: colors.white },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...typography.body, color: colors.danger },
  backLink: { ...typography.bodyMedium, color: colors.primary },
});
