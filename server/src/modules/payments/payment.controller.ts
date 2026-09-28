import { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import * as paymentService from './payment.service';

export async function resolveMobileHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const mobile = req.query.mobile as string;
  const recipient = await paymentService.resolveMobileRecipient(mobile);
  res.json({ success: true, data: { recipient } });
}

export async function payMobileHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const result = await paymentService.payByMobile(req.user.id, req.body);
  res.status(201).json({ success: true, data: result });
}

export async function selfTransferHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const result = await paymentService.selfTransfer(req.user.id, req.body);
  res.status(201).json({ success: true, data: result });
}

export async function bankTransferHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const result = await paymentService.bankTransfer(req.user.id, req.body);
  res.status(201).json({ success: true, data: result });
}
