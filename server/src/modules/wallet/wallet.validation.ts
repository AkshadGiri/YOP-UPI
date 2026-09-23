import { z } from 'zod';

const MAX_ADD_MONEY_AMOUNT = 100_000;

export const addMoneySchema = z.object({
  bankAccountId: z.string().min(1, 'Select a bank account'),
  amount: z.coerce
    .number({ invalid_type_error: 'Enter a valid amount' })
    .positive('Amount must be greater than zero')
    .max(MAX_ADD_MONEY_AMOUNT, `Amount cannot exceed ₹${MAX_ADD_MONEY_AMOUNT.toLocaleString('en-IN')}`),
});

export const ledgerQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
