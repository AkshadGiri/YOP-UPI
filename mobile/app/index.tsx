import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../utils/theme';

/**
 * App entry point. Waits for the persisted auth store to rehydrate from
 * storage, then redirects:
 *   - no session                -> /login
 *   - session but PIN not set   -> /set-pin  (interrupted signup/first login)
 *   - session with PIN set      -> /home
 *
 * Uses expo-router's declarative <Redirect> rather than calling
 * `router.replace()` imperatively inside a useEffect. The imperative form
 * can fire before the Root Layout's navigator has finished its first
 * mount (most visible on web) and throws "Attempted to navigate before
 * mounting the Root Layout component" — <Redirect> is built to defer
 * until the router is actually ready, so it doesn't have that race.
 */
export default function SplashScreen() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  // Defensive fallback: onRehydrateStorage should always eventually fire
  // (authStore.ts handles its error case explicitly), but if something
  // unforeseen still prevents hasHydrated from ever flipping to true,
  // don't strand the user on this screen forever.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(timeout);
  }, []);

  const ready = hasHydrated || timedOut;

  if (!ready) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>UPI Demo Pay</Text>
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      </SafeAreaView>
    );
  }

  if (!user || !accessToken) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={user.pinSet ? '/home' : '/set-pin'} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  title: { ...typography.h1, color: colors.primary },
  spinner: { marginTop: spacing.lg },
});
