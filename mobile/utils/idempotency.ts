/**
 * Generates a client-side idempotency key for a single logical action
 * (e.g. "user tapped Add Money once"). Attached as the `Idempotency-Key`
 * header so a retried request (flaky network, accidental double-tap)
 * doesn't create a duplicate transaction — see the server's
 * services/idempotency.ts for the full behavior.
 *
 * Just needs to be unique per action, not cryptographically unguessable,
 * so Math.random + timestamp is fine here — no extra dependency needed for
 * a real UUID generator.
 */
export function generateIdempotencyKey(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${random}`;
}
