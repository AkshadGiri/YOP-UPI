import { z } from 'zod';
import {
  accountNumberSchema,
  amountSchema,
  ifscSchema,
  phoneSchema,
  pinSchema,
} from '../../utils/validators';

export const resolveMobileQuerySchema = z.object({
  mobile: phoneSchema,
});

export const payMobileSchema = z.object({
  mobile: phoneSchema,
  amount: amountSchema(),
  pin: pinSchema,
});

export const selfTransferSchema = z.object({
  fromAccountId: z.string().min(1, 'Select a source account'),
  toAccountId: z.string().min(1, 'Select a destination account'),
  amount: amountSchema(),
  pin: pinSchema,
});

export const bankTransferSchema = z.object({
  accountNumber: accountNumberSchema,
  ifsc: ifscSchema,
  accountHolderName: z
    .string()
    .trim()
    .min(2, 'Account holder name is required')
    .max(80, 'Account holder name is too long'),
  amount: amountSchema(),
  pin: pinSchema,
});

// Phase 12 — QR payment
export const payByQrSchema = z.object({
  uri: z.string().min(1, 'QR URI is required'),
  amount: amountSchema().optional(),
  pin: pinSchema,
});