import { prisma } from '../config/prisma';

/**
 * Turns a display name into a URL/UPI-ID-safe slug.
 * "Akshad Patil" -> "akshadpatil"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

/**
 * Generates a unique demo UPI ID of the form `name@demo`, appending a
 * numeric suffix on collision (rahul@demo, rahul1@demo, rahul2@demo, ...).
 *
 * This hits the database to check uniqueness, so it must be called before
 * the User row is created (e.g. inside the signup service), with the final
 * value passed into the create call — not computed inside a transaction
 * that also creates the row, to keep the retry loop simple.
 */
export async function generateUniqueUpiId(name: string): Promise<string> {
  const base = slugify(name) || 'user';
  let candidate = `${base}@demo`;
  let suffix = 0;

  // Bounded loop — a few hundred collisions on the same name is already an
  // unrealistic amount of demo data; this avoids any risk of an infinite loop.
  for (let attempts = 0; attempts < 1000; attempts += 1) {
    const existing = await prisma.user.findUnique({ where: { upiId: candidate } });
    if (!existing) {
      return candidate;
    }
    suffix += 1;
    candidate = `${base}${suffix}@demo`;
  }

  throw new Error(`Could not generate a unique UPI ID for base "${base}" after 1000 attempts`);
}

/**
 * Masks a bank account number for display, showing only the last 4 digits.
 * "50100123456789" -> "XXXX XXXX 6789"
 * Never send the full account number in a normal API response — this is the
 * only form BankAccount.accountNumber should take once it leaves the server,
 * except for the one-time confirmation step immediately after a user adds it.
 */
export function maskAccountNumber(accountNumber: string): string {
  const digitsOnly = accountNumber.replace(/\D/g, '');
  if (digitsOnly.length <= 4) {
    return `XXXX ${digitsOnly}`;
  }
  const last4 = digitsOnly.slice(-4);
  return `XXXX XXXX ${last4}`;
}

/**
 * Masks a phone number for display in contexts like search results,
 * showing country-code-agnostic last 4 digits only.
 * "9876543210" -> "XXXXXX3210"
 */
export function maskPhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length <= 4) {
    return digitsOnly;
  }
  const last4 = digitsOnly.slice(-4);
  return `${'X'.repeat(digitsOnly.length - 4)}${last4}`;
}
