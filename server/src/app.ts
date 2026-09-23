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

/**
 * Express application assembly.
 *
 * This file only wires up global middleware and mounts module routers.
 * Business logic lives inside /modules/*, never here.
 */
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

  // Module routers mounted here as later phases add them, e.g.:
  // app.use('/api/payments', paymentRouter);
  // app.use('/api/transactions', transactionRouter);
  // app.use('/api/qr', qrRouter);
  // app.use('/api/webhooks', webhookRouter);

  app.use((_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // Must be last: Express identifies error middleware by its 4th argument.
  app.use(errorHandler);

  return app;
}
