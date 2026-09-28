import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import * as controller from './qr.controller';
import { generateQrSchema } from './qr.validation';

const router = Router();

router.use(authenticate);

// POST (not GET) because it takes a body, per the spec's `POST /api/qr/generate`.
// No idempotency guard: generating a QR moves no money and changes no state.
router.post('/generate', validate(generateQrSchema), asyncHandler(controller.generateQrHandler));

export default router;
