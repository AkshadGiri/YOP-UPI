import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../components/Avatar';
import { BottomNav } from '../components/BottomNav';
import * as walletService from '../services/walletService';
import * as transactionService from '../services/transactionService';
import { useAuthStore } from '../store/authStore';
import { colors, radius, spacing, typography } from '../utils/theme';
import { formatINR } from '../utils/currency';
import { formatDateTime } from '../utils/date';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [recentTxns, setRecentTxns] = useState<transactionService.TransactionListItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      walletService
        .getWallet()
        .then((w) => setWalletBalance(w.balance))
        .catch(() => {});
      transactionService
        .listTransactions({ limit: 5 })
        .then((r) => setRecentTxns(r.transactions))
        .catch(() => {});
    }, []),
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()} ✨</Text>
            <Text style={styles.userName}>{user?.name ?? 'there'} 👋</Text>
          </View>
          <Pressable onPress={() => router.push('/profile')}>
            <Avatar name={user?.name ?? '?'} uri={user?.profilePictureUrl} size={44} />
          </Pressable>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceDecor1} />
          <View style={styles.balanceDecor2} />
          <View style={styles.balanceInner}>
            <View style={styles.balanceTop}>
              <View>
                <Text style={styles.balanceLabel}>Total Balance</Text>
                <Text style={styles.balanceAmount}>
                  {balanceHidden
                    ? '₹ ••••••'
                    : walletBalance !== null
                      ? formatINR(walletBalance)
                      : '—'}
                </Text>
              </View>
              <Pressable onPress={() => setBalanceHidden((v) => !v)} style={styles.eyeBtn}>
                <Text style={{ fontSize: 16 }}>{balanceHidden ? '👁️' : '🙈'}</Text>
              </Pressable>
            </View>
            <View style={styles.upiRow}>
              <View style={styles.upiChip}>
                <Text style={styles.upiChipText}>{user?.upiId ?? '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Scan & Pay */}
        <Pressable style={styles.scanRow} onPress={() => router.push('/qr/scan')}>
          <View style={styles.scanLeft}>
            <View style={styles.scanIconWrap}>
              <Text style={{ fontSize: 18 }}>⚡</Text>
            </View>
            <View>
              <Text style={styles.scanTitle}>Scan & Pay</Text>
              <Text style={styles.scanSub}>Scan any UPI QR code</Text>
            </View>
          </View>
          <Text style={styles.scanArrow}>→</Text>
        </Pressable>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <ActionTile
            icon="📱"
            label="Mobile"
            color="#00C896"
            onPress={() => router.push('/send/mobile')}
          />
          <ActionTile
            icon="🏦"
            label="Bank"
            color="#7C3AED"
            onPress={() => router.push('/send/bank')}
          />
          <ActionTile
            icon="🔄"
            label="Self"
            color="#0066FF"
            onPress={() => router.push('/send/self')}
          />
          <ActionTile
            icon="👛"
            label="Wallet"
            color="#FFB547"
            onPress={() => router.push('/wallet')}
          />
        </View>

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable onPress={() => router.push('/transactions')}>
            <Text style={styles.seeAll}>View all →</Text>
          </Pressable>
        </View>

        {recentTxns.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>💸</Text>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySub}>Your payments will appear here</Text>
          </View>
        ) : (
          <View style={styles.txnCard}>
            {recentTxns.map((txn, i) => {
              const color =
                txn.direction === 'CREDIT'
                  ? colors.credit
                  : txn.direction === 'SELF'
                    ? colors.self
                    : colors.debit;
              const prefix =
                txn.direction === 'CREDIT' ? '+' : txn.direction === 'SELF' ? '↔ ' : '-';
              const name = txn.counterpartyName ?? txn.type.replace(/_/g, ' ');
              return (
                <Pressable
                  key={txn.id}
                  style={[styles.txnRow, i < recentTxns.length - 1 && styles.txnBorder]}
                  onPress={() => router.push(`/transactions/${txn.transactionId}` as any)}
                >
                  <View style={[styles.txnAvatar, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.txnAvatarText, { color }]}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.txnInfo}>
                    <Text style={styles.txnName} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.txnDate}>{formatDateTime(txn.createdAt)}</Text>
                  </View>
                  <View style={styles.txnRight}>
                    <Text style={[styles.txnAmount, { color }]}>
                      {prefix}
                      {formatINR(txn.amount)}
                    </Text>
                    <Text style={[styles.txnStatus, { color: statusColor(txn.status) }]}>
                      {txn.status}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

function ActionTile({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={[styles.actionIconBg, { backgroundColor: color + '20' }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function statusColor(s: string) {
  if (s === 'SUCCESS') return colors.success;
  if (s === 'FAILED') return colors.danger;
  return colors.warning;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xl },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  greeting: { ...typography.caption, color: colors.textSecondary },
  userName: { ...typography.h2, color: colors.textPrimary },

  balanceCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.primary,
  },
  balanceDecor1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -60,
    right: -40,
  },
  balanceDecor2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -30,
    right: 80,
  },
  balanceInner: { padding: spacing.lg, zIndex: 1 },
  balanceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  eyeBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.md,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upiRow: { flexDirection: 'row' },
  upiChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  upiChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },

  scanRow: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scanLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  scanIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  scanSub: { ...typography.caption, color: colors.textSecondary },
  scanArrow: { fontSize: 18, color: colors.textSecondary },

  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  seeAll: { ...typography.captionMedium, color: colors.primary },

  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconBg: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  txnCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  txnBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  txnAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnAvatarText: { fontSize: 16, fontWeight: '800' },
  txnInfo: { flex: 1 },
  txnName: { ...typography.bodyMedium, color: colors.textPrimary },
  txnDate: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  txnRight: { alignItems: 'flex-end', gap: 3 },
  txnAmount: { ...typography.bodyMedium },
  txnStatus: { fontSize: 10, fontWeight: '700' },

  emptyCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { ...typography.bodyMedium, color: colors.textPrimary },
  emptySub: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
