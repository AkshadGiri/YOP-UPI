import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as transactionService from '../../services/transactionService';
import { colors, radius, shadow, spacing, typography } from '../../utils/theme';
import { formatINR } from '../../utils/currency';
import { formatDateTime, formatDate } from '../../utils/date';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<transactionService.TransactionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      load();
    }, [search, statusFilter]),
  );

  async function load() {
    setLoading(true);
    try {
      const result = await transactionService.listTransactions({
        search: search || undefined,
        status: statusFilter || undefined,
        limit: 50,
      });
      setTransactions(result.transactions);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  const grouped = groupByDate(transactions);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Transactions</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      <View style={styles.filterRow}>
        {['', 'SUCCESS', 'FAILED', 'PENDING'].map((s) => (
          <Pressable
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text
              style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}
            >
              {s || 'All'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      ) : transactions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No transactions found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {Object.entries(grouped).map(([date, txns]) => (
            <View key={date}>
              <Text style={styles.dateLabel}>{date}</Text>
              <View style={styles.txnCard}>
                {txns.map((txn, i) => (
                  <Pressable
                    key={txn.id}
                    style={[styles.txnRow, i < txns.length - 1 && styles.txnBorder]}
                    onPress={() => router.push(`/transactions/${txn.transactionId}`)}
                  >
                    <View
                      style={[
                        styles.txnIcon,
                        { backgroundColor: directionColor(txn.direction) + '15' },
                      ]}
                    >
                      <Text style={styles.txnIconText}>{directionIcon(txn.direction)}</Text>
                    </View>
                    <View style={styles.txnInfo}>
                      <Text style={styles.txnName} numberOfLines={1}>
                        {txn.counterpartyName ?? txn.type}
                      </Text>
                      <Text style={styles.txnTime}>{formatDateTime(txn.createdAt)}</Text>
                    </View>
                    <View style={styles.txnRight}>
                      <Text style={[styles.txnAmount, { color: directionColor(txn.direction) }]}>
                        {txn.direction === 'CREDIT' ? '+' : txn.direction === 'SELF' ? '↔' : '-'}
                        {formatINR(txn.amount)}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusColor(txn.status) + '20' },
                        ]}
                      >
                        <Text style={[styles.statusText, { color: statusColor(txn.status) }]}>
                          {txn.status}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function groupByDate(txns: transactionService.TransactionListItem[]) {
  const groups: Record<string, transactionService.TransactionListItem[]> = {};
  for (const txn of txns) {
    const date = formatDate(txn.createdAt);
    if (!groups[date]) groups[date] = [];
    groups[date].push(txn);
  }
  return groups;
}

function directionColor(d: string) {
  if (d === 'CREDIT') return colors.credit;
  if (d === 'SELF') return colors.self;
  return colors.debit;
}

function directionIcon(d: string) {
  if (d === 'CREDIT') return '↓';
  if (d === 'SELF') return '↔';
  return '↑';
}

function statusColor(s: string) {
  if (s === 'SUCCESS') return colors.success;
  if (s === 'FAILED') return colors.danger;
  if (s === 'REVERSED') return colors.warning;
  return colors.textSecondary;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  back: { fontSize: 24, color: colors.textPrimary },
  title: { ...typography.h2, color: colors.textPrimary },

  searchRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.captionMedium, color: colors.textSecondary },
  filterChipTextActive: { color: colors.white },

  list: { paddingHorizontal: spacing.lg },
  dateLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  txnCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadow.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  txnBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnIconText: { fontSize: 16 },
  txnInfo: { flex: 1 },
  txnName: { ...typography.bodyMedium, color: colors.textPrimary },
  txnTime: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  txnRight: { alignItems: 'flex-end', gap: 4 },
  txnAmount: { ...typography.bodyMedium },
  statusBadge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.sm },
  statusText: { fontSize: 10, fontWeight: '600' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { ...typography.bodyMedium, color: colors.textSecondary },
});
