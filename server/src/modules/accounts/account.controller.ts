import { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import * as accountService from './account.service';

export async function listAccountsHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const accounts = await accountService.listAccounts(req.user.id);
  res.json({ success: true, data: { accounts } });
}

export async function getAccountHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const account = await accountService.getAccount(req.user.id, req.params.id);
  res.json({ success: true, data: { account } });
}

export async function addAccountHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const account = await accountService.addAccount(req.user.id, req.body);
  res.status(201).json({ success: true, data: { account } });
}

export async function setPrimaryHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const account = await accountService.setPrimaryAccount(req.user.id, req.params.id);
  res.json({ success: true, data: { account } });
}

export async function removeAccountHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  await accountService.removeAccount(req.user.id, req.params.id);
  res.json({ success: true, data: { removed: true } });
}
