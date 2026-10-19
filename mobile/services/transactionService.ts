import { api } from './api';

export interface TransactionListItem {
  id: string;
  transactionId: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  description: string | null;
  direction: 'DEBIT' | 'CREDIT' | 'SELF';
  counterpartyName: string | null;
  counterpartyUpiId: string | null;
  createdAt: string;
}

export interface TransactionListResult {
  transactions: TransactionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TransactionDetail {
  id: string;
  transactionId: string;
  referenceId: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  description: string | null;
  direction: 'DEBIT' | 'CREDIT' | 'SELF';
  sender: { name: string; upiId: string } | null;
  receiver: { name: string; upiId: string } | null;
  destination: {
    accountHolderName: string;
    maskedAccountNumber: string;
    ifsc: string;
  } | null;
  provider: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface TransactionFilters {
  status?: string;
  type?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export async function listTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionListResult> {
  const res = await api.get<SuccessEnvelope<TransactionListResult>>('/transactions', {
    params: filters,
  });
  return res.data.data;
}

export async function getTransactionDetail(transactionId: string): Promise<TransactionDetail> {
  const res = await api.get<SuccessEnvelope<TransactionDetail>>(
    `/transactions/${transactionId}`,
  );
  return res.data.data;
}