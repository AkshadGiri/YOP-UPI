import { StyleSheet, Text, View } from 'react-native';

/**
 * Temporary entry screen for Phase 1.
 *
 * This is replaced by the real splash screen (with auth-state check and
 * redirect to /login or /home) in Phase 3 — Authentication. Kept here only
 * so `npx expo start` has something to boot into and you can verify the
 * scaffold works end-to-end before more is layered on.
 */
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>UPI Demo Pay</Text>
      <Text style={styles.subtitle}>Phase 1 scaffold — auth screens land in Phase 3</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0B5FFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
