import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';
import type { ApiErrorBody, TokenPair } from '../types/auth';

const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://localhost:4000';

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 15000,
});

// Attach the access token to every request that has one. Endpoints that
// don't require auth (signup/login/otp) simply ignore the header — the
// backend only reads it where `authenticate` middleware is in the chain.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<TokenPair> | null = null;

/**
 * Calls POST /auth/refresh directly via a bare axios instance (not `api`)
 * to avoid recursing through this same response interceptor.
 */
async function performRefresh(): Promise<TokenPair> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  const response = await axios.post<{ success: true; data: TokenPair }>(
    `${API_BASE_URL}/api/auth/refresh`,
    { refreshToken },
  );
  return response.data.data;
}

// On a 401 with code TOKEN_EXPIRED, attempt exactly one silent refresh and
// retry the original request. Any other failure (or a failed refresh)
// clears the session so the app can redirect to /login. Concurrent 401s
// share a single in-flight refresh call instead of each firing their own.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const code = error.response?.data?.error?.code;

    if (
      error.response?.status === 401 &&
      code === 'TOKEN_EXPIRED' &&
      original &&
      !original._retried
    ) {
      original._retried = true;
      try {
        refreshPromise ??= performRefresh();
        const tokens = await refreshPromise;
        refreshPromise = null;
        useAuthStore.getState().setTokens(tokens);
        original.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(original);
      } catch (refreshError) {
        refreshPromise = null;
        useAuthStore.getState().clearSession();
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession();
    }

    return Promise.reject(error);
  },
);

/**
 * Extracts a user-displayable message from an Axios error thrown by any
 * `api.*` call, falling back gracefully for network errors that never
 * reached the server.
 */
export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const apiError = (err.response?.data as ApiErrorBody | undefined)?.error;
    if (apiError?.message) return apiError.message;
    if (err.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    if (!err.response) return 'Could not reach the server. Check your connection.';
  }
  return 'Something went wrong. Please try again.';
}

export function getApiErrorCode(err: unknown): string | undefined {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as ApiErrorBody | undefined)?.error?.code;
  }
  return undefined;
}
