import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/PrimaryButton';
import { getApiErrorMessage } from '../../services/api';
import * as walletService from '../../services/walletService';
import type { LedgerEntry, SafeWallet } from '../../types/wallet';
import { colors, radius, spacing, typography } from '../../utils/theme';
import { formatINR } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';
import { getTransactionTypeLabel } from '../../utils/transactionLabels';

export default function WalletScreen() {
  const [wallet, setWallet] = useState<SafeWallet | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);
    try {
      const [walletData, ledgerData] = await Promise.all([
        walletService.getWallet(),
        walletService.getLedger(1, 20),
      ]);
      setWallet(walletData);
      setEntries(ledgerData.entries);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Wallet</Text>
        <View style={{ width: 50 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
          ListHeaderComponent={
            <View>
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Wallet balance</Text>
                <Text style={styles.balanceValue}>{formatINR(wallet?.balance ?? '0')}</Text>
                <View style={styles.balanceActionsRow}>
                  <View style={styles.balanceActionButton}>
                    <PrimaryButton
                      label="+ Add money"
                      onPress={() => router.push('/wallet/add-money')}
                    />
                  </View>
                  <View style={styles.balanceActionButton}>
                    <PrimaryButton
                      label="Withdraw"
                      onPress={() => router.push('/wallet/withdraw')}
                    />
                  </View>
                </View>
              </View>
              {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
              <Text style={styles.sectionTitle}>Wallet activity</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No wallet activity yet</Text>
              <Text style={styles.emptySubtitle}>Add money to see it show up here.</Text>
            </View>
          }
          renderItem={({ item }) => <LedgerRow entry={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isCredit = entry.direction === 'CREDIT';
  return (
    <View style={styles.ledgerRow}>
      <View style={styles.ledgerRowLeft}>
        <Text style={styles.ledgerType}>
          {entry.description ?? getTransactionTypeLabel(entry.type)}
        </Text>
        <Text style={styles.ledgerDate}>{formatDateTime(entry.createdAt)}</Text>
        {entry.transactionId ? <Text style={styles.ledgerTxnId}>{entry.transactionId}</Text> : null}
      </View>
      <View style={styles.ledgerRowRight}>
        <Text style={[styles.ledgerAmount, isCredit ? styles.creditAmount : styles.debitAmount]}>
          {isCredit ? '+' : '−'} {formatINR(entry.amount)}
        </Text>
        <Text style={styles.ledgerBalanceAfter}>Bal: {formatINR(entry.balanceAfter)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backLink: { color: colors.primary, fontSize: typography.body.fontSize, fontWeight: '600' },
  title: { ...typography.h2, color: colors.textPrimary },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  balanceLabel: { color: colors.white, opacity: 0.85, fontSize: typography.caption.fontSize },
  balanceValue: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '700',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  balanceActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  balanceActionButton: {
    flex: 1,
  },
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
  emptyState: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  ledgerRowLeft: { flex: 1, marginRight: spacing.sm },
  ledgerType: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  ledgerDate: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  ledgerTxnId: { ...typography.caption, color: colors.textSecondary, marginTop: 2, fontSize: 11 },
  ledgerRowRight: { alignItems: 'flex-end' },
  ledgerAmount: { ...typography.body, fontWeight: '700' },
  creditAmount: { color: colors.success },
  debitAmount: { color: colors.danger },
  ledgerBalanceAfter: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
