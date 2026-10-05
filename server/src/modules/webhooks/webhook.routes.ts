import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import * as controller from './webhook.controller';

const router = Router();

router.post('/payment', asyncHandler(controller.paymentWebhookHandler));

export default router;