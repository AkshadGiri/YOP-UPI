import { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import * as qrService from './qr.service';

export async function generateQrHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const result = await qrService.generateQr(req.user.id, req.body);
  res.json({ success: true, data: result });
}

export async function resolveQrHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const { uri } = req.body as { uri: string };
  const result = await qrService.resolveQr(uri);
  res.json({ success: true, data: result });
}