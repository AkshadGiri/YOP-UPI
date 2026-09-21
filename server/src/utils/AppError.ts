/**
 * Central error-code catalog (Section 21 of the spec).
 *
 * Every code maps to a default HTTP status and message. Business logic
 * throws `new AppError('INVALID_PIN')` (optionally overriding the message)
 * and the error middleware (`middleware/errorHandler.ts`) turns it into the
 * standard `{ success: false, error: { code, message } }` envelope.
 *
 * New modules add their codes here rather than inventing ad-hoc strings, so
 * the whole API has one consistent vocabulary of failure modes.
 */
export const ErrorCatalog = {
  // Generic / cross-cutting
  VALIDATION_ERROR: { status: 400, message: 'Request validation failed' },
  UNAUTHORIZED: { status: 401, message: 'Authentication required' },
  FORBIDDEN: { status: 403, message: 'You are not allowed to perform this action' },
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  RATE_LIMITED: { status: 429, message: 'Too many requests, please try again later' },
  INTERNAL_ERROR: { status: 500, message: 'Something went wrong' },

  // Auth
  PHONE_ALREADY_REGISTERED: { status: 409, message: 'Phone number is already registered' },
  EMAIL_ALREADY_REGISTERED: { status: 409, message: 'Email is already registered' },
  INVALID_CREDENTIALS: { status: 401, message: 'Invalid phone/email or password' },
  INVALID_OTP: { status: 400, message: 'Invalid OTP code' },
  OTP_EXPIRED: { status: 400, message: 'OTP has expired, please request a new one' },
  OTP_MAX_ATTEMPTS_EXCEEDED: { status: 429, message: 'Too many incorrect OTP attempts' },
  OTP_TICKET_INVALID: { status: 400, message: 'OTP verification has expired, please verify again' },
  TOKEN_INVALID: { status: 401, message: 'Invalid or malformed token' },
  TOKEN_EXPIRED: { status: 401, message: 'Session expired, please log in again' },
  REFRESH_TOKEN_REVOKED: { status: 401, message: 'This session has been logged out' },
  PIN_ALREADY_SET: { status: 409, message: 'UPI PIN is already set, use change PIN instead' },
  PIN_NOT_SET: { status: 400, message: 'UPI PIN has not been set yet' },
  INVALID_PIN: { status: 400, message: 'Incorrect UPI PIN' },
  PIN_LOCKED: { status: 429, message: 'Too many incorrect PIN attempts, try again later' },

  // Users / accounts
  USER_NOT_FOUND: { status: 404, message: 'User not found' },
  ACCOUNT_NOT_FOUND: { status: 404, message: 'Bank account not found' },
  ACCOUNT_ALREADY_EXISTS: { status: 409, message: 'This bank account is already added' },
  INVALID_IFSC: { status: 400, message: 'Invalid IFSC code' },
  CANNOT_REMOVE_PRIMARY_ACCOUNT: {
    status: 400,
    message: 'Set another account as primary before removing this one',
  },

  // Payments / transactions (used starting Phase 7+)
  INSUFFICIENT_BALANCE: { status: 400, message: 'Insufficient balance' },
  INVALID_QR: { status: 400, message: 'Invalid or unsupported QR code' },
  QR_EXPIRED: { status: 400, message: 'This QR code has expired' },
  TRANSACTION_FAILED: { status: 400, message: 'Transaction failed' },
  TRANSACTION_NOT_FOUND: { status: 404, message: 'Transaction not found' },
  DUPLICATE_TRANSACTION: { status: 409, message: 'Duplicate transaction request' },
  SELF_TRANSFER_SAME_ACCOUNT: {
    status: 400,
    message: 'Source and destination accounts must be different',
  },
} as const;

export type ErrorCode = keyof typeof ErrorCatalog;

/**
 * Application-level error. Thrown anywhere in business logic; caught by the
 * global error middleware and translated into the standard response
 * envelope. Never thrown with sensitive data (PIN/password/OTP/token
 * values) in `details` — that middleware may log `details` for debugging.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, messageOverride?: string, details?: unknown) {
    const catalogEntry = ErrorCatalog[code];
    super(messageOverride ?? catalogEntry.message);
    this.name = 'AppError';
    this.code = code;
    this.status = catalogEntry.status;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}
