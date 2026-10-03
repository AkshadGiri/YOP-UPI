import { TransactionType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { executeTransfer } from '../../services/transactionEngine';
import { maskAccountNumber } from '../../utils/upi';
import { verifyPin } from '../auth/auth.service';
import { getOwnedAccountOrThrow, getPrimaryAccountOrThrow } from '../accounts/account.service';
import { resolveQr } from '../qr/qr.service';

export interface RecipientPreview {
  name: string;
  upiId: string;
  profilePictureUrl: string | null;
}

export async function resolveMobileRecipient(mobile: string): Promise<RecipientPreview> {
  const user = await prisma.user.findUnique({ where: { phone: mobile } });
  if (!user) throw new AppError('USER_NOT_FOUND');
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

export async function payByMobile(userId: string, input: PayByMobileInput): Promise<PaymentResult> {
  await verifyPin(userId, input.pin);

  const sender = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (sender.phone === input.mobile) throw new AppError('CANNOT_PAY_SELF');

  const receiver = await prisma.user.findUnique({ where: { phone: input.mobile } });
  if (!receiver) throw new AppError('USER_NOT_FOUND');

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

export async function selfTransfer(userId: string, input: SelfTransferInput): Promise<SelfTransferResult> {
  if (input.fromAccountId === input.toAccountId) throw new AppError('SELF_TRANSFER_SAME_ACCOUNT');
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

export interface BankTransferInput {
  accountNumber: string;
  ifsc: string;
  accountHolderName: string;
  amount: string;
  pin: string;
}

export interface BankTransferResult {
  transactionId: string;
  amount: string;
  senderBalanceAfter: string;
  destination: {
    accountHolderName: string;
    maskedAccountNumber: string;
    isRegisteredAccount: boolean;
  };
}

export async function bankTransfer(userId: string, input: BankTransferInput): Promise<BankTransferResult> {
  await verifyPin(userId, input.pin);

  const senderAccount = await getPrimaryAccountOrThrow(userId, 'ACCOUNT_NOT_FOUND');

  const ownAccountMatch = await prisma.bankAccount.findFirst({
    where: { userId, accountNumber: input.accountNumber, ifsc: input.ifsc },
  });
  if (ownAccountMatch) throw new AppError('CANNOT_TRANSFER_TO_OWN_ACCOUNT');

  const registeredDestination = await prisma.bankAccount.findFirst({
    where: { accountNumber: input.accountNumber, ifsc: input.ifsc },
  });

  const result = await executeTransfer({
    type: TransactionType.BANK_TRANSFER,
    userId,
    senderId: userId,
    receiverId: registeredDestination?.userId ?? null,
    amount: input.amount,
    description: `Bank transfer to ${input.accountHolderName}`,
    source: { type: 'BANK_ACCOUNT', id: senderAccount.id },
    destination: registeredDestination
      ? { type: 'BANK_ACCOUNT', id: registeredDestination.id }
      : {
          type: 'EXTERNAL_BANK_ACCOUNT',
          accountNumber: input.accountNumber,
          ifsc: input.ifsc,
          accountHolder: input.accountHolderName,
        },
  });

  return {
    transactionId: result.transactionId,
    amount: input.amount,
    senderBalanceAfter: result.sourceBalanceAfter,
    destination: {
      accountHolderName: input.accountHolderName,
      maskedAccountNumber: maskAccountNumber(input.accountNumber),
      isRegisteredAccount: registeredDestination !== null,
    },
  };
}

export interface PayByQrInput {
  uri: string;
  /** Required only for static QRs (no amount baked in). Ignored for dynamic QRs. */
  amount?: string;
  pin: string;
}

export interface PayByQrResult {
  transactionId: string;
  amount: string;
  recipient: { name: string; upiId: string };
  senderBalanceAfter: string;
}

/**
 * Pays via a scanned QR code (Phase 12).
 *
 * Amount precedence: QR-baked amount > caller-supplied amount.
 * If neither present, throws VALIDATION_ERROR.
 * Cannot pay yourself via QR.
 */
export async function payByQr(userId: string, input: PayByQrInput): Promise<PayByQrResult> {
  // Resolve first — expiry/signature checked before PIN is verified
  const resolved = await resolveQr(input.uri);

  if (resolved.recipientUserId === userId) {
    throw new AppError('CANNOT_PAY_SELF');
  }

  const finalAmount = resolved.amount ?? input.amount;
  if (!finalAmount) {
    throw new AppError('VALIDATION_ERROR', 'Enter an amount to pay');
  }

  await verifyPin(userId, input.pin);

  const senderAccount = await getPrimaryAccountOrThrow(userId, 'ACCOUNT_NOT_FOUND');
  const receiverAccount = await getPrimaryAccountOrThrow(
    resolved.recipientUserId,
    'RECEIVER_ACCOUNT_NOT_FOUND',
  );

  const result = await executeTransfer({
    type: TransactionType.QR_PAYMENT,
    userId,
    senderId: userId,
    receiverId: resolved.recipientUserId,
    amount: finalAmount,
    description: `QR payment to ${resolved.name}`,
    source: { type: 'BANK_ACCOUNT', id: senderAccount.id },
    destination: { type: 'BANK_ACCOUNT', id: receiverAccount.id },
  });

  return {
    transactionId: result.transactionId,
    amount: finalAmount,
    recipient: { name: resolved.name, upiId: resolved.upiId },
    senderBalanceAfter: result.sourceBalanceAfter,
  };
}