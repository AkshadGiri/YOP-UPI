import { router } from 'expo-router';
import { WalletTransferForm } from '../../components/WalletTransferForm';
import * as walletService from '../../services/walletService';

export default function WithdrawScreen() {
  return (
    <WalletTransferForm
      title="Withdraw"
      subtitle="Move money from your wallet back to a bank account"
      accountSectionLabel="To account"
      submitLabel="Withdraw"
      onSubmit={async (values) => {
        await walletService.withdraw(values);
        router.back();
      }}
    />
  );
}
