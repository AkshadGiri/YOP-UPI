import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches
 * `req.user = { id }` for downstream handlers. Every route under a module
 * that requires a logged-in user should have this in its middleware chain.
 *
 * Deliberately does NOT hit the database to check the user still exists on
 * every request — that's a latency cost paid on every authenticated call
 * for a case (user deleted mid-session) that doesn't exist in this app yet.
 * If user deletion/deactivation is added later, revisit this.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    next(new AppError('UNAUTHORIZED'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    next(err);
  }
}
