import { api } from './api';
import type { LedgerPage, SafeWallet } from '../types/wallet';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export async function getWallet(): Promise<SafeWallet> {
  const res = await api.get<SuccessEnvelope<{ wallet: SafeWallet }>>('/wallet');
  return res.data.data.wallet;
}

export async function getLedger(page = 1, limit = 20): Promise<LedgerPage> {
  const res = await api.get<SuccessEnvelope<LedgerPage>>('/wallet/ledger', {
    params: { page, limit },
  });
  return res.data.data;
}

export interface AddMoneyPayload {
  bankAccountId: string;
  amount: number;
}

export async function addMoney(
  payload: AddMoneyPayload,
): Promise<{ wallet: SafeWallet; transactionId: string }> {
  const res = await api.post<SuccessEnvelope<{ wallet: SafeWallet; transactionId: string }>>(
    '/wallet/add-money',
    payload,
  );
  return res.data.data;
}
