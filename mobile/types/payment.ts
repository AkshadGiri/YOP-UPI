export interface RecipientPreview {
  name: string;
  upiId: string;
  profilePictureUrl: string | null;
}

export interface PaymentResult {
  transactionId: string;
  amount: string;
  recipient: { name: string; upiId: string };
  senderBalanceAfter: string;
}

export interface SelfTransferResult {
  transactionId: string;
  amount: string;
  fromAccountBalanceAfter: string;
  toAccountBalanceAfter: string;
}
