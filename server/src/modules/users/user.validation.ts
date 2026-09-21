import { z } from 'zod';

/**
 * Every field optional (it's a partial update), but at least one must be
 * present — an empty PATCH body is almost certainly a client bug, not a
 * legitimate no-op request.
 *
 * profilePictureUrl deliberately isn't validated as a strict URL: the
 * mobile client may send a local file URI (file://...) or a data URI, not
 * just an https:// link. `null` is allowed explicitly, to support removing
 * a profile picture.
 */
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is too short').max(60, 'Name is too long').optional(),
    email: z.string().trim().toLowerCase().email('Enter a valid email address').optional(),
    profilePictureUrl: z.string().min(1).max(4096).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });
