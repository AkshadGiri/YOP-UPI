import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/PrimaryButton';
import * as authService from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../utils/theme';

/**
 * Temporary landing screen after login/signup.
 *
 * This is NOT the real home screen — the polished balance/quick-actions/
 * transactions home screen (Section 7 of the spec) is built once wallet
 * and bank account data exist to show. This exists so the auth flow has
 * somewhere to land and so logout/profile can be tested end-to-end now.
 */
export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearSession = useAuthStore((s) => s.clearSession);

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

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your UPI ID</Text>
          <Text style={styles.cardValue}>{user?.upiId}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Phone</Text>
          <Text style={styles.cardValue}>{user?.phone}</Text>
        </View>
        <Text style={styles.note}>
          This is a placeholder landing screen. The real home screen (balance, quick actions, recent
          transactions) lands once the wallet and bank account features are built.
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
  cardLabel: { ...typography.caption, color: colors.textSecondary },
  cardValue: { ...typography.body, color: colors.textPrimary, fontWeight: '600', marginTop: 2 },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    marginVertical: spacing.lg,
    lineHeight: 18,
  },
});
