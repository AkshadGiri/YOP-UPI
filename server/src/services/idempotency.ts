import { createHash } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { IdempotencyStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/asyncHandler';

const IDEMPOTENCY_RECORD_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredResponse {
  status: number;
  data: unknown;
}

/**
 * Backs the `Idempotency-Key` header (Section 15 of the spec) for a given
 * endpoint. Mount this AFTER request validation, so a malformed request
 * never reserves a key — only requests that pass validation are worth
 * protecting against duplication.
 *
 * Behavior:
 *   - No `Idempotency-Key` header present -> no protection, request
 *     proceeds normally. The header is opt-in, not mandatory, per spec.
 *   - Key seen before, same request body, previous attempt succeeded ->
 *     the original response is replayed verbatim. No new transaction is
 *     created; the client gets back exactly what it got the first time.
 *   - Key seen before, but the request body differs -> IDEMPOTENCY_KEY_REUSED.
 *     Reusing a key for a genuinely different request is a client bug.
 *   - Key seen before, previous attempt is still in flight (a concurrent
 *     duplicate request) -> DUPLICATE_TRANSACTION. The first request
 *     hasn't finished yet, so there's nothing to replay.
 *   - Key not seen before -> reserved as PROCESSING, request proceeds. The
 *     response is captured and persisted once it's sent (see below).
 *
 * Known limitation (acceptable for a demo project): if the process
 * crashes between reserving the key and the response finishing, the
 * PROCESSING record is never finalized and that key is stuck until its
 * `expiresAt`. A production system would want a periodic sweep to release
 * stale PROCESSING records well before their TTL; not implemented here.
 */
export function idempotencyGuard(endpoint: string) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) throw new AppError('UNAUTHORIZED');
    const userId = req.user.id;

    const key = req.header('Idempotency-Key');
    if (!key) {
      next();
      return;
    }

    const requestHash = createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex');

    const existing = await prisma.idempotencyRecord.findUnique({
      where: { userId_key_endpoint: { userId, key, endpoint } },
    });

    if (existing) {
      if (existing.status === IdempotencyStatus.COMPLETED) {
        if (existing.requestHash !== requestHash) {
          throw new AppError('IDEMPOTENCY_KEY_REUSED');
        }
        const stored = existing.responseBody as unknown as StoredResponse | null;
        if (stored) {
          res.status(stored.status).json(stored.data);
          return;
        }
      }
      // status is PROCESSING (or COMPLETED with no stored body, which
      // shouldn't happen but is handled the same defensive way) — another
      // attempt with this exact key is already in flight.
      throw new AppError('DUPLICATE_TRANSACTION');
    }

    await prisma.idempotencyRecord.create({
      data: {
        userId,
        key,
        endpoint,
        requestHash,
        status: IdempotencyStatus.PROCESSING,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_RECORD_TTL_MS),
      },
    });

    // Capture the response body synchronously (cheap), then persist it
    // asynchronously once the response has actually been sent — standard
    // Express pattern for "do bookkeeping after the client already has
    // their answer" rather than adding latency to every payment request.
    let capturedBody: unknown;
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      capturedBody = body;
      return originalJson(body);
    }) as typeof res.json;

    res.on('finish', () => {
      void finalizeIdempotencyRecord(userId, key, endpoint, res.statusCode, capturedBody);
    });

    next();
  });
}

async function finalizeIdempotencyRecord(
  userId: string,
  key: string,
  endpoint: string,
  statusCode: number,
  body: unknown,
): Promise<void> {
  try {
    if (statusCode >= 200 && statusCode < 300) {
      await prisma.idempotencyRecord.update({
        where: { userId_key_endpoint: { userId, key, endpoint } },
        data: {
          status: IdempotencyStatus.COMPLETED,
          responseBody: { status: statusCode, data: body } as object,
        },
      });
    } else {
      // The request failed — release the key so the client can retry with
      // the same Idempotency-Key once they fix whatever caused the error.
      await prisma.idempotencyRecord.delete({
        where: { userId_key_endpoint: { userId, key, endpoint } },
      });
    }
  } catch (err) {
    logger.error('Failed to finalize idempotency record', {
      endpoint,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
