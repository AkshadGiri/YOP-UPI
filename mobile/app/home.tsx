import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
 * somewhere to land and so logout can be tested end-to-end right now.
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
        <Text style={styles.greeting}>Welcome, {user?.name ?? 'there'} 👋</Text>
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
  greeting: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg },
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
