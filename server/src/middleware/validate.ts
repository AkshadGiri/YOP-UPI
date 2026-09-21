import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validates `req[target]` against a Zod schema, replacing it with the
 * parsed (and type-coerced) result on success. On failure, throws a
 * VALIDATION_ERROR AppError carrying the field-level Zod issues as
 * `details`, which the error handler surfaces to the client so the
 * frontend can show precise inline errors.
 *
 * Accepts `ZodTypeAny` rather than `AnyZodObject` so schemas built with
 * `.refine()`/`.transform()` (which return `ZodEffects`, not `ZodObject`)
 * work too — e.g. user.validation.ts's "at least one field" refinement.
 */
export function validate(schema: ZodTypeAny, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req[target] = schema.parse(req[target]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new AppError('VALIDATION_ERROR', undefined, err.flatten().fieldErrors));
        return;
      }
      next(err);
    }
  };
}
