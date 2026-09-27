import { TransactionType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { executeTransfer } from '../../services/transactionEngine';
import { verifyPin } from '../auth/auth.service';
import { getOwnedAccountOrThrow, getPrimaryAccountOrThrow } from '../accounts/account.service';

export interface RecipientPreview {
  name: string;
  upiId: string;
  profilePictureUrl: string | null;
}

/**
 * Looks up a registered user by mobile number for the "Find User" step of
 * the pay-by-mobile flow (Section 8, step 1-3 of the spec). Returns only
 * public-safe fields — never the recipient's email or any account details.
 */
export async function resolveMobileRecipient(mobile: string): Promise<RecipientPreview> {
  const user = await prisma.user.findUnique({ where: { phone: mobile } });
  if (!user) {
    throw new AppError('USER_NOT_FOUND');
  }
  return { name: user.name, upiId: user.upiId, profilePictureUrl: user.profilePictureUrl };
}

export interface PayByMobileInput {
  mobile: string;
  amount: string;
  pin: string;
}

export interface PaymentResult {
  transactionId: string;
  amount: string;
  recipient: { name: string; upiId: string };
  senderBalanceAfter: string;
}

/**
 * Pays a registered user by their mobile number (Section 8 of the spec).
 *
 * Settles via bank accounts — the sender's primary account debits, the
 * receiver's primary account credits — mirroring how real UPI payments
 * move money between linked bank accounts. This is a deliberate design
 * choice to keep "UPI-style payments" (mobile/bank/self/QR, all
 * bank-account-settled) conceptually distinct from the app's own Wallet
 * feature (a separate prepaid-style balance with its own add-money/
 * withdraw). See docs/ARCHITECTURE.md → "Transaction flow" for the full
 * write-up.
 *
 * Order of checks matters here: PIN is verified first (Section 8, steps
 * 6-7) before any account lookups, so a wrong PIN never reveals anything
 * about whether the recipient exists or has a payable account.
 */
export async function payByMobile(userId: string, input: PayByMobileInput): Promise<PaymentResult> {
  await verifyPin(userId, input.pin);

  const sender = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (sender.phone === input.mobile) {
    throw new AppError('CANNOT_PAY_SELF');
  }

  const receiver = await prisma.user.findUnique({ where: { phone: input.mobile } });
  if (!receiver) {
    throw new AppError('USER_NOT_FOUND');
  }

  const senderAccount = await getPrimaryAccountOrThrow(userId, 'ACCOUNT_NOT_FOUND');
  const receiverAccount = await getPrimaryAccountOrThrow(receiver.id, 'RECEIVER_ACCOUNT_NOT_FOUND');

  const result = await executeTransfer({
    type: TransactionType.P2P,
    userId,
    senderId: userId,
    receiverId: receiver.id,
    amount: input.amount,
    description: `Paid to ${receiver.name}`,
    source: { type: 'BANK_ACCOUNT', id: senderAccount.id },
    destination: { type: 'BANK_ACCOUNT', id: receiverAccount.id },
  });

  return {
    transactionId: result.transactionId,
    amount: input.amount,
    recipient: { name: receiver.name, upiId: receiver.upiId },
    senderBalanceAfter: result.sourceBalanceAfter,
  };
}

export interface SelfTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  pin: string;
}

export interface SelfTransferResult {
  transactionId: string;
  amount: string;
  fromAccountBalanceAfter: string;
  toAccountBalanceAfter: string;
}

/**
 * Transfers money between two of the caller's own bank accounts (Section 9
 * of the spec / Section 10 of the original numbering). Both accounts are
 * verified to belong to the caller — this is the ownership check the
 * engine itself deliberately doesn't do (see transactionEngine.ts).
 */
export async function selfTransfer(userId: string, input: SelfTransferInput): Promise<SelfTransferResult> {
  if (input.fromAccountId === input.toAccountId) {
    throw new AppError('SELF_TRANSFER_SAME_ACCOUNT');
  }

  await verifyPin(userId, input.pin);

  const fromAccount = await getOwnedAccountOrThrow(userId, input.fromAccountId);
  const toAccount = await getOwnedAccountOrThrow(userId, input.toAccountId);

  const result = await executeTransfer({
    type: TransactionType.SELF_TRANSFER,
    userId,
    senderId: userId,
    receiverId: userId,
    amount: input.amount,
    description: `Self transfer: ${fromAccount.bankName} → ${toAccount.bankName}`,
    source: { type: 'BANK_ACCOUNT', id: fromAccount.id },
    destination: { type: 'BANK_ACCOUNT', id: toAccount.id },
  });

  return {
    transactionId: result.transactionId,
    amount: input.amount,
    fromAccountBalanceAfter: result.sourceBalanceAfter,
    toAccountBalanceAfter: result.destinationBalanceAfter as string,
  };
}
