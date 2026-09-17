import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Adapts expo-secure-store (which is inherently async and only stores
 * strings) to the synchronous-looking `StateStorage` interface zustand's
 * `persist` middleware expects. Used to keep auth tokens out of
 * AsyncStorage/localStorage, since SecureStore is backed by Keychain (iOS)
 * / Keystore (Android) — appropriate for JWTs, not appropriate for
 * anything else in this app.
 */
export const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
  },
};
