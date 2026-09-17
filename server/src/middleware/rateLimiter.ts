import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { Request, Response } from 'express';
import { redis } from '../config/redis';
import { env } from '../config/env';

function jsonRateLimitHandler(_req: Request, res: Response) {
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  });
}

/** General-purpose limiter applied to the whole API. */
export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
  store: new RedisStore({
    // @ts-expect-error rate-limit-redis's types lag ioredis's call signature slightly
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: 'rl:general:',
  }),
});

/**
 * Stricter limiter for auth/OTP endpoints — these are the classic
 * brute-force / OTP-spam targets (credential stuffing, OTP flooding a
 * phone number, PIN guessing), so they get a tighter budget than the
 * general API.
 */
export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
  store: new RedisStore({
    // @ts-expect-error rate-limit-redis's types lag ioredis's call signature slightly
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: 'rl:auth:',
  }),
});

/** Even stricter limiter specifically for OTP requests, keyed by phone number below. */
export const otpRequestRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
  keyGenerator: (req: Request) => {
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : 'unknown';
    return `${req.ip}:${phone}`;
  },
  store: new RedisStore({
    // @ts-expect-error rate-limit-redis's types lag ioredis's call signature slightly
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: 'rl:otp:',
  }),
});
