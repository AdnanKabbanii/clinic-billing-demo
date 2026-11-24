# clinic-billing-demo

A small multi-tenant billing service (clinics, orders, refunds, payment-provider webhooks) used to demonstrate how I ship and review AI-assisted code on money-moving paths.

## What's in here

- **Tenant isolation in two layers.** Every tenant query goes through `withTenant()`, which filters by `clinic_id` *and* sets `app.clinic_id` so Postgres row-level security blocks anything a query forgets. The app connects as `app_user`, a role that cannot bypass RLS.
- **Idempotent refunds.** `POST /orders/:id/refunds` requires an `Idempotency-Key`; retries replay the original refund, and reusing a key with a different amount is rejected.
- **No double refunds under concurrency.** The order row is locked with `SELECT ... FOR UPDATE`, and a `CHECK` constraint keeps `refunded_cents <= amount_cents` as a last line of defense.
- **Webhooks that survive duplicates and crashes.** Signature verified on the raw body; each event is claimed in `processed_webhook_events`, marked `completed` only after the work succeeds, and a crashed claim can be retaken after a takeover window.

## How a PR gets reviewed

Automated review on every push is slow, expensive across many branches, and generic. Instead, each PR gets its own reviewer agent, launched on demand with the context it needs:

```bash
scripts/review-pr.sh 1 "Admins can refund the full remaining amount of an order in their own clinic"
```

1. The script checks the PR out into its own git worktree (`.review/pr-<n>`), so reviews never collide with each other or with my working branch.
2. It starts a fresh Claude Code session with [`/review-pr`](.claude/commands/review-pr.md), the PR number and a one-line brief of the intended behavior.
3. The agent reads [`CLAUDE.md`](CLAUDE.md) (how code here must be structured) and [`REVIEW.md`](REVIEW.md) (the blocking checklist), runs type-check and tests, and **must prove every blocking finding with a failing test**. Unproven findings get downgraded.
4. It posts a structured review on the PR: verdict, findings table, failure scenarios, proof tests.
5. I review last: verify each finding, drop false positives, and check what the agent can't know (product intent, provider behavior, rollout risk).

`CI` (type-check plus the Postgres-backed test suite) still runs on every PR. It is cheap and catches regressions, but green CI is not a review.

## Run locally

```bash
npm install
# Postgres 16 on localhost:5432, user postgres / postgres, database billing_test
npm run type-check
npm test
```
