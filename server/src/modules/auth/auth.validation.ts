import { z } from 'zod';
import { OtpPurpose } from '@prisma/client';

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const pinSchema = z.string().regex(/^\d{4}$/, 'UPI PIN must be exactly 4 digits');

// Only SIGNUP and LOGIN are exposed as request-able OTP purposes today.
// RESET_PIN/SET_PIN exist in the schema for a future "forgot PIN" flow.
const otpPurposeSchema = z.enum([OtpPurpose.SIGNUP, OtpPurpose.LOGIN]);

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  purpose: otpPurposeSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  purpose: otpPurposeSchema,
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(60, 'Name is too long'),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: passwordSchema,
  otpTicket: z.string().min(1, 'OTP verification is required before signup'),
});

export const loginSchema = z.object({
  // Accept either phone or email as the identifier.
  identifier: z.string().trim().min(3, 'Enter your phone number or email'),
  password: z.string().min(1, 'Password is required'),
});

export const otpLoginSchema = z.object({
  phone: phoneSchema,
  otpTicket: z.string().min(1, 'OTP verification is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const setPinSchema = z.object({
  pin: pinSchema,
});

export const changePinSchema = z.object({
  currentPin: pinSchema,
  newPin: pinSchema,
});

export const verifyPinSchema = z.object({
  pin: pinSchema,
});
