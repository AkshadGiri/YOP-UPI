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
