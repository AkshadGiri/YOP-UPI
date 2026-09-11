import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Single shared PrismaClient instance.
 *
 * In development, `tsx watch` re-executes this module on every file change.
 * Without the globalThis cache below, that would create a new PrismaClient
 * (and a new DB connection pool) on every reload, eventually exhausting
 * Postgres's max_connections. Stashing the instance on `globalThis` survives
 * the module re-evaluation.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
