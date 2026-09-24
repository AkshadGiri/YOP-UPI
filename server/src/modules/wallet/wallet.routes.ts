import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { idempotencyGuard } from '../../services/idempotency';
import * as controller from './wallet.controller';
import { addMoneySchema, ledgerQuerySchema, withdrawSchema } from './wallet.validation';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(controller.getWalletHandler));
router.get('/ledger', validate(ledgerQuerySchema, 'query'), asyncHandler(controller.getLedgerHandler));

// Idempotency guard is mounted AFTER validation (a malformed request should
// never reserve an idempotency key) and BEFORE the controller.
router.post(
  '/add-money',
  validate(addMoneySchema),
  idempotencyGuard('POST /api/wallet/add-money'),
  asyncHandler(controller.addMoneyHandler),
);
router.post(
  '/withdraw',
  validate(withdrawSchema),
  idempotencyGuard('POST /api/wallet/withdraw'),
  asyncHandler(controller.withdrawHandler),
);

export default router;
