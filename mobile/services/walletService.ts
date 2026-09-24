import { api } from './api';
import { generateIdempotencyKey } from '../utils/idempotency';
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

export interface WalletTransferPayload {
  bankAccountId: string;
  /** A decimal string, e.g. "500" or "499.50" — never a JS number, to avoid
   *  any floating-point round-trip on money before it reaches the server. */
  amount: string;
}

export interface WalletTransferResult {
  wallet: SafeWallet;
  transactionId: string;
}

export async function addMoney(payload: WalletTransferPayload): Promise<WalletTransferResult> {
  const res = await api.post<SuccessEnvelope<WalletTransferResult>>('/wallet/add-money', payload, {
    headers: { 'Idempotency-Key': generateIdempotencyKey() },
  });
  return res.data.data;
}

export async function withdraw(payload: WalletTransferPayload): Promise<WalletTransferResult> {
  const res = await api.post<SuccessEnvelope<WalletTransferResult>>('/wallet/withdraw', payload, {
    headers: { 'Idempotency-Key': generateIdempotencyKey() },
  });
  return res.data.data;
}
