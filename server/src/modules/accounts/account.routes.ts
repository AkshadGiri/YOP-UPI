import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import * as controller from './account.controller';
import { accountIdParamSchema, addAccountSchema } from './account.validation';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(controller.listAccountsHandler));
router.post('/', validate(addAccountSchema), asyncHandler(controller.addAccountHandler));

router.get(
  '/:id',
  validate(accountIdParamSchema, 'params'),
  asyncHandler(controller.getAccountHandler),
);
router.patch(
  '/:id/primary',
  validate(accountIdParamSchema, 'params'),
  asyncHandler(controller.setPrimaryHandler),
);
router.delete(
  '/:id',
  validate(accountIdParamSchema, 'params'),
  asyncHandler(controller.removeAccountHandler),
);

export default router;
