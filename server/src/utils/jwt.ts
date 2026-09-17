import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { env } from '../config/env';
import { AppError } from './AppError';
import type { OtpPurpose } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string; // User.id
}

export interface RefreshTokenPayload {
  sub: string; // User.id
}

export interface OtpTicketPayload {
  phone: string;
  purpose: OtpPurpose;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload & jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('TOKEN_EXPIRED');
    }
    throw new AppError('TOKEN_INVALID');
  }
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload & jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('TOKEN_EXPIRED');
    }
    throw new AppError('TOKEN_INVALID');
  }
}

/**
 * Refresh tokens are stored in the database as a hash, never in plaintext —
 * mirroring how passwords/PINs are handled. Unlike argon2 (deliberately
 * slow, for low-entropy secrets a human might type), this is a fast SHA-256
 * hash, which is appropriate here because a refresh token is a
 * high-entropy, randomly-signed value, not something brute-forceable the
 * way a 4-digit PIN is.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Short-lived signed ticket proving a phone number just passed OTP
 * verification for a specific purpose (SIGNUP/LOGIN/...). Uses a secret
 * distinct from the access/refresh token secrets, so compromising one
 * token type doesn't implicate the others. The endpoint that consumes this
 * (e.g. POST /api/auth/signup) re-checks both `phone` and `purpose` match
 * what it expects — a login ticket can't be replayed to complete a signup.
 */
export function signOtpTicket(payload: OtpTicketPayload): string {
  return jwt.sign(payload, env.OTP_TICKET_SECRET, { expiresIn: '10m' });
}

export function verifyOtpTicket(token: string): OtpTicketPayload {
  try {
    return jwt.verify(token, env.OTP_TICKET_SECRET) as OtpTicketPayload & jwt.JwtPayload;
  } catch {
    throw new AppError('OTP_TICKET_INVALID');
  }
}
