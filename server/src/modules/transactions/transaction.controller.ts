import { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import * as transactionService from './transaction.service';
import { TransactionStatus, TransactionType } from '@prisma/client';

export async function listTransactionsHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');

  const filters = {
    status: req.query.status as TransactionStatus | undefined,
    type: req.query.type as TransactionType | undefined,
    search: req.query.search as string | undefined,
    fromDate: req.query.fromDate as string | undefined,
    toDate: req.query.toDate as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  };

  const result = await transactionService.listTransactions(req.user.id, filters);
  res.json({ success: true, data: result });
}

export async function getTransactionDetailHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const { transactionId } = req.params;
  const result = await transactionService.getTransactionDetail(req.user.id, transactionId);
  res.json({ success: true, data: result });
}
