import { api } from './api';
import { generateIdempotencyKey } from '../utils/idempotency';
import type { PaymentResult, RecipientPreview, SelfTransferResult } from '../types/payment';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export async function resolveMobileRecipient(mobile: string): Promise<RecipientPreview> {
  const res = await api.get<SuccessEnvelope<{ recipient: RecipientPreview }>>(
    '/payments/resolve/mobile',
    {
      params: { mobile },
    },
  );
  return res.data.data.recipient;
}

export interface PayByMobilePayload {
  mobile: string;
  amount: string;
  pin: string;
}

export async function payByMobile(payload: PayByMobilePayload): Promise<PaymentResult> {
  const res = await api.post<SuccessEnvelope<PaymentResult>>('/payments/mobile', payload, {
    headers: { 'Idempotency-Key': generateIdempotencyKey() },
  });
  return res.data.data;
}

export interface SelfTransferPayload {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  pin: string;
}

export async function selfTransfer(payload: SelfTransferPayload): Promise<SelfTransferResult> {
  const res = await api.post<SuccessEnvelope<SelfTransferResult>>('/payments/self', payload, {
    headers: { 'Idempotency-Key': generateIdempotencyKey() },
  });
  return res.data.data;
}
