# Architecture

## System overview

A modular monolith, not microservices — appropriate for the scope and
timeline of this project while staying cleanly separated internally.

```
mobile (Expo/React Native)  --HTTPS/JSON-->  server (Express)  -->  PostgreSQL
                                                    |
                                                    +--> Redis (OTP, rate limits, idempotency)
                                                    |
                                                    +--> PaymentProvider adapter --> Mock (today) / Real PSP (future)
```

## Why a modular monolith

At this project's scale (a handful of related domains: auth, users,
accounts, wallet, payments, transactions, QR, webhooks), splitting into
separate services would add deployment and consistency overhead — most
notably it would make it much harder to keep financial state changes
atomic (see "Transaction correctness" below), since a single Postgres
transaction can't span services. A modular monolith keeps clear module
boundaries (`/server/src/modules/*`) so it could be decomposed later if
truly needed, without paying that cost now.

## Frontend architecture

_Filled in during Phase 3 onward as screens/features are added._

Planned layering inside `/mobile`:
- `app/` — routes only (Expo Router), no business logic
- `features/` — screen-level logic composed from services + store
- `components/` — dumb, reusable UI
- `services/` — Axios API client, one module per backend module
- `store/` — Zustand stores (auth session, UI state)
- `hooks/` — reusable hooks (e.g. `useBalance`, `usePinGate`)
- `utils/` — formatting, validation helpers
- `types/` — shared TypeScript types mirroring backend DTOs

## Backend architecture

_Filled in during Phase 2 onward._

Planned layering inside `/server/src`:
- `modules/<domain>/` — routes, controllers, module-specific validation
- `services/` — cross-cutting business logic (e.g. the central transaction
  engine used by every payment type)
- `middleware/` — auth, error handling, rate limiting
- `config/` — env parsing/validation, Prisma client singleton, Redis client

## Database schema

Full schema lives in `server/prisma/schema.prisma`. Summary of the 8 models
and why each exists:

| Model | Purpose |
|---|---|
| `User` | Identity, auth credentials (hashed), UPI ID, profile |
| `BankAccount` | A user's linked demo bank accounts; `balance` is a cache, not the ledger |
| `Wallet` | One per user; internal demo wallet balance (cache, not the ledger) |
| `WalletLedger` | The append-only source of truth for wallet balance changes — see below |
| `Transaction` | The single row every payment type writes through (P2P, bank transfer, self transfer, wallet transfer, QR, add money) |
| `IdempotencyRecord` | Backs the `Idempotency-Key` mechanism — see "Idempotency" below |
| `PaymentProviderTransaction` | Audit trail of provider order/payment IDs and raw webhook payloads |
| `Otp` | Hashed OTP codes with purpose, expiry, and attempt tracking |
| `RefreshToken` | Hashed refresh tokens for JWT session rotation (added alongside the core 8 models since it's needed by Phase 3 and is a schema change either way) |

### Why balances are a cache, not the truth

`Wallet.balance` and `BankAccount.balance` are denormalized current-state
fields — fast to read, but never the system of record. Every change to one
of these fields must be accompanied, in the same database transaction, by a
`WalletLedger` row recording `balanceBefore`/`balanceAfter` and the
`direction` (DEBIT/CREDIT). If the two ever disagree, the ledger wins — it's
what Phase 7's transaction engine reconciles against, and what an auditor
(or a bug report) would use to reconstruct what actually happened.

### Key relations

- `Transaction.userId` is always the authenticated caller (initiator).
  `senderId`/`receiverId` are the actual money-movement parties — usually
  the same as `userId` for a send, but kept separate because a transaction
  always has a clear "whose action was this" vs "whose balance changed"
  distinction, which matters once refunds/reversals exist.
- `Transaction.sourceType`/`sourceId` and `destinationType`/`destinationId`
  are polymorphic pointers (`WALLET` → `Wallet.id`, `BANK_ACCOUNT` →
  `BankAccount.id`, `EXTERNAL_BANK_ACCOUNT` → not on this platform, details
  in `destinationAccountNumber`/`destinationIfsc`/`destinationAccountHolder`).
- `IdempotencyRecord` has a compound unique constraint on
  `(userId, key, endpoint)` — the same key is safe to reuse across different
  endpoints, but replaying it against the same endpoint returns the
  original result instead of creating a second transaction.

### Indexes

Per the spec, indexes exist on: `User.phone`, `User.upiId`,
`Transaction.transactionId` (unique), `Transaction.userId`/`senderId`/
`receiverId`, `Transaction.createdAt`, `BankAccount.userId`,
`WalletLedger.walletId`/`transactionId`, `Otp.phone`, plus
`Transaction.status` (for filtering transaction history by
success/failed/pending) and `IdempotencyRecord.expiresAt` (for periodic
cleanup of expired records).

### Money type

All monetary fields use `Decimal(14, 2)`, never `Float` — floating point
arithmetic on money amounts is a classic source of off-by-a-paisa bugs.

## Payment flow

_Added in Phase 7 (central transaction engine) and expanded in Phases 8–10._

## QR flow

_Added in Phases 11–12._

## Wallet flow

_Added in Phase 6._

## Transaction flow

_Added in Phase 7._

## Security

_Expanded throughout, consolidated in Phase 16–17._

Baseline commitments (see also Section 20 of the original spec):
- Passwords and UPI PINs are hashed with argon2, never stored or logged in
  plaintext.
- JWT access + refresh tokens; refresh tokens are the only long-lived
  credential.
- All financial state changes happen inside a single Postgres transaction
  (BEGIN/COMMIT/ROLLBACK) — partial payments are structurally impossible.
- Every payment endpoint accepts an `Idempotency-Key` header; duplicate
  requests return the original transaction rather than creating a new one.
- Backend/provider confirmation is the sole source of truth for payment
  success — the frontend cannot mark a payment successful.

## Real payment integration strategy

**Today (demo mode):** `PAYMENT_MODE=mock` — `MockPaymentProvider` simulates
provider responses synchronously. No real money moves. This is the only
mode used with `DEMO_MODE=true`.

**Future (live mode):** `PAYMENT_MODE=live` — a `RealPaymentProvider`
implementing the same `PaymentProvider` interface
(`createPayment / verifyPayment / refundPayment / getPaymentStatus`) calls
an actual PSP's API using credentials from environment variables. Because
business logic (the transaction engine, ledger, controllers) only ever
calls the `PaymentProvider` interface — never a concrete provider — this
swap requires zero changes to payment business logic. Webhook signature
verification (Phase 15) is provider-specific and lives entirely inside the
adapter.

`DEMO_MODE=false` must never be run without real PSP credentials configured
and `PAYMENT_MODE=live` set explicitly — this is a deliberate two-flag gate
to avoid accidentally treating demo balances as real.
