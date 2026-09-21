import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import * as controller from './user.controller';
import { updateProfileSchema } from './user.validation';

const router = Router();

router.use(authenticate);

router.get('/profile', asyncHandler(controller.getProfileHandler));
router.patch('/profile', validate(updateProfileSchema), asyncHandler(controller.updateProfileHandler));

export default router;
