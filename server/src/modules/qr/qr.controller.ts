import { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import * as qrService from './qr.service';

export async function generateQrHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const qr = await qrService.generateQr(req.user.id, req.body);
  res.json({ success: true, data: { qr } });
}
