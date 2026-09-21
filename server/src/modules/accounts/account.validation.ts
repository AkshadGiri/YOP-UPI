import { z } from 'zod';

// Standard Indian IFSC format: 4 letters (bank code) + 0 + 6 alphanumeric (branch code).
const ifscSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code (e.g. HDFC0001234)');

const accountNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{9,18}$/, 'Account number must be 9-18 digits');

export const addAccountSchema = z.object({
  bankName: z.string().trim().min(2, 'Bank name is required').max(80, 'Bank name is too long'),
  accountHolderName: z
    .string()
    .trim()
    .min(2, 'Account holder name is required')
    .max(80, 'Account holder name is too long'),
  accountNumber: accountNumberSchema,
  ifsc: ifscSchema,
});

export const accountIdParamSchema = z.object({
  id: z.string().min(1, 'Account id is required'),
});
