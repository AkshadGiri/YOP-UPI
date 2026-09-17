# Server — UPI-Style Payments API

Node.js + Express + TypeScript + Prisma + PostgreSQL.

## Prerequisites

- Node.js >= 18.18
- PostgreSQL (via Docker, recommended) or a local install
- Redis (via Docker, recommended) or a local install

## 1. Start Postgres + Redis

From the repo root (`/upi-app`):

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` (db `upi_app`, user/pass `postgres`/`postgres`)
and Redis on `localhost:6379`, matching the defaults in `.env.example`.

Don't have Docker? Install Postgres 16+ and Redis 7+ locally and create a
database named `upi_app`, then update `DATABASE_URL` / `REDIS_URL` in `.env`
to match.

## 2. Configure environment variables

```bash
cd server
cp .env.example .env
```

The defaults work as-is against the docker-compose services. At minimum,
replace `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` with real random
strings (e.g. `openssl rand -hex 32`) — the app will refuse to boot if
they're too short.

## 3. Install dependencies and set up the database

```bash
npm install
npx prisma generate      # generates the Prisma Client from schema.prisma
npx prisma migrate dev   # creates the database schema (prompts for a migration name the first time)
npm run seed              # populates demo users: Akshad, Rahul, Priya
```

`prisma migrate dev` and `npm run seed` are separate on purpose — if you
just want a fresh schema without demo data (e.g. in CI), skip the seed step.

## 4. Run the server

```bash
npm run dev
```

You should see:

```
[server] listening on port 4000
[server] DEMO_MODE=true PAYMENT_MODE=mock
```

Verify: `curl http://localhost:4000/health`

## Resetting demo data

To wipe the database and reseed from scratch:

```bash
npm run prisma:reset
```

This drops all tables, re-applies migrations, and automatically re-runs the
seed script (configured via the `prisma.seed` field in `package.json`).

To just re-apply the seed data without dropping anything (safe, uses
upsert):

```bash
npm run seed
```

## Demo credentials (DEMO_MODE only)

After seeding:

| User   | Phone      | UPI ID       | Password    | UPI PIN |
|--------|------------|--------------|-------------|---------|
| Akshad | 9876543210 | akshad@demo  | `Demo@1234` | `1234`  |
| Rahul  | 9876000000 | rahul@demo   | `Demo@1234` | `1234`  |
| Priya  | 9876111111 | priya@demo   | `Demo@1234` | `1234`  |

Mock OTP for any phone number during signup/login: `123456`.

## Inspecting the database

```bash
npx prisma studio
```

Opens a browser UI at `http://localhost:5555` to inspect/edit rows directly.

## Scripts reference

| Command | What it does |
|---|---|
| `npm run dev` | Start the API with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run seed` | Upsert demo data |
| `npm run prisma:generate` | Regenerate Prisma Client after a schema change |
| `npm run prisma:migrate` | Create/apply a new migration |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run prisma:reset` | Drop DB, reapply migrations, reseed |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Run backend test suite (added Phase 17) |
