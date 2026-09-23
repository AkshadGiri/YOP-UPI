import {
  LedgerDirection,
  ParticipantType,
  Prisma,
  TransactionStatus,
  TransactionType,
  Wallet,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { generateTransactionId } from '../../utils/id';

export type SafeWallet = {
  id: string;
  balance: string; // Decimal serialized as string — never a float over JSON
  createdAt: Date;
};

function toSafeWallet(wallet: Wallet): SafeWallet {
  return { id: wallet.id, balance: wallet.balance.toString(), createdAt: wallet.createdAt };
}

export async function getWallet(userId: string): Promise<SafeWallet> {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  return toSafeWallet(wallet);
}

export interface LedgerEntryView {
  id: string;
  type: TransactionType;
  direction: LedgerDirection;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  createdAt: Date;
  transactionId: string | null; // human-facing TXN_... id, not the DB cuid
  description: string | null;
}

export interface LedgerPage {
  entries: LedgerEntryView[];
  total: number;
  page: number;
  limit: number;
}

export async function getLedger(userId: string, page: number, limit: number): Promise<LedgerPage> {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });

  const [rows, total] = await prisma.$transaction([
    prisma.walletLedger.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { transaction: { select: { transactionId: true, description: true } } },
    }),
    prisma.walletLedger.count({ where: { walletId: wallet.id } }),
  ]);

  const entries: LedgerEntryView[] = rows.map(
    (row: Prisma.WalletLedgerGetPayload<{
      include: { transaction: { select: { transactionId: true; description: true } } };
    }>) => ({
      id: row.id,
      type: row.type,
      direction: row.direction,
      amount: row.amount.toString(),
      balanceBefore: row.balanceBefore.toString(),
      balanceAfter: row.balanceAfter.toString(),
      createdAt: row.createdAt,
      transactionId: row.transaction?.transactionId ?? null,
      description: row.transaction?.description ?? null,
    }),
  );

  return { entries, total, page, limit };
}

export interface AddMoneyInput {
  bankAccountId: string;
  amount: number;
}

export interface AddMoneyResult {
  wallet: SafeWallet;
  transactionId: string;
}

/**
 * Tops up the wallet from one of the user's own bank accounts: debits the
 * bank account, credits the wallet, and writes one Transaction row plus one
 * WalletLedger row — all inside a single database transaction, so a
 * failure at any step leaves both balances untouched (Section 14/21 of the
 * spec: no partial payments, ever).
 *
 * Two correctness patterns established here are reused by every future
 * money-moving operation (Phase 7's central transaction engine generalizes
 * this rather than reinventing it):
 *
 * 1. RACE-SAFE DEBIT: the bank account debit is a single conditional
 *    `UPDATE ... SET balance = balance - :amount WHERE id = :id AND
 *    balance >= :amount` (expressed here as `updateMany` with a `gte`
 *    filter). This makes the "is there enough balance" check and the
 *    debit itself one atomic operation — two concurrent requests against
 *    the same account can never both succeed and overdraw it, which a
 *    separate "read balance, check, then write" sequence would allow
 *    under concurrent load even inside a transaction.
 *
 * 2. ACCURATE LEDGER UNDER CONCURRENCY: rather than computing
 *    balanceBefore/balanceAfter from a balance read moments earlier (which
 *    could already be stale if another request interleaved), the wallet
 *    credit uses an atomic `increment` and then derives balanceBefore from
 *    the *returned* post-update balance (`balanceAfter - amount`). The
 *    returned value is guaranteed correct at the instant of that specific
 *    update, so the derived balanceBefore is too — even under concurrent
 *    top-ups hitting the same wallet.
 */
export async function addMoney(userId: string, input: AddMoneyInput): Promise<AddMoneyResult> {
  const amount = new Prisma.Decimal(input.amount);

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const account = await tx.bankAccount.findUnique({ where: { id: input.bankAccountId } });
    if (!account || account.userId !== userId) {
      throw new AppError('ACCOUNT_NOT_FOUND');
    }

    const debitResult = await tx.bankAccount.updateMany({
      where: { id: account.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (debitResult.count === 0) {
      throw new AppError('INSUFFICIENT_BALANCE');
    }

    const wallet = await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });
    const balanceAfter = wallet.balance;
    const balanceBefore = balanceAfter.minus(amount);

    const transaction = await tx.transaction.create({
      data: {
        transactionId: generateTransactionId(),
        type: TransactionType.ADD_MONEY,
        status: TransactionStatus.SUCCESS,
        amount,
        description: `Added money from ${account.bankName}`,
        userId,
        senderId: userId,
        receiverId: userId,
        sourceType: ParticipantType.BANK_ACCOUNT,
        sourceId: account.id,
        destinationType: ParticipantType.WALLET,
        destinationId: wallet.id,
        provider: 'mock',
      },
    });

    await tx.walletLedger.create({
      data: {
        walletId: wallet.id,
        transactionId: transaction.id,
        type: TransactionType.ADD_MONEY,
        direction: LedgerDirection.CREDIT,
        amount,
        balanceBefore,
        balanceAfter,
      },
    });

    return { wallet: toSafeWallet(wallet), transactionId: transaction.transactionId };
  });
}
