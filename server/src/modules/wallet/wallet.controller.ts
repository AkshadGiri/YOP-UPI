import { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import * as walletService from './wallet.service';

export async function getWalletHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const wallet = await walletService.getWallet(req.user.id);
  res.json({ success: true, data: { wallet } });
}

export async function getLedgerHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await walletService.getLedger(req.user.id, page, limit);
  res.json({ success: true, data: result });
}

export async function addMoneyHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const result = await walletService.addMoney(req.user.id, req.body);
  res.status(201).json({ success: true, data: result });
}

export async function withdrawHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const result = await walletService.withdraw(req.user.id, req.body);
  res.status(201).json({ success: true, data: result });
}
