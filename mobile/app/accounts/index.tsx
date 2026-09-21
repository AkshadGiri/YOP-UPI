import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/PrimaryButton';
import * as accountService from '../../services/accountService';
import { getApiErrorMessage } from '../../services/api';
import type { SafeBankAccount } from '../../types/account';
import { colors, radius, spacing, typography } from '../../utils/theme';
import { formatINR } from '../../utils/currency';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<SafeBankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  const loadAccounts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await accountService.listAccounts();
      setAccounts(data);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Reload every time the screen gains focus (e.g. returning from "Add
  // account"), not just on first mount.
  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts]),
  );

  async function handleSetPrimary(account: SafeBankAccount) {
    setBusyAccountId(account.id);
    try {
      await accountService.setPrimaryAccount(account.id);
      await loadAccounts();
    } catch (err) {
      Alert.alert('Could not set primary', getApiErrorMessage(err));
    } finally {
      setBusyAccountId(null);
    }
  }

  function handleRemove(account: SafeBankAccount) {
    Alert.alert(
      'Remove bank account',
      `Remove ${account.bankName} (${account.maskedAccountNumber})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyAccountId(account.id);
            try {
              await accountService.removeAccount(account.id);
              await loadAccounts();
            } catch (err) {
              Alert.alert('Could not remove account', getApiErrorMessage(err));
            } finally {
              setBusyAccountId(null);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Bank Accounts</Text>
        <View style={{ width: 50 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => loadAccounts(true)} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No bank accounts yet</Text>
              <Text style={styles.emptySubtitle}>
                Add a demo bank account to simulate transfers and balances.
              </Text>
            </View>
          }
          ListHeaderComponent={
            errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.bankName}>{item.bankName}</Text>
                {item.isPrimary ? (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.accountNumber}>{item.maskedAccountNumber}</Text>
              <Text style={styles.holderName}>{item.accountHolderName}</Text>
              <Text style={styles.balance}>{formatINR(item.balance)}</Text>

              {busyAccountId === item.id ? (
                <ActivityIndicator style={styles.rowSpinner} color={colors.primary} />
              ) : (
                <View style={styles.actionsRow}>
                  {!item.isPrimary ? (
                    <Pressable onPress={() => handleSetPrimary(item)}>
                      <Text style={styles.actionLink}>Set as primary</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => handleRemove(item)}>
                    <Text style={[styles.actionLink, styles.removeLink]}>Remove</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
      )}

      <View style={styles.footer}>
        <PrimaryButton label="+ Add bank account" onPress={() => router.push('/accounts/add')} />
      </View>
    </SafeAreaView>
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
  errorBanner: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontSize: typography.caption.fontSize,
  },
  emptyState: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankName: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  primaryBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  primaryBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  accountNumber: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
  holderName: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  balance: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.sm },
  rowSpinner: { marginTop: spacing.md, alignSelf: 'flex-start' },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  actionLink: { color: colors.primary, fontWeight: '600', fontSize: typography.caption.fontSize },
  removeLink: { color: colors.danger },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
