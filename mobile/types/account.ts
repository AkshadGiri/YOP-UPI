export interface SafeBankAccount {
  id: string;
  bankName: string;
  accountHolderName: string;
  maskedAccountNumber: string;
  ifsc: string;
  balance: string;
  isPrimary: boolean;
  createdAt: string;
}
