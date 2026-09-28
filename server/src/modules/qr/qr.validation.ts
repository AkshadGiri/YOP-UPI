import { z } from 'zod';
import { amountSchema } from '../../utils/validators';

/**
 * `amount` is optional: omitted means a static QR (identity only), present
 * means a dynamic QR with that amount locked in. Currency isn't accepted
 * as input — INR is the only supported currency and is always emitted as
 * `cu=INR` in the URI.
 */
export const generateQrSchema = z.object({
  amount: amountSchema().optional(),
});
