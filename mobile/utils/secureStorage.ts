import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Adapts a platform-appropriate storage backend to the `StateStorage`
 * interface zustand's `persist` middleware expects.
 *
 * On iOS/Android: expo-secure-store, backed by Keychain/Keystore —
 * appropriate for JWTs, which is the only thing this app persists here.
 *
 * On web: expo-secure-store has NO web implementation at all (it throws).
 * Without this fallback, the very first read on web would reject, and the
 * app would sit on the splash screen forever — the auth store's
 * `onRehydrateStorage` callback never fires with a value, so
 * `hasHydrated` never flips to true. `window.localStorage` is used
 * instead. This is explicitly NOT secure storage — fine for quickly
 * eyeballing screens in a browser during development, not something to
 * rely on for the real security behavior (test that via Expo Go instead).
 */
const webStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Ignore — e.g. private browsing mode blocking storage.
    }
  },
  removeItem: (name: string): void => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Ignore.
    }
  },
};

const nativeStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      // Corrupted keychain entry, first-ever launch, etc. — treat as "no
      // saved session" rather than letting the error propagate and stall
      // the persist middleware's rehydration indefinitely.
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      // Best-effort — a failed write shouldn't crash the app; the user
      // will just need to log in again next cold start.
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // Already gone or inaccessible — fine either way.
    }
  },
};

export const secureStorage: StateStorage = Platform.OS === 'web' ? webStorage : nativeStorage;
