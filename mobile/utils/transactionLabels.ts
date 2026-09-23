import type { TransactionType } from '../types/wallet';

const TYPE_LABELS: Record<TransactionType, string> = {
  P2P: 'Sent to contact',
  BANK_TRANSFER: 'Bank transfer',
  SELF_TRANSFER: 'Self transfer',
  WALLET_TRANSFER: 'Wallet transfer',
  QR_PAYMENT: 'QR payment',
  ADD_MONEY: 'Added money',
};

export function getTransactionTypeLabel(type: TransactionType): string {
  return TYPE_LABELS[type] ?? type;
}
