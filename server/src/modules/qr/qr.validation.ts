import { z } from 'zod';
import { amountSchema, pinSchema } from '../../utils/validators';

export const generateQrSchema = z.object({
  amount: amountSchema().optional(),
});

export const resolveQrSchema = z.object({
  uri: z.string().min(1, 'QR URI is required'),
});

export const payByQrSchema = z.object({
  uri: z.string().min(1, 'QR URI is required'),
  // Required only for static QRs — dynamic QRs have amount baked in
  amount: amountSchema().optional(),
  pin: pinSchema,
});