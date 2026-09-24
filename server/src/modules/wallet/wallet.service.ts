import { LedgerDirection, Prisma, TransactionType, Wallet } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { executeTransfer } from '../../services/transactionEngine';

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

export interface WalletOperationResult {
  wallet: SafeWallet;
  transactionId: string;
}

/**
 * Confirms a bank account exists and belongs to `userId`. Both addMoney
 * and withdraw need this exact check before calling the engine — the
 * engine itself doesn't do authorization (see transactionEngine.ts).
 */
async function getOwnedAccountOrThrow(userId: string, bankAccountId: string) {
  const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!account || account.userId !== userId) {
    throw new AppError('ACCOUNT_NOT_FOUND');
  }
  return account;
}

export interface AddMoneyInput {
  bankAccountId: string;
  amount: string;
}

/**
 * Tops up the wallet from one of the user's own bank accounts. Thin
 * wrapper around the central transaction engine (Phase 7) — all the
 * atomicity/race-safety/ledger-accuracy logic lives there now, generalized
 * across every payment type rather than duplicated per module.
 */
export async function addMoney(userId: string, input: AddMoneyInput): Promise<WalletOperationResult> {
  const account = await getOwnedAccountOrThrow(userId, input.bankAccountId);
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });

  const result = await executeTransfer({
    type: TransactionType.ADD_MONEY,
    userId,
    senderId: userId,
    receiverId: userId,
    amount: input.amount,
    description: `Added money from ${account.bankName}`,
    source: { type: 'BANK_ACCOUNT', id: account.id },
    destination: { type: 'WALLET', id: wallet.id },
  });

  return {
    wallet: {
      id: wallet.id,
      balance: result.destinationBalanceAfter as string,
      createdAt: wallet.createdAt,
    },
    transactionId: result.transactionId,
  };
}

export interface WithdrawInput {
  bankAccountId: string;
  amount: string;
}

/**
 * Moves money the other direction: wallet -> the user's own bank account
 * (Section 6's "Wallet → bank transfer" feature). Not to be confused with
 * Phase 9's "Self Transfer", which is bank-account-to-bank-account — this
 * is wallet-to-bank, a different pair of participants entirely.
 */
export async function withdraw(userId: string, input: WithdrawInput): Promise<WalletOperationResult> {
  const account = await getOwnedAccountOrThrow(userId, input.bankAccountId);
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });

  const result = await executeTransfer({
    type: TransactionType.WALLET_TRANSFER,
    userId,
    senderId: userId,
    receiverId: userId,
    amount: input.amount,
    description: `Withdrawn to ${account.bankName}`,
    source: { type: 'WALLET', id: wallet.id },
    destination: { type: 'BANK_ACCOUNT', id: account.id },
  });

  return {
    wallet: { id: wallet.id, balance: result.sourceBalanceAfter, createdAt: wallet.createdAt },
    transactionId: result.transactionId,
  };
}
