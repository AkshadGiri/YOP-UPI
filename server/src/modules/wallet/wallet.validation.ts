import { z } from 'zod';

const MAX_AMOUNT = 100_000;

/**
 * Amount is validated and kept as a STRING all the way to the transaction
 * engine, which constructs a Prisma.Decimal directly from it. `Number()`
 * is used here only for the range check (0 < amount <= MAX_AMOUNT) — a
 * bounds comparison, not the actual monetary arithmetic — so any
 * theoretical floating-point imprecision at this step can't affect a
 * stored balance.
 */
const amountSchema = z
  .string({ required_error: 'Enter an amount' })
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount (up to 2 decimal places)')
  .refine((v) => Number(v) > 0, 'Amount must be greater than zero')
  .refine((v) => Number(v) <= MAX_AMOUNT, `Amount cannot exceed ₹${MAX_AMOUNT.toLocaleString('en-IN')}`);

export const addMoneySchema = z.object({
  bankAccountId: z.string().min(1, 'Select a bank account'),
  amount: amountSchema,
});

export const withdrawSchema = z.object({
  bankAccountId: z.string().min(1, 'Select a bank account'),
  amount: amountSchema,
});

export const ledgerQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
