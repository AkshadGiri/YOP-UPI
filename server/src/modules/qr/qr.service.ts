import QRCode from 'qrcode';
import { prisma } from '../../config/prisma';
import { buildUpiUri, QR_CURRENCY } from '../../utils/qrPayload';

export interface GeneratedQr {
  /** The raw `upi://pay?...` string encoded in the QR. */
  uri: string;
  /** PNG of the QR as a `data:image/png;base64,...` URL, ready to drop into an <Image>. */
  qrDataUrl: string;
  upiId: string;
  name: string;
  /** null for a static QR. */
  amount: string | null;
  currency: string;
  /** null for a static QR, which never expires. */
  expiresAt: Date | null;
}

export interface GenerateQrInput {
  amount?: string;
}

/**
 * Generates the caller's payment QR. The UPI ID and name always come from
 * the authenticated user's own record — a client can't ask for a QR that
 * pays someone else, because there's no way to pass a different identity.
 *
 * Note this doesn't check whether the user has a bank account to actually
 * receive money into. A payer scanning the QR will get
 * RECEIVER_ACCOUNT_NOT_FOUND at payment time if not (same behavior as
 * pay-by-mobile) — generating the QR itself is harmless either way.
 */
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
