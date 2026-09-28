import { createHmac } from 'node:crypto';
import { env } from '../config/env';

/**
 * How long a dynamic (fixed-amount) QR stays valid. Static QRs (no amount)
 * never expire — they're just an identity, like a printed shop QR.
 */
export const DYNAMIC_QR_TTL_SECONDS = 15 * 60;

/**
 * Signing key for dynamic QRs. Derived from JWT_ACCESS_SECRET with a fixed
 * domain-separation label, so a QR signature can never be confused with (or
 * used to forge) an access token, and there is no extra env var to set.
 * Rotating JWT_ACCESS_SECRET invalidates any outstanding dynamic QR — which
 * is harmless, since they expire after 15 minutes anyway.
 */
const QR_SIGNING_KEY = createHmac('sha256', env.JWT_ACCESS_SECRET)
  .update('upi-demo-qr-signing-v1')
  .digest();

export const QR_CURRENCY = 'INR';

/**
 * The exact string that gets signed. `pn` (display name) is deliberately
 * excluded: the payer's screen shows the name from OUR database, never the
 * name printed in the QR, so tampering with `pn` gains an attacker nothing.
 * What must be tamper-proof is who gets paid, how much, and until when.
 */
export function canonicalQrString(fields: {
  upiId: string;
  amount: string;
  currency: string;
  expiresAtUnix: number;
}): string {
  return [fields.upiId.toLowerCase(), fields.amount, fields.currency, String(fields.expiresAtUnix)].join('|');
}

export function signQrFields(fields: Parameters<typeof canonicalQrString>[0]): string {
  // 32 hex chars = 128 bits of the HMAC — plenty for a 15-minute-lived token,
  // and keeps the QR small enough to scan reliably.
  return createHmac('sha256', QR_SIGNING_KEY).update(canonicalQrString(fields)).digest('hex').slice(0, 32);
}

/** encodeURIComponent, but keeping '@' literal so `pa=rahul@demo` matches the standard UPI look. */
function encodeParam(value: string): string {
  return encodeURIComponent(value).replace(/%40/g, '@');
}

export interface BuildQrInput {
  upiId: string;
  name: string;
  /** Decimal string like "500" or "499.50". Omit for a static QR. */
  amount?: string;
}

export interface BuiltQr {
  uri: string;
  /** null for static QRs, which never expire. */
  expiresAt: Date | null;
}

/**
 * Builds the `upi://pay?...` URI.
 *
 *   Static:   upi://pay?pa=rahul@demo&pn=Rahul&cu=INR
 *   Dynamic:  upi://pay?pa=rahul@demo&pn=Rahul&am=500&cu=INR&exp=1790000000&sig=<hex>
 *
 * The static form is exactly the format in the project spec and is
 * indistinguishable from what any external QR generator would produce, so
 * hand-made QRs keep working. Only the dynamic form carries `exp` and
 * `sig`: that's the case where the amount is fixed by the receiver, so it
 * must not be editable by the payer and must not live forever.
 */
export function buildUpiUri(input: BuildQrInput, now: Date = new Date()): BuiltQr {
  const pa = input.upiId.toLowerCase();
  const parts = [`pa=${encodeParam(pa)}`, `pn=${encodeParam(input.name)}`];

  if (input.amount === undefined) {
    parts.push(`cu=${QR_CURRENCY}`);
    return { uri: `upi://pay?${parts.join('&')}`, expiresAt: null };
  }

  const expiresAtUnix = Math.floor(now.getTime() / 1000) + DYNAMIC_QR_TTL_SECONDS;
  const sig = signQrFields({
    upiId: pa,
    amount: input.amount,
    currency: QR_CURRENCY,
    expiresAtUnix,
  });

  parts.push(`am=${input.amount}`, `cu=${QR_CURRENCY}`, `exp=${expiresAtUnix}`, `sig=${sig}`);
  return { uri: `upi://pay?${parts.join('&')}`, expiresAt: new Date(expiresAtUnix * 1000) };
}
