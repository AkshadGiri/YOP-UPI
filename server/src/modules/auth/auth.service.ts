import { OtpPurpose, Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { hashSecret, verifySecret } from '../../utils/crypto';
import * as otpUtil from '../../utils/otp';
import { generateUniqueUpiId } from '../../utils/upi';
import { toSafeUser, type SafeUser } from '../users/user.service';
import {
  hashToken,
  signAccessToken,
  signOtpTicket,
  signRefreshToken,
  verifyOtpTicket,
  verifyRefreshToken,
} from '../../utils/jwt';

export type { SafeUser };

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues a new access + refresh token pair for a user and persists the
 * refresh token's hash (never the raw token) so it can be looked up,
 * revoked, or checked for reuse during rotation.
 */
async function issueTokenPair(userId: string): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: userId });
  const refreshToken = signRefreshToken({ sub: userId });

  const decoded = jwt.decode(refreshToken) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------------------
// OTP
// ---------------------------------------------------------------------------

export async function requestOtp(phone: string, purpose: OtpPurpose): Promise<{ expiresAt: Date }> {
  if (purpose === OtpPurpose.SIGNUP) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new AppError('PHONE_ALREADY_REGISTERED');
    }
  }

  if (purpose === OtpPurpose.LOGIN) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (!existing) {
      throw new AppError('USER_NOT_FOUND');
    }
  }

  return otpUtil.requestOtp(phone, purpose);
}

/**
 * Verifies an OTP code and, on success, issues a short-lived ticket proving
 * "this phone number just passed OTP verification for this purpose". The
 * ticket — not a boolean flag the client could fake — is what
 * signup/loginWithOtp require next.
 */
export async function verifyOtpAndIssueTicket(
  phone: string,
  purpose: OtpPurpose,
  code: string,
): Promise<{ otpTicket: string }> {
  await otpUtil.verifyOtp(phone, purpose, code);
  return { otpTicket: signOtpTicket({ phone, purpose }) };
}

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

export interface SignupInput {
  name: string;
  phone: string;
  email: string;
  password: string;
  otpTicket: string;
}

export async function signup(
  input: SignupInput,
): Promise<{ user: SafeUser } & TokenPair> {
  const ticket = verifyOtpTicket(input.otpTicket);
  if (ticket.phone !== input.phone || ticket.purpose !== OtpPurpose.SIGNUP) {
    throw new AppError('OTP_TICKET_INVALID');
  }

  const [existingPhone, existingEmail] = await Promise.all([
    prisma.user.findUnique({ where: { phone: input.phone } }),
    prisma.user.findUnique({ where: { email: input.email } }),
  ]);
  if (existingPhone) throw new AppError('PHONE_ALREADY_REGISTERED');
  if (existingEmail) throw new AppError('EMAIL_ALREADY_REGISTERED');

  const passwordHash = await hashSecret(input.password);
  const upiId = await generateUniqueUpiId(input.name);

  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        passwordHash,
        upiId,
      },
    });
    await tx.wallet.create({ data: { userId: created.id, balance: 0 } });
    return created;
  });

  const tokens = await issueTokenPair(user.id);
  return { user: toSafeUser(user), ...tokens };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(
  identifier: string,
  password: string,
): Promise<{ user: SafeUser } & TokenPair> {
  const isEmail = identifier.includes('@');
  const user = await prisma.user.findUnique({
    where: isEmail ? { email: identifier.toLowerCase() } : { phone: identifier },
  });

  // Deliberately identical error for "no such user" and "wrong password" —
  // distinguishing them would let an attacker enumerate registered phones/emails.
  if (!user) {
    throw new AppError('INVALID_CREDENTIALS');
  }
  const passwordMatches = await verifySecret(user.passwordHash, password);
  if (!passwordMatches) {
    throw new AppError('INVALID_CREDENTIALS');
  }

  const tokens = await issueTokenPair(user.id);
  return { user: toSafeUser(user), ...tokens };
}

export async function loginWithOtp(
  phone: string,
  otpTicket: string,
): Promise<{ user: SafeUser } & TokenPair> {
  const ticket = verifyOtpTicket(otpTicket);
  if (ticket.phone !== phone || ticket.purpose !== OtpPurpose.LOGIN) {
    throw new AppError('OTP_TICKET_INVALID');
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    throw new AppError('USER_NOT_FOUND');
  }

  const tokens = await issueTokenPair(user.id);
  return { user: toSafeUser(user), ...tokens };
}

// ---------------------------------------------------------------------------
// Token refresh / logout
// ---------------------------------------------------------------------------

export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revoked || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
    throw new AppError('REFRESH_TOKEN_REVOKED');
  }

  // Rotation: the presented refresh token is single-use. Revoking it here
  // means a stolen-and-replayed old token fails, limiting the blast radius
  // of a leaked refresh token to a single use.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  return issueTokenPair(payload.sub);
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revoked: false },
      data: { revoked: true },
    });
  } catch {
    // Malformed token, already revoked, or not found — logout is idempotent
    // from the client's perspective either way, so we don't surface an error.
  }
}

// ---------------------------------------------------------------------------
// UPI PIN
// ---------------------------------------------------------------------------

export async function setPin(userId: string, pin: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.pinHash) {
    throw new AppError('PIN_ALREADY_SET');
  }
  const pinHash = await hashSecret(pin);
  await prisma.user.update({ where: { id: userId }, data: { pinHash } });
}

export async function changePin(userId: string, currentPin: string, newPin: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.pinHash) {
    throw new AppError('PIN_NOT_SET');
  }
  const matches = await verifySecret(user.pinHash, currentPin);
  if (!matches) {
    throw new AppError('INVALID_PIN');
  }
  const pinHash = await hashSecret(newPin);
  await prisma.user.update({ where: { id: userId }, data: { pinHash } });
}

/**
 * Verifies a UPI PIN for an already-authenticated user. Exported for reuse
 * by the payments module (Phase 8+) — every payment flow calls this exact
 * function before moving money, rather than re-implementing PIN checks.
 * Throws PIN_NOT_SET or INVALID_PIN; callers only need to handle the
 * success path.
 */
export async function verifyPin(userId: string, pin: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.pinHash) {
    throw new AppError('PIN_NOT_SET');
  }
  const matches = await verifySecret(user.pinHash, pin);
  if (!matches) {
    throw new AppError('INVALID_PIN');
  }
}

export async function getSafeUserById(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return toSafeUser(user);
}
// Note: kept as a thin wrapper (rather than re-exporting user.service.getProfile
// directly) so auth.controller's import surface doesn't change — but it now
// shares the exact same `toSafeUser` implementation, so there's no risk of
// the two modules' "profile" shapes drifting apart.
