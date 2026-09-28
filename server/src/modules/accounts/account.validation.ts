import { z } from 'zod';
import { accountNumberSchema, ifscSchema } from '../../utils/validators';

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
