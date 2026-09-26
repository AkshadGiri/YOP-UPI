import { BankAccount } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { maskAccountNumber } from '../../utils/upi';

/**
 * The public-safe shape of a BankAccount — the raw `accountNumber` never
 * leaves this module. Every response (list, single, after add, after
 * update) goes through this, so there's no code path that accidentally
 * leaks a full account number to the client (Section 5 of the spec).
 */
export type SafeBankAccount = {
  id: string;
  bankName: string;
  accountHolderName: string;
  maskedAccountNumber: string;
  ifsc: string;
  balance: string; // Prisma Decimal serialized as string to avoid float precision issues over JSON
  isPrimary: boolean;
  createdAt: Date;
};

function toSafeAccount(account: BankAccount): SafeBankAccount {
  return {
    id: account.id,
    bankName: account.bankName,
    accountHolderName: account.accountHolderName,
    maskedAccountNumber: maskAccountNumber(account.accountNumber),
    ifsc: account.ifsc,
    balance: account.balance.toString(),
    isPrimary: account.isPrimary,
    createdAt: account.createdAt,
  };
}

export async function listAccounts(userId: string): Promise<SafeBankAccount[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
  return accounts.map(toSafeAccount);
}

/**
 * Fetches one account, scoped to the owner. Returns ACCOUNT_NOT_FOUND (not
 * FORBIDDEN) if it exists but belongs to someone else — this deliberately
 * doesn't distinguish "doesn't exist" from "isn't yours" to an attacker
 * probing IDs.
 */
async function getOwnedAccountOrThrow(userId: string, accountId: string): Promise<BankAccount> {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account || account.userId !== userId) {
    throw new AppError('ACCOUNT_NOT_FOUND');
  }
  return account;
}

export async function getAccount(userId: string, accountId: string): Promise<SafeBankAccount> {
  const account = await getOwnedAccountOrThrow(userId, accountId);
  return toSafeAccount(account);
}

/**
 * Returns the raw (unmasked-internally, not serialized) primary BankAccount
 * row for a user, or null if they have none. Exported for the payments
 * module (Phase 8+) — every payment type that settles via bank account
 * needs "the sender's/receiver's primary account", not the masked
 * client-facing shape.
 */
export async function getPrimaryAccountForUser(userId: string): Promise<BankAccount | null> {
  return prisma.bankAccount.findFirst({ where: { userId, isPrimary: true } });
}

/** Same as above, but throws if the user has no primary account. */
export async function getPrimaryAccountOrThrow(
  userId: string,
  errorCode: 'ACCOUNT_NOT_FOUND' | 'RECEIVER_ACCOUNT_NOT_FOUND' = 'ACCOUNT_NOT_FOUND',
): Promise<BankAccount> {
  const account = await getPrimaryAccountForUser(userId);
  if (!account) {
    throw new AppError(errorCode);
  }
  return account;
}

export interface AddAccountInput {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
}

export async function addAccount(userId: string, input: AddAccountInput): Promise<SafeBankAccount> {
  const existing = await prisma.bankAccount.findUnique({
    where: { userId_accountNumber: { userId, accountNumber: input.accountNumber } },
  });
  if (existing) {
    throw new AppError('ACCOUNT_ALREADY_EXISTS');
  }

  const existingCount = await prisma.bankAccount.count({ where: { userId } });
  // The very first account a user adds is automatically primary — there's
  // always exactly one primary account once at least one account exists,
  // so there's no "no primary selected" state to handle elsewhere.
  const isPrimary = existingCount === 0;

  const account = await prisma.bankAccount.create({
    data: {
      userId,
      bankName: input.bankName,
      accountHolderName: input.accountHolderName,
      accountNumber: input.accountNumber,
      ifsc: input.ifsc.toUpperCase(),
      balance: 0,
      isPrimary,
    },
  });

  return toSafeAccount(account);
}

/**
 * Sets an account as primary, atomically un-setting whichever account was
 * primary before. Never leaves zero or more than one primary account for a
 * user with at least one account.
 */
export async function setPrimaryAccount(userId: string, accountId: string): Promise<SafeBankAccount> {
  const account = await getOwnedAccountOrThrow(userId, accountId);

  if (account.isPrimary) {
    return toSafeAccount(account);
  }

  const [, updated] = await prisma.$transaction([
    prisma.bankAccount.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.bankAccount.update({
      where: { id: accountId },
      data: { isPrimary: true },
    }),
  ]);

  return toSafeAccount(updated);
}

/**
 * Removes a bank account. A primary account can't be removed while other
 * accounts exist — the caller must set a different account as primary
 * first, so there's never an ambiguous "which account is primary now"
 * moment. Removing your only account is allowed (falls back to wallet-only).
 */
export async function removeAccount(userId: string, accountId: string): Promise<void> {
  const account = await getOwnedAccountOrThrow(userId, accountId);

  if (account.isPrimary) {
    const otherAccountsCount = await prisma.bankAccount.count({
      where: { userId, id: { not: accountId } },
    });
    if (otherAccountsCount > 0) {
      throw new AppError('CANNOT_REMOVE_PRIMARY_ACCOUNT');
    }
  }

  await prisma.bankAccount.delete({ where: { id: accountId } });
}
