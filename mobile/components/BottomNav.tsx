import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { colors, spacing } from '../utils/theme';

const TABS = [
  { label: 'Home', icon: '🏠', route: '/home' },
  { label: 'Send', icon: '💸', route: '/send/mobile' },
  { label: 'Scan', icon: '⚡', route: '/qr/scan', isFab: true },
  { label: 'History', icon: '🕐', route: '/transactions' },
  { label: 'Profile', icon: '👤', route: '/profile' },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  function isActive(route: string) {
    if (route === '/home') return pathname === '/home';
    const base = '/' + route.split('/')[1];
    return pathname.startsWith(base);
  }

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const active = isActive(tab.route);
        const isFab = 'isFab' in tab && tab.isFab;
        if (isFab) {
          return (
            <Pressable key={tab.label} style={styles.fabWrap} onPress={() => router.push(tab.route as any)}>
              <View style={styles.fab}><Text style={styles.fabIcon}>{tab.icon}</Text></View>
              <Text style={[styles.label, { color: colors.textTertiary }]}>{tab.label}</Text>
            </Pressable>
          );
        }
        return (
          <Pressable key={tab.label} style={styles.tab} onPress={() => router.push(tab.route as any)}>
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Text style={styles.icon}>{tab.icon}</Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-end',
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingTop: 4 },
  iconWrap: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  iconWrapActive: { backgroundColor: colors.primaryLight },
  icon: { fontSize: 18 },
  label: { fontSize: 10, fontWeight: '600', color: colors.textTertiary },
  labelActive: { color: colors.primary },
  fabWrap: { flex: 1, alignItems: 'center', gap: 4 },
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  fabIcon: { fontSize: 20 },
});