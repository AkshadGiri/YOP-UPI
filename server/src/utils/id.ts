import { customAlphabet } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';

// Uppercase alphanumeric, unambiguous-ish alphabet for human-facing IDs.
const nanoidAlphaNum = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

/**
 * Generates a human-facing transaction ID, e.g. TXN_20260908_ABC234.
 * This is what's shown on receipts and in transaction history — it is NOT
 * the database primary key (that's a cuid on Transaction.id).
 */
export function generateTransactionId(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `TXN_${y}${m}${d}_${nanoidAlphaNum()}`;
}

/**
 * Generates an internal correlation/reference id (UUID v4), used for
 * matching provider callbacks/webhooks back to a transaction. Distinct from
 * transactionId so the human-facing ID format can change independently of
 * the correlation format providers see.
 */
export function generateReferenceId(): string {
  return uuidv4();
}

/**
 * Generates an idempotency-safe random key, useful for tests/mock clients
 * that need to produce an Idempotency-Key header.
 */
export function generateIdempotencyKey(): string {
  return uuidv4();
}
