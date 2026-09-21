import { useEffect } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../utils/theme';

/**
 * App entry point. Waits for the persisted auth store to rehydrate from
 * SecureStore, then redirects:
 *   - no session                -> /login
 *   - session but PIN not set   -> /set-pin  (interrupted signup/first login)
 *   - session with PIN set      -> /home
 *
 * This is what makes "session persistence" (Section 3 of the spec) visible
 * to the user — a cold app start with a valid stored session skips
 * straight past login instead of asking them to log in again.
 */
export default function SplashScreen() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!user || !accessToken) {
      router.replace('/login');
      return;
    }

    router.replace(user.pinSet ? '/home' : '/set-pin');
  }, [hasHydrated, user, accessToken]);

  // Defensive fallback: onRehydrateStorage should always fire (see
  // authStore.ts, which now handles its error case explicitly), but if
  // something unforeseen still prevents hasHydrated from ever flipping to
  // true, don't strand the user on this screen forever — fall through to
  // login after a few seconds.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!useAuthStore.getState().hasHydrated) {
        useAuthStore.getState().setHasHydrated(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>UPI Demo Pay</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: { ...typography.h1, color: colors.primary },
});
