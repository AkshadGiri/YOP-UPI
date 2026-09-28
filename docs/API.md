# API Documentation

This document is filled in incrementally as each backend phase adds
endpoints. Every endpoint entry follows this template:

```
### METHOD /path

**Auth required:** yes/no

**Request body:**
```json
{}
```

**Success response:**
```json
{ "success": true, "data": {} }
```

**Error responses:**
| Code | Meaning |
|---|---|

**Example (curl):**
```bash
curl ...
```
```

## Response envelope

All API responses use a consistent envelope.

**Success:**
```json
{ "success": true, "data": { } }
```

**Error:**
```json
{ "success": false, "error": { "code": "INSUFFICIENT_BALANCE", "message": "Insufficient balance" } }
```

## Endpoints

All auth endpoints are mounted under `/api/auth`. None require authentication
except `GET /me` and the PIN endpoints, which require `Authorization: Bearer <accessToken>`.

---

### POST /api/auth/otp/request

Requests an OTP for a phone number. In `DEMO_MODE=true`, the code is always
`123456` (or whatever `DEV_MOCK_OTP` is set to) — no SMS is actually sent.

**Auth required:** no
**Rate limit:** 5 requests / window, keyed by IP + phone

**Request body:**
```json
{ "phone": "9876543210", "purpose": "SIGNUP" }
```
`purpose` is `"SIGNUP"` or `"LOGIN"`.

**Success response:**
```json
{ "success": true, "data": { "expiresAt": "2026-09-17T10:05:00.000Z" } }
```

**Errors:** `VALIDATION_ERROR`, `PHONE_ALREADY_REGISTERED` (purpose=SIGNUP, phone exists), `USER_NOT_FOUND` (purpose=LOGIN, phone doesn't exist), `RATE_LIMITED`

**Example:**
```bash
curl -X POST http://localhost:4000/api/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","purpose":"SIGNUP"}'
```

---

### POST /api/auth/otp/verify

Verifies an OTP code and, on success, issues a short-lived `otpTicket` — a
signed token proving this phone number passed OTP verification for this
purpose. Required by `/signup` and `/login/otp`.

**Auth required:** no

**Request body:**
```json
{ "phone": "9876543210", "purpose": "SIGNUP", "code": "123456" }
```

**Success response:**
```json
{ "success": true, "data": { "otpTicket": "eyJhbGciOi..." } }
```

**Errors:** `VALIDATION_ERROR`, `INVALID_OTP`, `OTP_EXPIRED`, `OTP_MAX_ATTEMPTS_EXCEEDED`

---

### POST /api/auth/signup

Creates a new user, wallet, and demo UPI ID. Requires a valid `otpTicket`
from `/otp/verify` with `purpose: "SIGNUP"` matching the same phone.

**Auth required:** no

**Request body:**
```json
{
  "name": "Akshad",
  "phone": "9876543210",
  "email": "akshad@example.com",
  "password": "Demo@1234",
  "otpTicket": "eyJhbGciOi..."
}
```

**Success response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx...",
      "name": "Akshad",
      "phone": "9876543210",
      "email": "akshad@example.com",
      "upiId": "akshad@demo",
      "profilePictureUrl": null,
      "createdAt": "2026-09-17T10:00:00.000Z",
      "pinSet": false
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

**Errors:** `VALIDATION_ERROR`, `OTP_TICKET_INVALID`, `PHONE_ALREADY_REGISTERED`, `EMAIL_ALREADY_REGISTERED`

---

### POST /api/auth/login

Password login with phone or email as the identifier.

**Auth required:** no

**Request body:**
```json
{ "identifier": "9876543210", "password": "Demo@1234" }
```
(`identifier` can also be an email, e.g. `"akshad@example.com"`.)

**Success response:** same shape as `/signup`.

**Errors:** `VALIDATION_ERROR`, `INVALID_CREDENTIALS` (deliberately identical for "no such user" and "wrong password")

---

### POST /api/auth/login/otp

Passwordless login using an OTP ticket instead of a password.

**Auth required:** no

**Request body:**
```json
{ "phone": "9876543210", "otpTicket": "eyJhbGciOi..." }
```

**Success response:** same shape as `/signup`.

**Errors:** `VALIDATION_ERROR`, `OTP_TICKET_INVALID`, `USER_NOT_FOUND`

---

### POST /api/auth/refresh

Exchanges a valid, unexpired, unrevoked refresh token for a new access +
refresh token pair. The presented refresh token is revoked in the same call
(rotation) — it cannot be used again.

**Auth required:** no (the refresh token itself is the credential)

**Request body:**
```json
{ "refreshToken": "eyJhbGciOi..." }
```

**Success response:**
```json
{ "success": true, "data": { "accessToken": "...", "refreshToken": "..." } }
```

**Errors:** `VALIDATION_ERROR`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `REFRESH_TOKEN_REVOKED`

---

### POST /api/auth/logout

Revokes a refresh token. Idempotent — always returns success even if the
token was already revoked or malformed.

**Auth required:** no

**Request body:**
```json
{ "refreshToken": "eyJhbGciOi..." }
```

**Success response:**
```json
{ "success": true, "data": { "loggedOut": true } }
```

---

### GET /api/auth/me

Returns the authenticated user's profile.

**Auth required:** yes

**Success response:**
```json
{ "success": true, "data": { "user": { "...": "same shape as signup's user" } } }
```

**Errors:** `UNAUTHORIZED`, `TOKEN_EXPIRED`, `TOKEN_INVALID`

**Example:**
```bash
curl http://localhost:4000/api/auth/me -H "Authorization: Bearer <accessToken>"
```

---

### POST /api/auth/pin/set

Sets the UPI PIN for the first time. Fails if a PIN is already set (use
`/pin/change` instead).

**Auth required:** yes

**Request body:**
```json
{ "pin": "1234" }
```

**Success response:**
```json
{ "success": true, "data": { "pinSet": true } }
```

**Errors:** `VALIDATION_ERROR`, `PIN_ALREADY_SET`, `UNAUTHORIZED`

---

### POST /api/auth/pin/change

Changes the UPI PIN. Requires the current PIN.

**Auth required:** yes

**Request body:**
```json
{ "currentPin": "1234", "newPin": "5678" }
```

**Success response:**
```json
{ "success": true, "data": { "pinChanged": true } }
```

**Errors:** `VALIDATION_ERROR`, `PIN_NOT_SET`, `INVALID_PIN`, `UNAUTHORIZED`

---

### POST /api/auth/pin/verify

Verifies a UPI PIN without changing anything. Exposed as its own endpoint
for testing/Postman use; internally, `authService.verifyPin()` is called
directly (not via HTTP) by the payments module starting Phase 8.

**Auth required:** yes

**Request body:**
```json
{ "pin": "1234" }
```

**Success response:**
```json
{ "success": true, "data": { "valid": true } }
```

**Errors:** `VALIDATION_ERROR`, `PIN_NOT_SET`, `INVALID_PIN`, `UNAUTHORIZED`

---

## Users (Phase 4)

All endpoints below require `Authorization: Bearer <accessToken>` and only
ever operate on the authenticated caller's own profile — there is no
"look up another user's full profile" endpoint (searching other users by
phone number, for payments, is added in Phase 8 and returns a much smaller,
public-safe shape).

### GET /api/users/profile

Returns the authenticated user's own profile. Identical shape to
`GET /api/auth/me` — `/auth/me` is kept as a lightweight "is my session
still valid" check used by the mobile splash screen; `/users/profile` is
the canonical endpoint the Profile screen uses and where profile mutations
live alongside it.

**Auth required:** yes

**Success response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx...",
      "name": "Akshad",
      "phone": "9876543210",
      "email": "akshad@example.com",
      "upiId": "akshad@demo",
      "profilePictureUrl": null,
      "createdAt": "2026-09-11T06:36:00.000Z",
      "pinSet": true
    }
  }
}
```

**Errors:** `UNAUTHORIZED`

**Example (curl):**
```bash
curl http://localhost:4000/api/users/profile \
  -H "Authorization: Bearer <accessToken>"
```

---

### PATCH /api/users/profile

Updates one or more of `name`, `email`, `profilePictureUrl`. Phone number
is intentionally not editable here (see `user.service.ts` for why). At
least one field must be present in the body.

**Auth required:** yes

**Request body (all optional, at least one required):**
```json
{
  "name": "Akshad Patil",
  "email": "akshad.patil@example.com",
  "profilePictureUrl": "file:///data/user/0/.../ImagePicker/abc123.jpg"
}
```
Send `"profilePictureUrl": null` to remove a previously set picture.

**Success response:** same shape as `GET /api/users/profile`.

**Errors:** `VALIDATION_ERROR`, `EMAIL_ALREADY_REGISTERED`, `UNAUTHORIZED`

**Example (curl):**
```bash
curl -X PATCH http://localhost:4000/api/users/profile \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Akshad Patil"}'
```

**Note on profile pictures:** `profilePictureUrl` is stored as whatever
string the client sends — there is no cloud storage integration in this
project. On the mobile app, `expo-image-picker` returns a local file URI,
which is only valid on the device that picked it (it will not sync across
devices or survive a reinstall). This is a known, deliberate limitation for
a demo project; swapping in real upload (e.g. to S3/Cloudinary) would only
require changing what the mobile client sends as `profilePictureUrl`, not
the API shape.

---

## Bank Accounts (Phase 5)

All endpoints below require `Authorization: Bearer <accessToken>` and only
ever operate on the authenticated caller's own accounts. `id` in a path
always refers to `BankAccount.id`; requesting an account that exists but
belongs to someone else returns `ACCOUNT_NOT_FOUND` (not `FORBIDDEN`) —
deliberately not distinguishing "doesn't exist" from "isn't yours".

The full account number is **never** returned by any endpoint — every
response includes `maskedAccountNumber` only (e.g. `"XXXX XXXX 6789"`). The
raw number is only ever visible to the client at the moment the user types
it into the "Add account" form themselves.

### GET /api/accounts

Lists the caller's bank accounts, primary account first, then by
`createdAt`.

**Auth required:** yes

**Success response:**
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "clx...",
        "bankName": "HDFC Bank",
        "accountHolderName": "Akshad",
        "maskedAccountNumber": "XXXX XXXX 0001",
        "ifsc": "HDFC0001234",
        "balance": "20000",
        "isPrimary": true,
        "createdAt": "2026-09-08T00:00:00.000Z"
      }
    ]
  }
}
```

**Errors:** `UNAUTHORIZED`

---

### POST /api/accounts

Adds a new demo bank account. The **first** account a user adds is
automatically set as primary, regardless of what's sent — there is always
exactly one primary account once at least one exists.

**Auth required:** yes

**Request body:**
```json
{
  "bankName": "State Bank of India",
  "accountHolderName": "Akshad",
  "accountNumber": "30200087650002",
  "ifsc": "SBIN0005678"
}
```

**Success response:** the created account, same shape as a `GET` list item — `201 Created`.

**Errors:** `VALIDATION_ERROR` (bad IFSC format, account number not 9–18 digits), `ACCOUNT_ALREADY_EXISTS` (this exact account number is already linked for this user), `UNAUTHORIZED`

**Example (curl):**
```bash
curl -X POST http://localhost:4000/api/accounts \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"bankName":"SBI","accountHolderName":"Akshad","accountNumber":"30200087650002","ifsc":"SBIN0005678"}'
```

---

### GET /api/accounts/:id

Fetches a single account (masked, same shape as the list).

**Auth required:** yes

**Errors:** `ACCOUNT_NOT_FOUND`, `UNAUTHORIZED`

---

### PATCH /api/accounts/:id/primary

Sets this account as primary. Atomically un-sets whichever account was
previously primary in the same database transaction — a user with at least
one account always has exactly one primary, never zero or two.

**Auth required:** yes

**Success response:** the now-primary account.

**Errors:** `ACCOUNT_NOT_FOUND`, `UNAUTHORIZED`

---

### DELETE /api/accounts/:id

Removes an account. A **primary** account cannot be removed while other
accounts exist — set a different one as primary first. Removing your only
account is allowed (you fall back to wallet-only until you add another).

**Auth required:** yes

**Success response:**
```json
{ "success": true, "data": { "removed": true } }
```

**Errors:** `ACCOUNT_NOT_FOUND`, `CANNOT_REMOVE_PRIMARY_ACCOUNT`, `UNAUTHORIZED`

---

## Wallet (Phase 6, extended in Phase 7)

All endpoints below require `Authorization: Bearer <accessToken>` and only
ever operate on the authenticated caller's own wallet — there is no
cross-user wallet access. "Pay using wallet" and wallet-to-**another
user's** wallet/bank account are **not** here — those need recipient
resolution (find a user by mobile number, etc.) and are built starting
Phase 8. This module covers the wallet's own balance and money moving
between the wallet and the caller's **own** bank accounts.

As of Phase 7, `add-money` and `withdraw` are both thin wrappers around the
central transaction engine (`server/src/services/transactionEngine.ts`) —
see `docs/ARCHITECTURE.md` → "Transaction flow" for the full design. Both
support the `Idempotency-Key` header described below.

**Amounts are always strings**, e.g. `"500"` or `"499.50"` — never a JSON
number. This is deliberate: a JS/JSON number for money risks silent
floating-point precision loss; a validated decimal string is converted
directly to a `Prisma.Decimal` server-side and never touches float
arithmetic at any point in the payment path.

### Idempotency-Key header

Both money-moving endpoints below (and every payment endpoint from Phase 8
onward) accept an optional `Idempotency-Key` header:

```
Idempotency-Key: <any client-generated unique string per action>
```

- **Not sent** → no protection, the request is processed normally.
- **Same key, same request body, first attempt already succeeded** → the
  original success response is replayed verbatim. No second transaction is
  created.
- **Same key, different request body** → `409 IDEMPOTENCY_KEY_REUSED`.
- **Same key, first attempt still in flight (concurrent duplicate)** →
  `409 DUPLICATE_TRANSACTION`.

This is what makes it safe for a mobile client to retry a payment request
after a flaky network response or an accidental double-tap — see
`server/src/services/idempotency.ts` for the implementation.

### GET /api/wallet

Returns the caller's wallet balance.

**Auth required:** yes

**Success response:**
```json
{
  "success": true,
  "data": { "wallet": { "id": "clx...", "balance": "2000", "createdAt": "2026-09-08T00:00:00.000Z" } }
}
```

**Errors:** `UNAUTHORIZED`

---

### GET /api/wallet/ledger

Paginated wallet ledger — every balance-affecting event, oldest last. This
is the append-only source of truth described in `docs/ARCHITECTURE.md`
("Database schema" → "Why balances are a cache, not the truth"), not a
derived view — each row is written in the same DB transaction as the
balance change it explains.

**Auth required:** yes

**Query params:** `page` (default 1), `limit` (default 20, max 100)

**Success response:**
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "clx...",
        "type": "ADD_MONEY",
        "direction": "CREDIT",
        "amount": "500",
        "balanceBefore": "2000",
        "balanceAfter": "2500",
        "createdAt": "2026-09-21T10:00:00.000Z",
        "transactionId": "TXN_20260921_AB12CD",
        "description": "Added money from HDFC Bank"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

**Errors:** `UNAUTHORIZED`

**Example (curl):**
```bash
curl "http://localhost:4000/api/wallet/ledger?page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

---

### POST /api/wallet/add-money

Tops up the wallet from one of the caller's own bank accounts, via the
central transaction engine.

**Auth required:** yes

**Optional header:** `Idempotency-Key`

**Request body:**
```json
{ "bankAccountId": "clx...", "amount": "500" }
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "wallet": { "id": "clx...", "balance": "2500", "createdAt": "..." },
    "transactionId": "TXN_20260921_AB12CD"
  }
}
```

**Errors:** `VALIDATION_ERROR` (amount ≤ 0 or > ₹1,00,000, or malformed), `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_BALANCE`, `IDEMPOTENCY_KEY_REUSED`, `DUPLICATE_TRANSACTION`, `UNAUTHORIZED`

**Example (curl):**
```bash
curl -X POST http://localhost:4000/api/wallet/add-money \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"bankAccountId":"clx...","amount":"500"}'
```

---

### POST /api/wallet/withdraw

The reverse of add-money: moves money from the wallet to one of the
caller's own bank accounts (Section 6's "Wallet → bank transfer"). Not to
be confused with Phase 9's Self Transfer, which is bank-account-to-
bank-account — this is wallet-to-bank.

**Auth required:** yes

**Optional header:** `Idempotency-Key`

**Request body:**
```json
{ "bankAccountId": "clx...", "amount": "200" }
```

**Success response:** same shape as add-money — `wallet` now reflects the
**wallet's** post-withdrawal balance.

**Errors:** `VALIDATION_ERROR`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_BALANCE` (wallet balance too low), `IDEMPOTENCY_KEY_REUSED`, `DUPLICATE_TRANSACTION`, `UNAUTHORIZED`

**Example (curl):**
```bash
curl -X POST http://localhost:4000/api/wallet/withdraw \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"bankAccountId":"clx...","amount":"200"}'
```

---

## Payments (Phase 8, extended in Phase 9 and 10)

The first payment type with a genuine recipient — a different registered
user, found by mobile number. Settles via bank accounts (sender's primary
→ receiver's primary); see `docs/ARCHITECTURE.md` → "Wallet flow" for why
that's a deliberate choice, distinct from the Wallet feature.

### GET /api/payments/resolve/mobile

The "Find User" step (spec Section 8, steps 1–3): looks up a registered
user by mobile number and returns only public-safe fields — no email, no
account details.

**Auth required:** yes

**Query params:** `mobile` (10-digit Indian mobile number)

**Success response:**
```json
{
  "success": true,
  "data": {
    "recipient": { "name": "Rahul", "upiId": "rahul@demo", "profilePictureUrl": null }
  }
}
```

**Errors:** `VALIDATION_ERROR`, `USER_NOT_FOUND`, `UNAUTHORIZED`

**Example (curl):**
```bash
curl "http://localhost:4000/api/payments/resolve/mobile?mobile=9876000000" \
  -H "Authorization: Bearer <accessToken>"
```

---

### POST /api/payments/mobile

Executes the payment (spec Section 8, steps 4–14). PIN is verified before
any account lookups happen, so a wrong PIN never reveals whether a
recipient exists or is payable.

**Auth required:** yes

**Optional header:** `Idempotency-Key`

**Request body:**
```json
{ "mobile": "9876000000", "amount": "500", "pin": "1234" }
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "TXN_20260924_AB12CD",
    "amount": "500",
    "recipient": { "name": "Rahul", "upiId": "rahul@demo" },
    "senderBalanceAfter": "19500"
  }
}
```

**Errors:** `VALIDATION_ERROR`, `PIN_NOT_SET`, `INVALID_PIN`, `CANNOT_PAY_SELF` (sending to your own registered number — use Self Transfer instead), `USER_NOT_FOUND`, `ACCOUNT_NOT_FOUND` (you have no primary bank account), `RECEIVER_ACCOUNT_NOT_FOUND` (recipient has no bank account set up), `INSUFFICIENT_BALANCE`, `IDEMPOTENCY_KEY_REUSED`, `DUPLICATE_TRANSACTION`, `UNAUTHORIZED`

**Example (curl):**
```bash
curl -X POST http://localhost:4000/api/payments/mobile \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"mobile":"9876000000","amount":"500","pin":"1234"}'
```

---

### POST /api/payments/self

Moves money between two of the caller's **own** bank accounts (spec
Section 9/10 — "Self Transfer"). Both `fromAccountId` and `toAccountId`
are verified to belong to the caller; the same-account check
(`SELF_TRANSFER_SAME_ACCOUNT`) happens in the service layer, not Zod
validation, so it surfaces as its own specific error code rather than a
generic `VALIDATION_ERROR` — consistent with how `CANNOT_PAY_SELF` works
for pay-by-mobile.

**Auth required:** yes

**Optional header:** `Idempotency-Key`

**Request body:**
```json
{ "fromAccountId": "clx...", "toAccountId": "cly...", "amount": "1000", "pin": "1234" }
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "TXN_20260926_XY34ZQ",
    "amount": "1000",
    "fromAccountBalanceAfter": "19000",
    "toAccountBalanceAfter": "6000"
  }
}
```

**Errors:** `VALIDATION_ERROR`, `SELF_TRANSFER_SAME_ACCOUNT`, `PIN_NOT_SET`, `INVALID_PIN`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_BALANCE`, `IDEMPOTENCY_KEY_REUSED`, `DUPLICATE_TRANSACTION`, `UNAUTHORIZED`

**Example (curl):**
```bash
curl -X POST http://localhost:4000/api/payments/self \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"fromAccountId":"clx...","toAccountId":"cly...","amount":"1000","pin":"1234"}'
```

---

### POST /api/payments/bank

Transfers to an arbitrary account number + IFSC (spec Section 9 — "Bank
Account Transfer"). Unlike pay-by-mobile, there is no "look up the
recipient first" endpoint — real bank transfers don't let you preview an
arbitrary account before sending, so the client goes straight from
entering details to confirming and paying.

The destination may or may not be a bank account registered on this
platform:
- If the account number + IFSC match a registered `BankAccount`, the
  transfer credits it internally and `isRegisteredAccount: true` is
  returned.
- If not, this is a simulated **external** transfer — the sender is
  debited, but there's nothing internal to credit (`isRegisteredAccount:
  false`). This is the honest consequence of this project layering a demo
  ledger over itself rather than a real bank network — see the root
  `README.md`'s "UPI-style" framing. A real PSP integration (Phase 14) is
  exactly where this no-op would become an actual bank transfer call.

Sending to one of your **own** accounts this way is rejected — use Self
Transfer instead.

**Auth required:** yes

**Optional header:** `Idempotency-Key`

**Request body:**
```json
{
  "accountNumber": "30200087650099",
  "ifsc": "SBIN0005678",
  "accountHolderName": "Priya",
  "amount": "300",
  "pin": "1234"
}
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "TXN_20260927_QW12ER",
    "amount": "300",
    "senderBalanceAfter": "19700",
    "destination": {
      "accountHolderName": "Priya",
      "maskedAccountNumber": "XXXX XXXX 0099",
      "isRegisteredAccount": true
    }
  }
}
```

**Errors:** `VALIDATION_ERROR`, `PIN_NOT_SET`, `INVALID_PIN`, `ACCOUNT_NOT_FOUND` (you have no primary bank account), `CANNOT_TRANSFER_TO_OWN_ACCOUNT`, `INSUFFICIENT_BALANCE`, `IDEMPOTENCY_KEY_REUSED`, `DUPLICATE_TRANSACTION`, `UNAUTHORIZED`

**Example (curl):**
```bash
curl -X POST http://localhost:4000/api/payments/bank \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"accountNumber":"30200087650099","ifsc":"SBIN0005678","accountHolderName":"Priya","amount":"300","pin":"1234"}'
```

---

## Full error code reference (as of Phase 10)

| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body failed schema validation |
| `UNAUTHORIZED` | 401 | Missing/invalid Authorization header |
| `FORBIDDEN` | 403 | Authenticated but not allowed to do this |
| `NOT_FOUND` | 404 | Route or resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `PHONE_ALREADY_REGISTERED` | 409 | Signup with a phone already in use |
| `EMAIL_ALREADY_REGISTERED` | 409 | Signup with an email already in use |
| `INVALID_CREDENTIALS` | 401 | Wrong identifier/password combo |
| `INVALID_OTP` | 400 | Wrong OTP code |
| `OTP_EXPIRED` | 400 | OTP TTL elapsed |
| `OTP_MAX_ATTEMPTS_EXCEEDED` | 429 | Too many wrong OTP attempts |
| `OTP_TICKET_INVALID` | 400 | Ticket expired, malformed, or purpose/phone mismatch |
| `TOKEN_INVALID` | 401 | Malformed/invalid JWT |
| `TOKEN_EXPIRED` | 401 | JWT past its expiry |
| `REFRESH_TOKEN_REVOKED` | 401 | Refresh token reused, revoked, or unknown |
| `PIN_ALREADY_SET` | 409 | `/pin/set` called when a PIN already exists |
| `PIN_NOT_SET` | 400 | `/pin/change` or `/pin/verify` called with no PIN set |
| `INVALID_PIN` | 400 | Wrong UPI PIN |
| `PIN_LOCKED` | 429 | Reserved for future PIN attempt lockout |
| `USER_NOT_FOUND` | 404 | User doesn't exist |
| `ACCOUNT_NOT_FOUND` | 404 | Bank account doesn't exist or isn't yours |
| `ACCOUNT_ALREADY_EXISTS` | 409 | This account number is already linked for this user |
| `INVALID_IFSC` | 400 | IFSC failed format validation (surfaced as `VALIDATION_ERROR` with details) |
| `CANNOT_REMOVE_PRIMARY_ACCOUNT` | 400 | Must set another account as primary before removing this one |
| `CANNOT_PAY_SELF` | 400 | Tried to pay-by-mobile to your own registered number |
| `SELF_TRANSFER_SAME_ACCOUNT` | 400 | `fromAccountId` and `toAccountId` were the same account |
| `CANNOT_TRANSFER_TO_OWN_ACCOUNT` | 400 | Bank transfer destination matched one of your own accounts — use Self Transfer |
| `RECEIVER_ACCOUNT_NOT_FOUND` | 400 | Recipient exists but has no bank account to receive into |
| `INSUFFICIENT_BALANCE` | 400 | Not enough balance for a debit (race-safe: checked and debited atomically) |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Same `Idempotency-Key` sent with a different request body |
| `DUPLICATE_TRANSACTION` | 409 | Same `Idempotency-Key` request is still being processed |
| `INVALID_QR` / `QR_EXPIRED` | 400 | Reserved for Phase 11–12 |
| `TRANSACTION_FAILED` / `TRANSACTION_NOT_FOUND` | varies | Reserved for Phase 13 (transaction history detail lookup) and Phase 14+ (async provider failures) |
