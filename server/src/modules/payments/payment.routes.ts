import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { idempotencyGuard } from '../../services/idempotency';
import * as controller from './payment.controller';
import { payMobileSchema, resolveMobileQuerySchema, selfTransferSchema } from './payment.validation';

const router = Router();

router.use(authenticate);

router.get(
  '/resolve/mobile',
  validate(resolveMobileQuerySchema, 'query'),
  asyncHandler(controller.resolveMobileHandler),
);

router.post(
  '/mobile',
  validate(payMobileSchema),
  idempotencyGuard('POST /api/payments/mobile'),
  asyncHandler(controller.payMobileHandler),
);

router.post(
  '/self',
  validate(selfTransferSchema),
  idempotencyGuard('POST /api/payments/self'),
  asyncHandler(controller.selfTransferHandler),
);

export default router;
