import { LedgerDirection, ParticipantType, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { generateTransactionId } from '../utils/id';

/**
 * A source or destination for a transfer. `id` refers to a Wallet.id or
 * BankAccount.id depending on `type`; EXTERNAL_BANK_ACCOUNT has no
 * internal row at all — it describes a bank account not on this platform
 * (used by Phase 10's bank transfer, when paying someone who isn't a
 * registered user).
 */
export type EngineParticipant =
  | { type: 'WALLET'; id: string }
  | { type: 'BANK_ACCOUNT'; id: string }
  | { type: 'EXTERNAL_BANK_ACCOUNT'; accountNumber: string; ifsc: string; accountHolder: string };

export interface ExecuteTransferInput {
  type: TransactionType;
  userId: string; // the authenticated caller who initiated this
  senderId: string | null; // the party losing money (usually === userId)
  receiverId: string | null; // the party gaining money (null if destination is external)
  /**
   * A decimal-formatted string, e.g. "500" or "499.50" — never a JS
   * number. Callers validate this shape with Zod before it reaches here;
   * the engine re-validates defensively (see below). Keeping money as a
   * string end-to-end, only ever converted via `new Prisma.Decimal(...)`,
   * means no amount is ever round-tripped through IEEE-754 floating point
   * anywhere in the payment path.
   */
  amount: string;
  description?: string;
  source: EngineParticipant;
  destination: EngineParticipant;
  provider?: string;
}

export interface ExecuteTransferResult {
  transactionId: string; // human-facing TXN_... id
  transactionDbId: string;
  sourceBalanceAfter: string;
  destinationBalanceAfter: string | null; // null when destination is external
}

/**
 * The single engine every payment type routes through — P2P, bank
 * transfer, self transfer, wallet transfer, QR payment, and add money all
 * call this rather than each reimplementing debit/credit/ledger logic.
 * Full write-up in docs/ARCHITECTURE.md → "Transaction flow"; summary:
 *
 * - One Postgres transaction wraps the whole operation (debit, credit,
 *   Transaction row, ledger row(s)). Any failure rolls back everything —
 *   there is no partial-payment state, ever.
 * - The source debit is a single guarded conditional UPDATE
 *   (`WHERE balance >= amount`), not a separate read-then-write. This is
 *   what makes it safe against two concurrent requests overdrawing the
 *   same wallet or bank account.
 * - WalletLedger rows are only written for WALLET participants (bank
 *   accounts don't have their own ledger table — their `balance` field is
 *   the only record, consistent with the schema). Ledger
 *   balanceBefore/After are derived from the actual post-update balance,
 *   not a value read moments earlier, so they're correct even under
 *   concurrent activity on the same wallet.
 * - This function only throws before any row is written (mainly
 *   INSUFFICIENT_BALANCE) — there is deliberately no FAILED Transaction
 *   row created for a same-request failure the caller can just retry.
 *   FAILED is reserved for the async-provider path (Phase 14/15), where a
 *   transaction can legitimately move INITIATED -> PROCESSING -> FAILED
 *   well after this function has already returned SUCCESS for the
 *   internal leg of the payment.
 *
 * IMPORTANT — this function does NOT check authorization. It trusts the
 * caller to have already verified the source/destination actually belong
 * to who they should (e.g. "this bank account belongs to userId"). Mixing
 * that check in here would make the engine's contract fuzzy across very
 * different call sites (Phase 8's mobile payment, Phase 9's self
 * transfer, etc. all have different ownership rules). Every module
 * calling this must verify ownership itself first.
 */
export async function executeTransfer(input: ExecuteTransferInput): Promise<ExecuteTransferResult> {
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lessThanOrEqualTo(0)) {
    throw new AppError('VALIDATION_ERROR', 'Amount must be greater than zero');
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const sourceBalanceAfter = await debitParticipant(tx, input.source, amount);
    const destinationBalanceAfter = await creditParticipant(tx, input.destination, amount);

    const transaction = await tx.transaction.create({
      data: {
        transactionId: generateTransactionId(),
        type: input.type,
        status: TransactionStatus.SUCCESS,
        amount,
        description: input.description,
        userId: input.userId,
        senderId: input.senderId,
        receiverId: input.receiverId,
        sourceType: input.source.type as ParticipantType,
        sourceId: input.source.type !== 'EXTERNAL_BANK_ACCOUNT' ? input.source.id : null,
        destinationType: input.destination.type as ParticipantType,
        destinationId: input.destination.type !== 'EXTERNAL_BANK_ACCOUNT' ? input.destination.id : null,
        destinationAccountNumber:
          input.destination.type === 'EXTERNAL_BANK_ACCOUNT' ? input.destination.accountNumber : null,
        destinationIfsc: input.destination.type === 'EXTERNAL_BANK_ACCOUNT' ? input.destination.ifsc : null,
        destinationAccountHolder:
          input.destination.type === 'EXTERNAL_BANK_ACCOUNT' ? input.destination.accountHolder : null,
        provider: input.provider ?? 'mock',
      },
    });

    if (input.source.type === 'WALLET') {
      await tx.walletLedger.create({
        data: {
          walletId: input.source.id,
          transactionId: transaction.id,
          type: input.type,
          direction: LedgerDirection.DEBIT,
          amount,
          balanceBefore: sourceBalanceAfter.plus(amount),
          balanceAfter: sourceBalanceAfter,
        },
      });
    }
    if (input.destination.type === 'WALLET' && destinationBalanceAfter) {
      await tx.walletLedger.create({
        data: {
          walletId: input.destination.id,
          transactionId: transaction.id,
          type: input.type,
          direction: LedgerDirection.CREDIT,
          amount,
          balanceBefore: destinationBalanceAfter.minus(amount),
          balanceAfter: destinationBalanceAfter,
        },
      });
    }

    return {
      transactionId: transaction.transactionId,
      transactionDbId: transaction.id,
      sourceBalanceAfter: sourceBalanceAfter.toString(),
      destinationBalanceAfter: destinationBalanceAfter ? destinationBalanceAfter.toString() : null,
    };
  });
}

async function debitParticipant(
  tx: Prisma.TransactionClient,
  participant: EngineParticipant,
  amount: Prisma.Decimal,
): Promise<Prisma.Decimal> {
  if (participant.type === 'WALLET') {
    const result = await tx.wallet.updateMany({
      where: { id: participant.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (result.count === 0) throw new AppError('INSUFFICIENT_BALANCE');
    // Safe to read back within the same transaction: the UPDATE above holds
    // this row's lock until COMMIT, so no concurrent transaction could have
    // changed it between the write and this read — we're reading our own
    // just-committed-within-this-transaction value.
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: participant.id } });
    return wallet.balance;
  }

  if (participant.type === 'BANK_ACCOUNT') {
    const result = await tx.bankAccount.updateMany({
      where: { id: participant.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (result.count === 0) throw new AppError('INSUFFICIENT_BALANCE');
    const account = await tx.bankAccount.findUniqueOrThrow({ where: { id: participant.id } });
    return account.balance;
  }

  // EXTERNAL_BANK_ACCOUNT can never be a debit source in this codebase —
  // you can't take money out of an account you don't hold internally.
  throw new AppError('VALIDATION_ERROR', 'Cannot debit an external account');
}

async function creditParticipant(
  tx: Prisma.TransactionClient,
  participant: EngineParticipant,
  amount: Prisma.Decimal,
): Promise<Prisma.Decimal | null> {
  if (participant.type === 'WALLET') {
    const wallet = await tx.wallet.update({
      where: { id: participant.id },
      data: { balance: { increment: amount } },
    });
    return wallet.balance;
  }

  if (participant.type === 'BANK_ACCOUNT') {
    const account = await tx.bankAccount.update({
      where: { id: participant.id },
      data: { balance: { increment: amount } },
    });
    return account.balance;
  }

  // EXTERNAL_BANK_ACCOUNT — nothing internal to credit. This is exactly
  // where a real PSP call would happen (Phase 14); for now the money
  // simply leaves the internal ledger, consistent with this being a demo
  // rather than a real bank rail (see README.md's "UPI-style" framing).
  return null;
}
