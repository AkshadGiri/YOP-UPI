# UPI-Style Payments App (Demo/Educational Project)

A production-style, **UPI-inspired** digital payments application built for a
college/portfolio project. It is **not** an implementation of the real UPI
network — it is a demo app with a realistic architecture that mirrors how a
real payments product is built, so it can later be connected to an actual
Payment Service Provider (PSP) without a rewrite.

## What "UPI-style" means here

There are two clearly separated payment paths in this codebase:

1. **Internal/demo ledger transfers** — money movement between users' demo
   wallets and demo bank accounts, tracked in our own PostgreSQL ledger.
   No real money ever moves. This is what powers the day-to-day demo flows
   (pay by mobile, self transfer, QR, etc).
2. **Real external payments (future)** — a `PaymentProvider` adapter
   interface with a `MockPaymentProvider` (used today) and a
   `RealPaymentProvider` (stubbed, to be implemented against an actual PSP
   like Razorpay/Cashfree/a UPI PSP sandbox). Switching between them is a
   single environment variable (`PAYMENT_MODE=mock|live`) — business logic
   never talks to a specific provider directly.

**Changing a balance in our database is never treated as real bank money.**
See `/docs/ARCHITECTURE.md` for the full explanation once Phase 14 lands.

## Monorepo layout

```
/upi-app
  /mobile     React Native (Expo) app — TypeScript
  /server     Node.js + Express API — TypeScript, Prisma, PostgreSQL
  /docs       API.md and ARCHITECTURE.md
```

## Status

This repository is being built in phases (see project plan). Current phase:

- [x] Phase 1 — Project setup
- [x] Phase 2 — Database + Prisma
- [x] Phase 3 — Authentication
- [ ] Phase 4 — User profile
- [ ] Phase 5 — Bank accounts
- [ ] Phase 6 — Wallet + ledger
- [ ] Phase 7 — Central transaction engine
- [ ] Phase 8 — Mobile payment
- [ ] Phase 9 — Self transfer
- [ ] Phase 10 — Bank transfer
- [ ] Phase 11 — QR generation
- [ ] Phase 12 — QR scanning
- [ ] Phase 13 — Transaction history
- [ ] Phase 14 — Payment provider adapter
- [ ] Phase 15 — Webhooks
- [ ] Phase 16 — UI polish
- [ ] Phase 17 — Testing
- [ ] Phase 18 — Deployment

## Quick start

See `/server/README.md` for full database setup and demo credentials. High-level:

```bash
# Infra (Postgres + Redis)
docker compose up -d

# Backend
cd server
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev

# Mobile
cd mobile
npm install
npx expo start
```

## Demo mode

`DEMO_MODE=true` (default for this project) enables mock OTP (`123456`),
seeded demo users/accounts, and the mock payment provider. Never point
`DEMO_MODE=false` at this codebase without real PSP credentials configured —
see `/docs/ARCHITECTURE.md` → "Real payment integration strategy".
