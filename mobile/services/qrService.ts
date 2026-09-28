import { api } from './api';
import type { GeneratedQr } from '../types/qr';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

/**
 * Generates the caller's own payment QR. Omit `amount` for a static QR
 * (identity only, never expires); pass a decimal string like "500" for a
 * dynamic QR with that amount locked in and a 15-minute expiry.
 */
export async function generateQr(amount?: string): Promise<GeneratedQr> {
  const res = await api.post<SuccessEnvelope<{ qr: GeneratedQr }>>(
    '/qr/generate',
    amount ? { amount } : {},
  );
  return res.data.data.qr;
}
