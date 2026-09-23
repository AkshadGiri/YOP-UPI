export interface SafeWallet {
  id: string;
  balance: string;
  createdAt: string;
}

export type LedgerDirection = 'DEBIT' | 'CREDIT';

export type TransactionType =
  'P2P' | 'BANK_TRANSFER' | 'SELF_TRANSFER' | 'WALLET_TRANSFER' | 'QR_PAYMENT' | 'ADD_MONEY';

export interface LedgerEntry {
  id: string;
  type: TransactionType;
  direction: LedgerDirection;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  createdAt: string;
  transactionId: string | null;
  description: string | null;
}

export interface LedgerPage {
  entries: LedgerEntry[];
  total: number;
  page: number;
  limit: number;
}
