import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import * as controller from './wallet.controller';
import { addMoneySchema, ledgerQuerySchema } from './wallet.validation';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(controller.getWalletHandler));
router.get('/ledger', validate(ledgerQuerySchema, 'query'), asyncHandler(controller.getLedgerHandler));
router.post('/add-money', validate(addMoneySchema), asyncHandler(controller.addMoneyHandler));

export default router;
