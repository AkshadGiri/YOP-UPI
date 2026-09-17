import { api } from './api';
import type { OtpPurpose, SafeUser, TokenPair } from '../types/auth';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export async function requestOtp(
  phone: string,
  purpose: OtpPurpose,
): Promise<{ expiresAt: string }> {
  const res = await api.post<SuccessEnvelope<{ expiresAt: string }>>('/auth/otp/request', {
    phone,
    purpose,
  });
  return res.data.data;
}

export async function verifyOtp(
  phone: string,
  purpose: OtpPurpose,
  code: string,
): Promise<{ otpTicket: string }> {
  const res = await api.post<SuccessEnvelope<{ otpTicket: string }>>('/auth/otp/verify', {
    phone,
    purpose,
    code,
  });
  return res.data.data;
}

export interface SignupPayload {
  name: string;
  phone: string;
  email: string;
  password: string;
  otpTicket: string;
}

export async function signup(payload: SignupPayload): Promise<{ user: SafeUser } & TokenPair> {
  const res = await api.post<SuccessEnvelope<{ user: SafeUser } & TokenPair>>(
    '/auth/signup',
    payload,
  );
  return res.data.data;
}

export async function login(
  identifier: string,
  password: string,
): Promise<{ user: SafeUser } & TokenPair> {
  const res = await api.post<SuccessEnvelope<{ user: SafeUser } & TokenPair>>('/auth/login', {
    identifier,
    password,
  });
  return res.data.data;
}

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken });
}

export async function getMe(): Promise<SafeUser> {
  const res = await api.get<SuccessEnvelope<{ user: SafeUser }>>('/auth/me');
  return res.data.data.user;
}

export async function setPin(pin: string): Promise<void> {
  await api.post('/auth/pin/set', { pin });
}

export async function changePin(currentPin: string, newPin: string): Promise<void> {
  await api.post('/auth/pin/change', { currentPin, newPin });
}

export async function verifyPin(pin: string): Promise<void> {
  await api.post('/auth/pin/verify', { pin });
}
