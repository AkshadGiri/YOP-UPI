import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { maskAccountNumber } from '../../utils/upi';

export interface TransactionFilters {
  status?: TransactionStatus;
  type?: TransactionType;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface TransactionListItem {
  id: string;
  transactionId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  currency: string;
  description: string | null;
  direction: 'DEBIT' | 'CREDIT' | 'SELF';
  counterpartyName: string | null;
  counterpartyUpiId: string | null;
  createdAt: Date;
}

export interface TransactionListResult {
  transactions: TransactionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Returns paginated transaction history for the authenticated user.
 * Includes all transactions where the user is initiator, sender, or receiver.
 * Supports filtering by status, type, date range, and free-text search.
 */
export async function listTransactions(
  userId: string,
  filters: TransactionFilters,
): Promise<TransactionListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    OR: [{ userId }, { senderId: userId }, { receiverId: userId }],
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.fromDate || filters.toDate) {
    where.createdAt = {
      ...(filters.fromDate ? { gte: new Date(filters.fromDate) } : {}),
      ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
    };
  }

  if (filters.search) {
    where.OR = [
      { transactionId: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { sender: { name: { contains: filters.search, mode: 'insensitive' } } },
      { receiver: { name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        sender: { select: { id: true, name: true, upiId: true } },
        receiver: { select: { id: true, name: true, upiId: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  const items: TransactionListItem[] = transactions.map((tx) => {
    let direction: 'DEBIT' | 'CREDIT' | 'SELF' = 'DEBIT';
    let counterpartyName: string | null = null;
    let counterpartyUpiId: string | null = null;

    if (tx.type === TransactionType.SELF_TRANSFER) {
      direction = 'SELF';
    } else if (tx.type === TransactionType.ADD_MONEY) {
      direction = 'CREDIT';
    } else if (tx.senderId === userId) {
      direction = 'DEBIT';
      counterpartyName = tx.receiver?.name ?? tx.destinationAccountHolder ?? null;
      counterpartyUpiId = tx.receiver?.upiId ?? null;
    } else if (tx.receiverId === userId) {
      direction = 'CREDIT';
      counterpartyName = tx.sender?.name ?? null;
      counterpartyUpiId = tx.sender?.upiId ?? null;
    }

    return {
      id: tx.id,
      transactionId: tx.transactionId,
      type: tx.type,
      status: tx.status,
      amount: tx.amount.toString(),
      currency: tx.currency,
      description: tx.description,
      direction,
      counterpartyName,
      counterpartyUpiId,
      createdAt: tx.createdAt,
    };
  });

  return {
    transactions: items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export interface TransactionDetail {
  id: string;
  transactionId: string;
  referenceId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  currency: string;
  description: string | null;
  direction: 'DEBIT' | 'CREDIT' | 'SELF';
  sender: { name: string; upiId: string } | null;
  receiver: { name: string; upiId: string } | null;
  destination: {
    accountHolderName: string;
    maskedAccountNumber: string;
    ifsc: string;
  } | null;
  provider: string;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Returns full detail for a single transaction.
 * Only accessible to the user who initiated, sent, or received it.
 */
export async function getTransactionDetail(
  userId: string,
  transactionId: string,
): Promise<TransactionDetail> {
  const tx = await prisma.transaction.findFirst({
    where: {
      transactionId,
      OR: [{ userId }, { senderId: userId }, { receiverId: userId }],
    },
    include: {
      sender: { select: { name: true, upiId: true } },
      receiver: { select: { name: true, upiId: true } },
    },
  });

  if (!tx) throw new AppError('TRANSACTION_NOT_FOUND');

  let direction: 'DEBIT' | 'CREDIT' | 'SELF' = 'DEBIT';
  if (tx.type === TransactionType.SELF_TRANSFER) {
    direction = 'SELF';
  } else if (tx.type === TransactionType.ADD_MONEY) {
    direction = 'CREDIT';
  } else if (tx.receiverId === userId && tx.senderId !== userId) {
    direction = 'CREDIT';
  }

  return {
    id: tx.id,
    transactionId: tx.transactionId,
    referenceId: tx.referenceId,
    type: tx.type,
    status: tx.status,
    amount: tx.amount.toString(),
    currency: tx.currency,
    description: tx.description,
    direction,
    sender: tx.sender ? { name: tx.sender.name, upiId: tx.sender.upiId } : null,
    receiver: tx.receiver ? { name: tx.receiver.name, upiId: tx.receiver.upiId } : null,
    destination:
      tx.destinationAccountNumber && tx.destinationIfsc && tx.destinationAccountHolder
        ? {
            accountHolderName: tx.destinationAccountHolder,
            maskedAccountNumber: maskAccountNumber(tx.destinationAccountNumber),
            ifsc: tx.destinationIfsc,
          }
        : null,
    provider: tx.provider,
    failureReason: tx.failureReason,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}