import { User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';

/**
 * The public-safe shape of a User row — never includes passwordHash or
 * pinHash. Every place in the codebase that returns a user to the client
 * goes through `toSafeUser` so there's exactly one definition of "what a
 * user profile looks like over the API", not a divergent copy per module.
 */
export type SafeUser = Pick<
  User,
  'id' | 'name' | 'phone' | 'email' | 'upiId' | 'profilePictureUrl' | 'createdAt'
> & { pinSet: boolean };

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    upiId: user.upiId,
    profilePictureUrl: user.profilePictureUrl,
    createdAt: user.createdAt,
    pinSet: user.pinHash !== null,
  };
}

export async function getProfile(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return toSafeUser(user);
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  profilePictureUrl?: string | null;
}

/**
 * Updates the mutable parts of a profile. Phone number is deliberately NOT
 * editable here — it's tied to the user's identity/OTP verification at
 * signup, and other users may already have it saved for P2P payments, so
 * changing it needs its own dedicated (and OTP-reverified) flow if ever
 * added. Only name, email, and profile picture can change.
 */
export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<SafeUser> {
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing && existing.id !== userId) {
      throw new AppError('EMAIL_ALREADY_REGISTERED');
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.profilePictureUrl !== undefined ? { profilePictureUrl: input.profilePictureUrl } : {}),
    },
  });

  return toSafeUser(user);
}
