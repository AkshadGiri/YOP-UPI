import { z } from 'zod';

/** Indian 10-digit mobile number, used anywhere a phone number is entered or searched. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

/** UPI PIN — exactly 4 digits, used everywhere a PIN is set/changed/verified. */
export const pinSchema = z.string().regex(/^\d{4}$/, 'UPI PIN must be exactly 4 digits');

/** Standard Indian IFSC format: 4 letters (bank code) + 0 + 6 alphanumeric (branch code). */
export const ifscSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code (e.g. HDFC0001234)');

/** Indian bank account numbers are typically 9-18 digits. */
export const accountNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{9,18}$/, 'Account number must be 9-18 digits');

/**
 * A rupee amount as a decimal string, e.g. "500" or "499.50". Deliberately
 * NOT `z.coerce.number()` — see docs/ARCHITECTURE.md → "Transaction flow"
 * → "Money never touches floating point". `Number()` below is used only
 * for the bounds check, never for the value that reaches the transaction
 * engine.
 */
export function amountSchema(maxAmount = 100_000) {
  return z
    .string({ required_error: 'Enter an amount' })
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount (up to 2 decimal places)')
    .refine((v) => Number(v) > 0, 'Amount must be greater than zero')
    .refine((v) => Number(v) <= maxAmount, `Amount cannot exceed ₹${maxAmount.toLocaleString('en-IN')}`);
}
