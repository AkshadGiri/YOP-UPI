import QRCode from 'qrcode';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { buildUpiUri, QR_CURRENCY, signQrFields } from '../../utils/qrPayload';

export interface GeneratedQr {
  uri: string;
  qrDataUrl: string;
  upiId: string;
  name: string;
  amount: string | null;
  currency: string;
  expiresAt: Date | null;
}

export interface GenerateQrInput {
  amount?: string;
}

export async function generateQr(userId: string, input: GenerateQrInput): Promise<GeneratedQr> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const { uri, expiresAt } = buildUpiUri({
    upiId: user.upiId,
    name: user.name,
    amount: input.amount,
  });

  const qrDataUrl = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
  });

  return {
    uri,
    qrDataUrl,
    upiId: user.upiId,
    name: user.name,
    amount: input.amount ?? null,
    currency: QR_CURRENCY,
    expiresAt,
  };
}

export interface ResolvedQr {
  upiId: string;
  name: string;
  /** Amount locked in the QR. null = static QR, payer must enter amount. */
  amount: string | null;
  currency: string;
  /** null = static QR (never expires). */
  expiresAt: Date | null;
  /** Internal user id of the recipient — used by payByQr. */
  recipientUserId: string;
}

/**
 * Parses and validates a scanned UPI URI (Phase 12).
 *
 * Checks:
 *  - URI format and required params (pa)
 *  - Signature on dynamic QRs (amount locked in by receiver — tamper-proof)
 *  - Expiry on dynamic QRs
 *  - Recipient exists on this platform
 */
export async function resolveQr(uri: string): Promise<ResolvedQr> {
  if (!uri.startsWith('upi://pay?')) {
    throw new AppError('INVALID_QR', 'Unsupported QR format');
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(uri.slice('upi://pay?'.length));
  } catch {
    throw new AppError('INVALID_QR', 'Could not parse QR parameters');
  }

  const pa = params.get('pa');
  const pn = params.get('pn');
  const am = params.get('am') ?? undefined;
  const cu = params.get('cu') ?? QR_CURRENCY;
  const exp = params.get('exp');
  const sig = params.get('sig');

  if (!pa) {
    throw new AppError('INVALID_QR', 'QR is missing payment address (pa)');
  }

  // Dynamic QR — must have exp + sig, and both must be valid
  let expiresAt: Date | null = null;
  if (am !== undefined) {
    if (!exp || !sig) {
      throw new AppError('INVALID_QR', 'Dynamic QR is missing expiry or signature');
    }

    const expiresAtUnix = Number(exp);
    if (!Number.isFinite(expiresAtUnix)) {
      throw new AppError('INVALID_QR', 'QR expiry is invalid');
    }

    if (Date.now() / 1000 > expiresAtUnix) {
      throw new AppError('QR_EXPIRED');
    }

    const expectedSig = signQrFields({
      upiId: pa.toLowerCase(),
      amount: am,
      currency: cu,
      expiresAtUnix,
    });

    if (sig !== expectedSig) {
      throw new AppError('INVALID_QR', 'QR signature is invalid');
    }

    expiresAt = new Date(expiresAtUnix * 1000);
  }

  const recipient = await prisma.user.findUnique({
    where: { upiId: pa.toLowerCase() },
  });

  if (!recipient) {
    throw new AppError('USER_NOT_FOUND', `No user found for UPI ID: ${pa}`);
  }

  return {
    upiId: recipient.upiId,
    name: pn ?? recipient.name,
    amount: am ?? null,
    currency: cu,
    expiresAt,
    recipientUserId: recipient.id,
  };
}