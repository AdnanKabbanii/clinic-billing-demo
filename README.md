# clinic-billing-demo

A small multi-tenant billing service (clinics, orders, refunds, payment-provider webhooks) used to demonstrate how I ship and review AI-assisted code on money-moving paths.

## What's in here

- **Tenant isolation in two layers.** Every tenant query goes through `withTenant()`, which filters by `clinic_id` *and* sets `app.clinic_id` so Postgres row-level security blocks anything a query forgets. The app connects as `app_user`, a role that cannot bypass RLS.
- **Idempotent refunds.** `POST /orders/:id/refunds` requires an `Idempotency-Key`; retries replay the original refund, and reusing a key with a different amount is rejected.
- **No double refunds under concurrency.** The order row is locked with `SELECT ... FOR UPDATE`, and a `CHECK` constraint keeps `refunded_cents <= amount_cents` as a last line of defense.
- **Webhooks that survive duplicates and crashes.** Signature verified on the raw body; each event is claimed in `processed_webhook_events`, marked `completed` only after the work succeeds, and a crashed claim can be retaken after a takeover window.

## How a PR gets reviewed

1. `CI` runs type-check and the Postgres-backed test suite.
2. `Claude Code Review` runs on every PR. It reads [`REVIEW.md`](REVIEW.md), posts inline comments with a concrete failure scenario for each finding, and ends with a BLOCKING / NON-BLOCKING table and a verdict.
3. A human (me) reviews last: I verify each bot finding, dismiss false positives, and look for what the bot can't know (product intent, provider behavior, rollout risk).

## Run locally

```bash
npm install
# Postgres 16 on localhost:5432, user postgres / postgres, database billing_test
npm run type-check
npm test
```
