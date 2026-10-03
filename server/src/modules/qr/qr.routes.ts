import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import * as controller from './qr.controller';
import { generateQrSchema, resolveQrSchema } from './qr.validation';

const router = Router();

router.use(authenticate);

// POST /api/qr/generate — generate caller's payment QR
router.post('/generate', validate(generateQrSchema), asyncHandler(controller.generateQrHandler));

// POST /api/qr/resolve — parse + validate a scanned QR URI
router.post('/resolve', validate(resolveQrSchema), asyncHandler(controller.resolveQrHandler));

export default router;