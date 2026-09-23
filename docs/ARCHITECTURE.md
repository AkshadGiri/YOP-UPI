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

Every user has exactly one `Wallet` (created at signup, Phase 3). Its
`balance` field is a cache — `WalletLedger` is the source of truth, per the
"Database schema" section above.

**Add money** (`POST /api/wallet/add-money`, Phase 6) is the only wallet
money-movement implemented so far: it debits a bank account and credits
the wallet, atomically, inside one database transaction. Two patterns
established here are reused by every later money-moving operation:

1. **Race-safe debit**: the bank account debit is one conditional
   `UPDATE ... WHERE balance >= :amount` (via Prisma's `updateMany` with a
   `gte` filter), not a separate "read balance, check, then write"
   sequence. Two concurrent requests against the same account can never
   both succeed and overdraw it.
2. **Ledger accuracy under concurrency**: rather than trusting a balance
   read from moments earlier, the wallet credit uses an atomic
   `increment`, then derives `balanceBefore` from the *returned*
   post-update balance (`balanceAfter - amount`). This is correct even if
   another request updated the same wallet in between the initiating read
   and the write.

"Pay using wallet", "Wallet → bank transfer", and "Wallet → user transfer"
(Section 6 of the spec) are deliberately **not** part of Phase 6 — they're
multi-party operations (a sender and a receiver, potentially different
users) that belong in the central transaction engine (Phase 7) so every
payment type shares one implementation of debit/credit/ledger/rollback,
rather than each wallet operation reinventing it slightly differently.

## Transaction flow

_Added in Phase 7._

## Security

### Password and PIN storage

Both are hashed with argon2id (`server/src/utils/crypto.ts`), tuned via
`ARGON2_MEMORY_COST`/`ARGON2_TIME_COST`/`ARGON2_PARALLELISM`. Neither is
ever stored, logged, or returned in an API response in plaintext — the
`SafeUser` shape returned to clients only exposes a `pinSet: boolean`, never
the hash or the PIN itself.

### JWT strategy

Two token types, two secrets:
- **Access token** (`JWT_ACCESS_SECRET`, default 15m expiry) — sent as
  `Authorization: Bearer <token>` on every authenticated request, verified
  by `middleware/auth.ts`. Stateless; not looked up in the database on each
  request (a deliberate latency/complexity trade-off — see the comment in
  `auth.ts`).
- **Refresh token** (`JWT_REFRESH_SECRET`, default 30d expiry) — used only
  to get a new access token via `POST /api/auth/refresh`. Its hash (SHA-256,
  not argon2 — see `utils/jwt.ts` for why a fast hash is appropriate here)
  is stored in the `RefreshToken` table, which is what makes revocation and
  rotation possible: a stateless JWT alone can't be revoked before it
  expires, but checking the database row can.

**Rotation:** every `/refresh` call revokes the presented refresh token and
issues a brand new one. A refresh token is effectively single-use. If a
stolen refresh token is replayed after the legitimate client already
rotated it, the replay fails (`REFRESH_TOKEN_REVOKED`) — this limits how
much damage a leaked refresh token can do.

**Mobile storage:** both tokens live in Expo SecureStore (Keychain/Keystore),
never AsyncStorage — see `mobile/utils/secureStorage.ts` and
`mobile/store/authStore.ts`.

### OTP verification tickets

A subtle trust problem: after OTP verification succeeds, how does the
signup endpoint know the phone was actually verified, rather than trusting
a client-supplied `"phoneVerified": true` flag (which any client could send
without ever calling `/otp/verify`)?

The fix is a signed ticket, not a boolean. `POST /api/auth/otp/verify`
returns a JWT (`otpTicket`, signed with its own secret, `OTP_TICKET_SECRET`
— separate from the access/refresh secrets) encoding `{ phone, purpose }`
with a 10-minute expiry. `POST /api/auth/signup` requires this ticket and
re-checks that its `phone` and `purpose` match the request — so a login
ticket can't be replayed to complete a signup, and a ticket for a different
phone number is rejected. This is the same pattern a real UPI/banking flow
uses (a short-lived verification assertion), just backed by mock OTP in
`DEMO_MODE`.

### Mock OTP (DEMO_MODE only)

`utils/otp.ts` generates, hashes, and stores an OTP exactly like a
production flow would — the only thing DEMO_MODE changes is that the code
is always `DEV_MOCK_OTP` (`123456` by default) instead of a random one, and
no real SMS is sent. This is explicit and logged as `[DEMO_MODE]` rather
than silently swapped in. A real SMS provider integration point is called
out in the code comment where it would go.

### Rate limiting

Redis-backed (`middleware/rateLimiter.ts`, `rate-limit-redis`), three tiers:
- **General** — applied globally in `app.ts`, generous budget for normal API use.
- **Auth** — tighter budget on signup/login/refresh, the classic
  credential-stuffing targets.
- **OTP request** — tightest, keyed by `IP + phone` specifically (not just
  IP) so one phone number can't be OTP-bombed from different IPs, and one
  IP can't be used to spam many phone numbers.

### Centralized error handling

Every thrown `AppError` (see `utils/AppError.ts`'s catalog) is converted to
the standard `{ success: false, error: { code, message } }` envelope by
`middleware/errorHandler.ts`, which is mounted last in `app.ts`. Prisma
constraint violations (e.g. a race-condition duplicate) and unexpected
errors are also caught here and never leak internals (stack traces,
raw Prisma error metadata) into the response — those go to the log only,
and even there, request bodies are redacted first (`utils/logger.ts`'s
`redact()`, which strips password/PIN/OTP/token fields recursively before
anything is logged).

### What's still deferred

- PIN attempt lockout (`PIN_LOCKED` exists in the error catalog but isn't
  wired up yet — revisit once payment flows exist and PIN verification is
  actually exercised under real usage patterns).
- "Logout everywhere" / listing active sessions (not required by the spec;
  the `RefreshToken` table supports it if it's ever needed later).

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
