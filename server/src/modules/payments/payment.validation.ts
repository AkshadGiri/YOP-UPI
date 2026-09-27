import { z } from 'zod';
import { amountSchema, phoneSchema, pinSchema } from '../../utils/validators';

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
