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

_Added in Phase 2 (Prisma schema) with an ER diagram and index rationale._

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
