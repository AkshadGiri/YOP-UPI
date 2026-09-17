import argon2 from 'argon2';
import { env } from '../config/env';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: env.ARGON2_MEMORY_COST,
  timeCost: env.ARGON2_TIME_COST,
  parallelism: env.ARGON2_PARALLELISM,
};

/**
 * Hashes a password or UPI PIN with argon2id. The same function serves both
 * because the algorithm choice doesn't depend on what's being hashed — but
 * callers should never mix up which hash they're comparing against (see
 * `verifySecret` below and how auth.service.ts calls it).
 */
export async function hashSecret(plainText: string): Promise<string> {
  return argon2.hash(plainText, ARGON2_OPTIONS);
}

export async function verifySecret(hash: string, plainText: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainText);
  } catch {
    // Malformed hash, mismatched algorithm, etc. — treat as "doesn't match"
    // rather than letting the exception bubble up as a 500.
    return false;
  }
}
