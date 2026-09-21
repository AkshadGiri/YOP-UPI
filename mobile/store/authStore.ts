import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { secureStorage } from '../utils/secureStorage';
import type { SafeUser, TokenPair } from '../types/auth';

interface AuthState {
  user: SafeUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hasHydrated: boolean;

  setSession: (user: SafeUser, tokens: TokenPair) => void;
  setTokens: (tokens: TokenPair) => void;
  setUser: (user: SafeUser) => void;
  clearSession: () => void;
  setHasHydrated: (value: boolean) => void;
}

/**
 * The single source of truth for "who is logged in" on the client.
 * Persisted to SecureStore (Keychain/Keystore) so a session survives an app
 * restart — this is what makes "session persistence" (Section 3 of the
 * spec) work. Screens read `user`/`accessToken` to decide what to render;
 * `services/api.ts` reads tokens directly via `useAuthStore.getState()` for
 * the Axios interceptors (outside React, so it can't use the hook).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hasHydrated: false,

      setSession: (user, tokens) =>
        set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),

      setTokens: (tokens) =>
        set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),

      setUser: (user) => set({ user }),

      clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'upi-app-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          // Failed to read/parse the persisted session — proceed as if
          // there's no saved session rather than leaving the splash screen
          // stuck forever. `state` is not reliable here (it's often
          // undefined on error), so call the store directly.
          useAuthStore.getState().setHasHydrated(true);
          return;
        }
        state?.setHasHydrated(true);
      },
    },
  ),
);
