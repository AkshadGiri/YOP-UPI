import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * Root layout for Expo Router.
 *
 * Phase 1 scaffold: just wires up safe area + gesture handler roots and a
 * bare Stack navigator so the app boots. Screens (splash, login, signup,
 * home, etc.) and the auth-gated route groups are added starting Phase 3.
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
