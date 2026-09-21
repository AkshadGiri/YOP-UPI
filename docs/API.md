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

## Full error code reference (as of Phase 4)

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
| `ACCOUNT_NOT_FOUND` | 404 | Reserved for Phase 5 (bank accounts) |
| `INVALID_IFSC` | 400 | Reserved for Phase 5 |
| `INSUFFICIENT_BALANCE` | 400 | Reserved for Phase 7+ |
| `INVALID_QR` / `QR_EXPIRED` | 400 | Reserved for Phase 11–12 |
| `TRANSACTION_FAILED` / `TRANSACTION_NOT_FOUND` / `DUPLICATE_TRANSACTION` | varies | Reserved for Phase 7+ |
