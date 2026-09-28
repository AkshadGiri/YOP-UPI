import { z } from 'zod';

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');

export const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits');

export const signupDetailsSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short'),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: passwordSchema,
});
export type SignupDetailsForm = z.infer<typeof signupDetailsSchema>;

export const otpCodeSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code'),
});
export type OtpCodeForm = z.infer<typeof otpCodeSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your phone number or email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const ifscSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code, e.g. HDFC0001234');

export const accountNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{9,18}$/, '9-18 digit account number');

export const addAccountFormSchema = z
  .object({
    bankName: z.string().trim().min(2, 'Bank name is required'),
    accountHolderName: z.string().trim().min(2, 'Account holder name is required'),
    accountNumber: accountNumberSchema,
    confirmAccountNumber: z.string().trim().min(1, 'Re-enter the account number'),
    ifsc: ifscSchema,
  })
  .refine((data) => data.accountNumber === data.confirmAccountNumber, {
    message: 'Account numbers do not match',
    path: ['confirmAccountNumber'],
  });
export type AddAccountForm = z.infer<typeof addAccountFormSchema>;

export const bankTransferDetailsSchema = z
  .object({
    accountNumber: accountNumberSchema,
    confirmAccountNumber: z.string().trim().min(1, 'Re-enter the account number'),
    ifsc: ifscSchema,
    accountHolderName: z.string().trim().min(2, 'Account holder name is required'),
  })
  .refine((data) => data.accountNumber === data.confirmAccountNumber, {
    message: 'Account numbers do not match',
    path: ['confirmAccountNumber'],
  });
export type BankTransferDetailsForm = z.infer<typeof bankTransferDetailsSchema>;

export const editProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});
export type EditProfileForm = z.infer<typeof editProfileSchema>;

export const setPinFormSchema = z
  .object({
    pin: pinSchema,
    confirmPin: pinSchema,
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: 'PINs do not match',
    path: ['confirmPin'],
  });
export type SetPinForm = z.infer<typeof setPinFormSchema>;

/** Reused everywhere a single rupee amount is entered - add money, withdraw, send money. */
export const amountFieldSchema = z
  .string()
  .trim()
  .min(1, 'Enter an amount')
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')
  .refine((v) => Number(v) > 0, 'Amount must be greater than zero')
  .refine((v) => Number(v) <= 100000, 'Amount cannot exceed ₹1,00,000');

export const addMoneyFormSchema = z.object({
  bankAccountId: z.string().min(1, 'Select a bank account'),
  amount: amountFieldSchema,
});
export type AddMoneyForm = z.infer<typeof addMoneyFormSchema>;

export const mobileNumberFormSchema = z.object({ mobile: phoneSchema });
export type MobileNumberForm = z.infer<typeof mobileNumberFormSchema>;

export const payAmountFormSchema = z.object({ amount: amountFieldSchema });
export type PayAmountForm = z.infer<typeof payAmountFormSchema>;

export const payPinFormSchema = z.object({ pin: pinSchema });
export type PayPinForm = z.infer<typeof payPinFormSchema>;

/** Amount for a dynamic QR. Blank is valid and means "no amount" (a static QR). */
export const qrAmountFormSchema = z.object({
  amount: z.union([z.literal(''), amountFieldSchema]),
});
export type QrAmountForm = z.infer<typeof qrAmountFormSchema>;

export const selfTransferSelectSchema = z
  .object({
    fromAccountId: z.string().min(1, 'Select a source account'),
    toAccountId: z.string().min(1, 'Select a destination account'),
    amount: amountFieldSchema,
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'Choose two different accounts',
    path: ['toAccountId'],
  });
export type SelfTransferSelectForm = z.infer<typeof selfTransferSelectSchema>;
