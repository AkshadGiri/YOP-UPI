import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import { generalRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './modules/auth/auth.routes';
import userRouter from './modules/users/user.routes';
import accountRouter from './modules/accounts/account.routes';
import walletRouter from './modules/wallet/wallet.routes';
import paymentRouter from './modules/payments/payment.routes';
import qrRouter from './modules/qr/qr.routes';
import transactionRouter from './modules/transactions/transaction.routes';
import webhookRouter from './modules/webhooks/webhook.routes';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsAllowedOrigins.length > 0 ? env.corsAllowedOrigins : true,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use(generalRateLimiter);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        demoMode: env.DEMO_MODE,
        paymentMode: env.PAYMENT_MODE,
      },
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/accounts', accountRouter);
  app.use('/api/wallet', walletRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api/qr', qrRouter);
  app.use('/api/transactions', transactionRouter);
  app.use('/api/webhooks', webhookRouter);

  app.use((_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  app.use(errorHandler);

  return app;
}