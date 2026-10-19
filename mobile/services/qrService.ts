import { api } from './api';
import { generateIdempotencyKey } from '../utils/idempotency';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface GeneratedQr {
  uri: string;
  qrDataUrl: string;
  upiId: string;
  name: string;
  amount: string | null;
  currency: string;
  expiresAt: string | null;
}

export interface ResolvedQr {
  upiId: string;
  name: string;
  amount: string | null;
  currency: string;
  expiresAt: string | null;
  recipientUserId: string;
}

export interface PayByQrResult {
  transactionId: string;
  amount: string;
  recipient: { name: string; upiId: string };
  senderBalanceAfter: string;
}

export async function generateQr(amount?: string): Promise<GeneratedQr> {
  const res = await api.post<SuccessEnvelope<GeneratedQr>>('/qr/generate', {
    amount: amount || undefined,
  });
  return res.data.data;
}

export async function resolveQr(uri: string): Promise<ResolvedQr> {
  const res = await api.post<SuccessEnvelope<ResolvedQr>>('/qr/resolve', { uri });
  return res.data.data;
}

export async function payByQr(payload: {
  uri: string;
  amount?: string;
  pin: string;
}): Promise<PayByQrResult> {
  const res = await api.post<SuccessEnvelope<PayByQrResult>>('/payments/qr', payload, {
    headers: { 'Idempotency-Key': generateIdempotencyKey() },
  });
  return res.data.data;
}