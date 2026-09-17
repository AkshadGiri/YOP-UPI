import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

/**
 * Express application assembly.
 *
 * This file only wires up global middleware and top-level routes.
 * Business logic lives inside /modules/*, never here.
 *
 * NOTE: This is the Phase 1 scaffold. Auth middleware, module routers,
 * centralized error handling, and rate limiting are added in later phases
 * (see README.md status checklist). Kept intentionally minimal for now so
 * the server can boot and be verified end-to-end before more is layered on.
 */
export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        demoMode: process.env.DEMO_MODE === 'true',
        paymentMode: process.env.PAYMENT_MODE ?? 'mock',
      },
    });
  });

  // Module routers are mounted here starting Phase 3 (auth), e.g.:
  // app.use('/api/auth', authRouter);
  // app.use('/api/users', userRouter);
  // app.use('/api/accounts', accountRouter);
  // app.use('/api/wallet', walletRouter);
  // app.use('/api/payments', paymentRouter);
  // app.use('/api/transactions', transactionRouter);
  // app.use('/api/qr', qrRouter);
  // app.use('/api/webhooks', webhookRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  return app;
}
