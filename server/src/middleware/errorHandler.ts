import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError, ErrorCatalog } from '../utils/AppError';
import { logger, redact } from '../utils/logger';

/**
 * Global error-handling middleware. Must be the LAST `app.use()` call in
 * app.ts (Express identifies error middleware by its 4-argument signature).
 *
 * Every response this emits follows the standard envelope:
 *   { success: false, error: { code, message } }
 *
 * Never includes stack traces or raw internals in the response body — those
 * go to the log only, and even there, request bodies are redacted first.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error(`[${err.code}] ${err.message}`, {
        path: req.path,
        body: redact(req.body),
      });
    }
    res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: ErrorCatalog.VALIDATION_ERROR.message,
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = unique constraint violation — the most common one we'd hit if
    // a race condition slips past an application-level uniqueness check.
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'A record with these details already exists' },
      });
      return;
    }
    logger.error(`Prisma error ${err.code}`, { path: req.path, meta: err.meta });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: ErrorCatalog.INTERNAL_ERROR.message },
    });
    return;
  }

  // Unknown/unexpected error — log full details server-side, never leak them.
  logger.error('Unhandled error', {
    path: req.path,
    error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    body: redact(req.body),
  });
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: ErrorCatalog.INTERNAL_ERROR.message },
  });
}
