import { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import * as userService from './user.service';

export async function getProfileHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const user = await userService.getProfile(req.user.id);
  res.json({ success: true, data: { user } });
}

export async function updateProfileHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const user = await userService.updateProfile(req.user.id, req.body);
  res.json({ success: true, data: { user } });
}
