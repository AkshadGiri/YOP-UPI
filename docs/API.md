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

_No endpoints yet — Phase 1 is project setup only. `GET /health` exists as a
scaffold sanity check and returns `{ success: true, data: { status: "ok", ... } }`.
Auth endpoints are documented starting Phase 3._
