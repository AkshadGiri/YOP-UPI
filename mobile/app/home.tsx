import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/PrimaryButton';
import * as authService from '../services/authService';
import * as walletService from '../services/walletService';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../utils/theme';
import { formatINR } from '../utils/currency';

/**
 * Temporary landing screen after login/signup.
 *
 * This is NOT the real home screen — the polished balance/quick-actions/
 * transactions home screen (Section 7 of the spec) is built once bank
 * accounts, wallet, and transactions all exist to show together. This
 * exists so the auth flow has somewhere to land and so each feature can be
 * tested end-to-end as it's built.
 */
export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      walletService
        .getWallet()
        .then((w) => setWalletBalance(w.balance))
        .catch(() => {
          // Non-fatal — the Wallet screen itself will show the real error if any.
        });
    }, []),
  );

  async function handleLogout() {
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch {
        // Logout is best-effort client-side regardless of server response.
      }
    }
    clearSession();
    router.replace('/login');
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Pressable style={styles.profileRow} onPress={() => router.push('/profile')}>
          <Avatar name={user?.name ?? '?'} uri={user?.profilePictureUrl} size={56} />
          <View style={styles.profileText}>
            <Text style={styles.greeting}>Welcome, {user?.name ?? 'there'} 👋</Text>
            <Text style={styles.viewProfileLink}>View profile →</Text>
          </View>
        </Pressable>

        <PrimaryButton label="Send to mobile number" onPress={() => router.push('/send/mobile')} />

        <View style={styles.spacer} />

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your UPI ID</Text>
          <Text style={styles.cardValue}>{user?.upiId}</Text>
        </View>
        <Pressable style={styles.card} onPress={() => router.push('/wallet')}>
          <Text style={styles.cardLabel}>Wallet</Text>
          <Text style={styles.cardValue}>
            {walletBalance !== null ? formatINR(walletBalance) : 'Loading…'} →
          </Text>
        </Pressable>
        <Pressable style={styles.card} onPress={() => router.push('/accounts')}>
          <Text style={styles.cardLabel}>Bank Accounts</Text>
          <Text style={styles.cardValue}>Manage linked accounts →</Text>
        </Pressable>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Phone</Text>
          <Text style={styles.cardValue}>{user?.phone}</Text>
        </View>
        <Text style={styles.note}>
          This is a placeholder landing screen. The real home screen (quick actions, recent
          transactions) lands once self transfer, bank transfer, QR, and transaction history are
          built too.
        </Text>
        <PrimaryButton label="Log out" onPress={handleLogout} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  profileText: { marginLeft: spacing.md, flex: 1 },
  greeting: { ...typography.h2, color: colors.textPrimary },
  viewProfileLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  spacer: { height: spacing.lg },
  cardLabel: { ...typography.caption, color: colors.textSecondary },
  cardValue: { ...typography.body, color: colors.textPrimary, fontWeight: '600', marginTop: 2 },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    marginVertical: spacing.lg,
    lineHeight: 18,
  },
});
