export interface GeneratedQr {
  uri: string;
  /** `data:image/png;base64,...` — render directly with <Image source={{ uri }} />. */
  qrDataUrl: string;
  upiId: string;
  name: string;
  amount: string | null;
  currency: string;
  /** ISO timestamp, or null for a static QR (which never expires). */
  expiresAt: string | null;
}
