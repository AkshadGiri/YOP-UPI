import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { authenticate } from '../../middleware/auth';
import * as controller from './transaction.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(controller.listTransactionsHandler));
router.get('/:transactionId', asyncHandler(controller.getTransactionDetailHandler));

export default router;
