import winston from 'winston';
import { env } from '../config/env';

// Fields that must never appear in logs, in any form.
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'pin',
  'pinHash',
  'newPin',
  'currentPin',
  'otp',
  'code',
  'codeHash',
  'token',
  'accessToken',
  'refreshToken',
  'idempotencyKey',
  'authorization',
  'secret',
]);

/**
 * Recursively redacts sensitive keys from an object before it's logged.
 * Used by the request logger and error handler — nothing should log raw
 * request bodies or headers without going through this first.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redact(val, depth + 1);
    }
  }
  return result;
}

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === 'development' ? winston.format.simple() : winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});
