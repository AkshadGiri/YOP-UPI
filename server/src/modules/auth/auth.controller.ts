import { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import * as authService from './auth.service';

export async function requestOtpHandler(req: Request, res: Response): Promise<void> {
  const { phone, purpose } = req.body;
  const result = await authService.requestOtp(phone, purpose);
  res.json({ success: true, data: result });
}

export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
  const { phone, purpose, code } = req.body;
  const result = await authService.verifyOtpAndIssueTicket(phone, purpose, code);
  res.json({ success: true, data: result });
}

export async function signupHandler(req: Request, res: Response): Promise<void> {
  const result = await authService.signup(req.body);
  res.status(201).json({ success: true, data: result });
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { identifier, password } = req.body;
  const result = await authService.login(identifier, password);
  res.json({ success: true, data: result });
}

export async function loginWithOtpHandler(req: Request, res: Response): Promise<void> {
  const { phone, otpTicket } = req.body;
  const result = await authService.loginWithOtp(phone, otpTicket);
  res.json({ success: true, data: result });
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  const result = await authService.refreshTokens(refreshToken);
  res.json({ success: true, data: result });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  res.json({ success: true, data: { loggedOut: true } });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  const user = await authService.getSafeUserById(req.user.id);
  res.json({ success: true, data: { user } });
}

export async function setPinHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  await authService.setPin(req.user.id, req.body.pin);
  res.json({ success: true, data: { pinSet: true } });
}

export async function changePinHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  await authService.changePin(req.user.id, req.body.currentPin, req.body.newPin);
  res.json({ success: true, data: { pinChanged: true } });
}

export async function verifyPinHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('UNAUTHORIZED');
  await authService.verifyPin(req.user.id, req.body.pin);
  res.json({ success: true, data: { valid: true } });
}
