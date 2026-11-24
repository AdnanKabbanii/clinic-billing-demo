# Review checklist

Every PR, human or AI-written, is reviewed against this list. The automated reviewer reads this file. A finding on a **blocking** item means the PR does not merge.

## Blocking

1. **Tenant isolation.** Every query on tenant data runs inside `withTenant()` and filters by `clinic_id`. `serviceSql` bypasses row-level security, so it is only for non-tenant tables (webhook events, auth lookup). Any route handler using `serviceSql` on `orders` or `refunds` is a cross-tenant leak.
2. **Money paths are idempotent.** Any endpoint that moves money requires an `Idempotency-Key` header and replays the original result on retry.
3. **No read-then-write races on balances.** Rows whose balance is checked and then changed are locked (`SELECT ... FOR UPDATE`) or updated atomically in one statement.
4. **Webhooks are verified and deduplicated.** Signature checked against the raw body; event claimed in `processed_webhook_events` before work, marked `completed` only after the work succeeds.
5. **Money is integer cents.** No floats, no dollar amounts in variables.
6. **Money, auth and webhook changes ship with tests**, including one cross-tenant test and one retry or concurrency test.

## Non-blocking

- Input validated with zod at the route boundary.
- Errors return a stable error code, never a stack trace or another tenant's ID.
- No secrets in code or logs.
