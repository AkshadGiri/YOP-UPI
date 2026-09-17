import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authRateLimiter, otpRequestRateLimiter } from '../../middleware/rateLimiter';
import * as controller from './auth.controller';
import {
  changePinSchema,
  loginSchema,
  logoutSchema,
  otpLoginSchema,
  refreshSchema,
  requestOtpSchema,
  setPinSchema,
  signupSchema,
  verifyOtpSchema,
  verifyPinSchema,
} from './auth.validation';

const router = Router();

// --- OTP ---------------------------------------------------------------
router.post(
  '/otp/request',
  otpRequestRateLimiter,
  validate(requestOtpSchema),
  asyncHandler(controller.requestOtpHandler),
);
router.post(
  '/otp/verify',
  authRateLimiter,
  validate(verifyOtpSchema),
  asyncHandler(controller.verifyOtpHandler),
);

// --- Signup / Login ------------------------------------------------------
router.post('/signup', authRateLimiter, validate(signupSchema), asyncHandler(controller.signupHandler));
router.post('/login', authRateLimiter, validate(loginSchema), asyncHandler(controller.loginHandler));
router.post(
  '/login/otp',
  authRateLimiter,
  validate(otpLoginSchema),
  asyncHandler(controller.loginWithOtpHandler),
);

// --- Session ---------------------------------------------------------
router.post('/refresh', authRateLimiter, validate(refreshSchema), asyncHandler(controller.refreshHandler));
router.post('/logout', validate(logoutSchema), asyncHandler(controller.logoutHandler));
router.get('/me', authenticate, asyncHandler(controller.meHandler));

// --- UPI PIN (all require a valid access token) -------------------------
router.post('/pin/set', authenticate, validate(setPinSchema), asyncHandler(controller.setPinHandler));
router.post(
  '/pin/change',
  authenticate,
  validate(changePinSchema),
  asyncHandler(controller.changePinHandler),
);
router.post(
  '/pin/verify',
  authenticate,
  validate(verifyPinSchema),
  asyncHandler(controller.verifyPinHandler),
);

export default router;
