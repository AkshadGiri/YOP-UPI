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
