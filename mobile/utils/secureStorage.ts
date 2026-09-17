import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

export const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(name);
    }

    return SecureStore.getItemAsync(name);
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(name, value);
      return;
    }

    await SecureStore.setItemAsync(name, value);
  },

  removeItem: async (name: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(name);
      return;
    }

    await SecureStore.deleteItemAsync(name);
  },
};