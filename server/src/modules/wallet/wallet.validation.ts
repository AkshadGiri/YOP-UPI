import { z } from 'zod';
import { amountSchema } from '../../utils/validators';

export const addMoneySchema = z.object({
  bankAccountId: z.string().min(1, 'Select a bank account'),
  amount: amountSchema(),
});

export const withdrawSchema = z.object({
  bankAccountId: z.string().min(1, 'Select a bank account'),
  amount: amountSchema(),
});

export const ledgerQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
