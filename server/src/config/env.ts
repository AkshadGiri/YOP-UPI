import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable the server reads is declared here, once.
 * Nothing else in the codebase should touch `process.env` directly — import
 * `env` from this file instead. This gives us:
 *   1. A single source of truth for what config the app needs.
 *   2. A loud, early failure (at boot) if something required is missing or
 *      malformed, instead of a confusing runtime error deep in a request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),

  DEMO_MODE: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

  DEV_MOCK_OTP: z.string().default('123456'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  PAYMENT_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(20),

  PAYMENT_MODE: z.enum(['mock', 'live']).default('mock'),
  PSP_PROVIDER_NAME: z.string().optional().default(''),
  PSP_API_BASE_URL: z.string().optional().default(''),
  PSP_API_KEY: z.string().optional().default(''),
  PSP_API_SECRET: z.string().optional().default(''),
  PSP_WEBHOOK_SECRET: z.string().optional().default(''),

  CORS_ALLOWED_ORIGINS: z.string().default(''),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment variables:');
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables — see above for details.');
  }

  const data = parsed.data;

  // Cross-field guard: never allow live payments without real PSP credentials.
  if (data.PAYMENT_MODE === 'live') {
    const missing = ['PSP_API_BASE_URL', 'PSP_API_KEY', 'PSP_API_SECRET', 'PSP_WEBHOOK_SECRET'].filter(
      (key) => !data[key as keyof typeof data],
    );
    if (missing.length > 0) {
      throw new Error(
        `PAYMENT_MODE=live requires PSP credentials. Missing: ${missing.join(', ')}`,
      );
    }
  }
  if (data.PAYMENT_MODE === 'live' && data.DEMO_MODE) {
    throw new Error(
      'DEMO_MODE=true and PAYMENT_MODE=live cannot both be set — demo data must never be treated as real money.',
    );
  }

  return {
    ...data,
    corsAllowedOrigins: data.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  };
}

export const env = loadEnv();
export type Env = typeof env;
