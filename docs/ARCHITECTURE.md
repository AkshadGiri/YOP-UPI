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

The central transaction engine (see "Transaction flow" below) is what
actually moves money; this section covers how each payment *type* decides
who pays whom and from which account, before handing off to the engine.

### Pay by mobile number (Phase 8)

The first payment type with a genuine third-party recipient. Flow:

1. `GET /api/payments/resolve/mobile?mobile=...` — look up a registered
   user by phone, return name/UPI ID/photo only (no email, no accounts).
2. Client shows the recipient and collects an amount and PIN.
3. `POST /api/payments/mobile` — server re-verifies the PIN
   (`auth.service.verifyPin`, shared with every other payment type from
   here on), re-resolves the recipient by phone (never trusts a
   client-supplied recipient ID from step 1 — the only thing carried
   between steps is the phone number itself), confirms the sender isn't
   paying their own registered number (`CANNOT_PAY_SELF` — that's what
   Self Transfer, Phase 9, is for), then calls `executeTransfer` with the
   sender's primary bank account as source and the receiver's primary
   bank account as destination.

**Design choice — settles via bank accounts, not the wallet:** every
"UPI-style" payment type (mobile, self-transfer, and starting Phase 10/12
bank-transfer and QR) moves money between bank accounts, mirroring how
real UPI settles payments through linked bank accounts. The app's
**Wallet** is kept a deliberately separate, distinct concept — its own
prepaid-style balance with its own add-money/withdraw (Phase 6/7) — rather
than silently becoming "the" source of funds for P2P payments. This also
matches the spec's Home screen (Section 7), which lists "Mobile" and
"Wallet" as two separate quick actions, not one.

### Self Transfer (Phase 9)

`POST /api/payments/self` — moves money between two of the caller's own
bank accounts. The simplest payment type in one sense (no recipient to
resolve, both accounts are already known to belong to the caller) but it
introduces a check none of the others need: **both** `fromAccountId` and
`toAccountId` must be verified as the caller's own accounts (mobile
payment only ever checks the sender's side; the receiver is a different
person entirely). This reuses `accounts/account.service.ts`'s
`getOwnedAccountOrThrow` — the exact same ownership check the accounts
module itself uses — called twice, once per account.

Same-account transfers (`fromAccountId === toAccountId`) are rejected with
the dedicated `SELF_TRANSFER_SAME_ACCOUNT` code, checked in the service
layer before the PIN is even verified — there's no legitimate reason to
"transfer" money from an account to itself, so this is rejected as early
as possible rather than proceeding through PIN verification for a request
that can never succeed.

### Bank Transfer (Phase 10)

`POST /api/payments/bank` — pay an arbitrary account number + IFSC. This is
the first payment type to exercise the engine's `EXTERNAL_BANK_ACCOUNT`
participant type (defined in Phase 7, unused until now).

There's deliberately **no "resolve recipient" step** here, unlike
pay-by-mobile: real bank transfers don't let you preview an arbitrary
account before sending, and building a lookup endpoint would both leak
which account numbers exist on the platform and misrepresent how real bank
rails behave. The flow goes straight from entering details to confirm to
PIN.

The destination resolves one of two ways, decided server-side:

1. **Registered account** — if `accountNumber + ifsc` match a `BankAccount`
   row anywhere on the platform, it's credited internally exactly like any
   other transfer, and `receiverId` is set to that account's owner. Both
   fields must match (not just the number) — an account number alone
   isn't a globally unique identifier in real banking, so matching on it
   alone would be ambiguous.
2. **External account** — no match means the engine is called with an
   `EXTERNAL_BANK_ACCOUNT` destination: the sender is debited, but there's
   nothing internal to credit. The money simulated-leaves the platform.
   This is the honest consequence of this project layering a demo ledger
   over itself rather than a real bank network (see the root README's
   "UPI-style" framing) — not a bug or a missing step. Phase 14's
   `PaymentProvider` abstraction is exactly where this no-op becomes a
   real PSP call in live mode.

Sending to one of the caller's *own* accounts via this route is rejected
with `CANNOT_TRANSFER_TO_OWN_ACCOUNT`, pointing users at Self Transfer
instead of silently supporting two different ways to do the same thing.

## QR flow

_Added in Phases 11–12._

## Wallet flow

Every user has exactly one `Wallet` (created at signup, Phase 3). Its
`balance` field is a cache — `WalletLedger` is the source of truth, per the
"Database schema" section above.

**Add money** (`POST /api/wallet/add-money`) and **withdraw**
(`POST /api/wallet/withdraw`) are the two wallet-to-own-bank-account money
movements implemented so far — opposite directions of the same operation,
both now thin wrappers around the central transaction engine (Phase 7;
see "Transaction flow" below for the engine itself). Phase 6 first built
this logic directly in `wallet.service.ts`; Phase 7 generalized it into
`transactionEngine.ts` so every other payment type reuses the exact same
atomicity/race-safety/ledger-accuracy guarantees rather than each
reimplementing them slightly differently.

"Pay using wallet" and "Wallet → **another user's** wallet/bank account"
(Section 6 of the spec) are still not here — those are multi-party
operations that need recipient resolution (finding another user by mobile
number), which Phase 8 introduces. Wallet-to-own-bank-account, by
contrast, has no recipient to resolve — both sides always belong to the
caller — so it made sense to build once the engine existed rather than
waiting on Phase 8's recipient-search feature.

## Transaction flow

`server/src/services/transactionEngine.ts` exports one function,
`executeTransfer`, that every payment type routes through — ADD_MONEY,
WALLET_TRANSFER, and (starting Phase 8) P2P, BANK_TRANSFER,
SELF_TRANSFER, and QR_PAYMENT. There is exactly one implementation of
"move money and record it correctly," not one per payment type.

### What the engine does, in order, inside one Postgres transaction

1. **Debit the source** via a single guarded conditional `UPDATE`
   (`WHERE balance >= amount`, expressed as Prisma's `updateMany` with a
   `gte` filter). This is the load-bearing correctness property: the
   "is there enough balance" check and the debit are the same atomic SQL
   statement, so two concurrent requests against the same wallet or bank
   account can never both succeed and overdraw it. A separate
   read-balance-then-check-then-write sequence — even inside a database
   transaction — would not have this guarantee under Postgres's default
   Read Committed isolation.
2. **Credit the destination** (skipped for an `EXTERNAL_BANK_ACCOUNT`
   destination — see below).
3. **Create the `Transaction` row** — the record every payment type
   shares one shape for for (Section 13 of the original spec).
4. **Write `WalletLedger` row(s)** for whichever side(s) are a `WALLET`.
   `balanceBefore`/`balanceAfter` are derived from the *actual returned
   balance* of the update in step 1/2, not a value read earlier — reading
   your own just-written value within the same transaction is always
   correct (Postgres holds the row lock from the `UPDATE` until commit),
   whereas a value read moments before the write could already be stale
   under concurrent load.

If anything fails at any step, the whole transaction rolls back — no
partial payment state is possible (Section 14/27 of the original spec).

### Authorization is NOT the engine's job

`executeTransfer` trusts its caller completely on "does this
source/destination actually belong to who it should." It only knows about
balances and ledger correctness. Every module calling it (wallet, and
starting Phase 8 the payments module) must verify ownership itself first —
this keeps the engine's contract simple and uniform across very different
call sites with very different ownership rules (a wallet is always the
caller's own; a payment recipient is deliberately *someone else's* wallet
or bank account).

### Money never touches floating point

Every amount is validated as a decimal string (regex: `^\d+(\.\d{1,2})?$`)
at the API boundary and stays a string until it's wrapped in a
`Prisma.Decimal` — it is never parsed into a JS `number` for storage or
arithmetic. `Prisma.Decimal` arithmetic (`.plus()`, `.minus()`, Prisma's
`increment`/`decrement` update operators) is used throughout instead of
`+`/`-` on numbers.

### Why FAILED/PROCESSING/REVERSED aren't used yet

`Transaction.status` has five values, but Phase 7–13's internal transfers
only ever produce `SUCCESS` (engine throws before writing anything) —
never `FAILED`. This is deliberate: a same-request failure (insufficient
balance, invalid PIN) is something the client can just retry, and there's
no value in a permanent audit row for an attempt that never moved any
money. `PROCESSING` and `FAILED` become meaningful starting Phase 14/15,
when a transaction can legitimately sit in `PROCESSING` while waiting on
an async PSP callback, and then move to `FAILED` based on that callback —
a genuinely different failure mode from "the request was invalid."
`REVERSED` is reserved for a future refund/reversal feature, not yet
built.

### Idempotency

`server/src/services/idempotency.ts` exports `idempotencyGuard(endpoint)`,
Express middleware backing the `Idempotency-Key` header (Section 15).
Mounted after request validation (so a malformed request never reserves a
key) and before the controller. Uses the `IdempotencyRecord` table
(unique on `userId + key + endpoint`): a fresh key reserves a `PROCESSING`
row, the actual response is captured and persisted as `COMPLETED` once
sent, and a repeated key with the same request body gets that stored
response replayed verbatim rather than re-running the operation. See the
file's own doc comment for the full state-machine and its one documented
limitation (a mid-flight process crash can strand a key in `PROCESSING`
until its TTL — acceptable for a demo project, flagged rather than hidden).

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
