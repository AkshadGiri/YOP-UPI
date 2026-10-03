import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { idempotencyGuard } from '../../services/idempotency';
import * as controller from './payment.controller';
import {
  bankTransferSchema,
  payByQrSchema,
  payMobileSchema,
  resolveMobileQuerySchema,
  selfTransferSchema,
} from './payment.validation';

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

router.post(
  '/bank',
  validate(bankTransferSchema),
  idempotencyGuard('POST /api/payments/bank'),
  asyncHandler(controller.bankTransferHandler),
);

// Phase 12 — QR payment
router.post(
  '/qr',
  validate(payByQrSchema),
  idempotencyGuard('POST /api/payments/qr'),
  asyncHandler(controller.payByQrHandler),
);

export default router;