import { api } from './api';
import type { SafeBankAccount } from '../types/account';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export async function listAccounts(): Promise<SafeBankAccount[]> {
  const res = await api.get<SuccessEnvelope<{ accounts: SafeBankAccount[] }>>('/accounts');
  return res.data.data.accounts;
}

export interface AddAccountPayload {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
}

export async function addAccount(payload: AddAccountPayload): Promise<SafeBankAccount> {
  const res = await api.post<SuccessEnvelope<{ account: SafeBankAccount }>>('/accounts', payload);
  return res.data.data.account;
}

export async function setPrimaryAccount(id: string): Promise<SafeBankAccount> {
  const res = await api.patch<SuccessEnvelope<{ account: SafeBankAccount }>>(
    `/accounts/${id}/primary`,
  );
  return res.data.data.account;
}

export async function removeAccount(id: string): Promise<void> {
  await api.delete(`/accounts/${id}`);
}
