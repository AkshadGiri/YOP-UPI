import { customAlphabet } from 'nanoid';
import { OtpPurpose } from '@prisma/client';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { hashSecret, verifySecret } from './crypto';
import { AppError } from './AppError';
import { logger } from './logger';

const numericOtp = customAlphabet('0123456789', 6);

/**
 * Generates and stores a new OTP for a phone number + purpose.
 *
 * DEMO_MODE behavior: the OTP is still generated, hashed, and stored
 * exactly like production — but the actual code used is always
 * `DEV_MOCK_OTP` (default "123456") so testers don't need a real SMS
 * provider. This is clearly gated on DEMO_MODE and logged as such; nothing
 * about the verification path is weakened, only which code counts as
 * correct.
 *
 * In a non-demo deployment, `sendSms(phone, code)` is where a real SMS
 * provider integration would plug in — that call is intentionally absent
 * here (see /docs/ARCHITECTURE.md).
 */
export async function requestOtp(phone: string, purpose: OtpPurpose): Promise<{ expiresAt: Date }> {
  const code = env.DEMO_MODE ? env.DEV_MOCK_OTP : numericOtp();
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  await prisma.otp.create({
    data: { phone, codeHash, purpose, expiresAt },
  });

  if (env.DEMO_MODE) {
    logger.info(`[DEMO_MODE] OTP for ${phone} (${purpose}): use mock code ${env.DEV_MOCK_OTP}`);
  } else {
    // Real SMS dispatch would happen here. Never log the actual code outside DEMO_MODE.
    logger.info(`OTP dispatched to ${phone} for ${purpose}`);
  }

  return { expiresAt };
}

/**
 * Verifies a submitted OTP code against the most recent unverified,
 * unexpired Otp row for this phone + purpose. Increments `attempts` on
 * failure and locks out after OTP_MAX_ATTEMPTS. On success, marks the row
 * verified so it can't be replayed.
 */
export async function verifyOtp(phone: string, purpose: OtpPurpose, code: string): Promise<void> {
  const otpRow = await prisma.otp.findFirst({
    where: { phone, purpose, verified: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRow) {
    throw new AppError('INVALID_OTP');
  }

  if (otpRow.expiresAt < new Date()) {
    throw new AppError('OTP_EXPIRED');
  }

  if (otpRow.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw new AppError('OTP_MAX_ATTEMPTS_EXCEEDED');
  }

  const matches = await verifySecret(otpRow.codeHash, code);

  if (!matches) {
    await prisma.otp.update({
      where: { id: otpRow.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError('INVALID_OTP');
  }

  await prisma.otp.update({
    where: { id: otpRow.id },
    data: { verified: true },
  });
}
