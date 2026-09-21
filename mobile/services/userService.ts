import { api } from './api';
import type { SafeUser } from '../types/auth';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export async function getProfile(): Promise<SafeUser> {
  const res = await api.get<SuccessEnvelope<{ user: SafeUser }>>('/users/profile');
  return res.data.data.user;
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  profilePictureUrl?: string | null;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<SafeUser> {
  const res = await api.patch<SuccessEnvelope<{ user: SafeUser }>>('/users/profile', payload);
  return res.data.data.user;
}
