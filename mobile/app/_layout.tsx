import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * Root layout for Expo Router.
 *
 * Wires up safe area + gesture handler roots and a bare Stack navigator.
 * Screen-level auth gating (redirecting based on session state) happens in
 * app/index.tsx, not here — keeping this layout free of auth logic means
 * adding route groups later (e.g. a `(tabs)` group for the main app) won't
 * require touching this file.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
