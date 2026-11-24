# clinic-billing-demo

Multi-tenant billing service: clinics, orders, refunds, payment-provider webhooks. Node, Express, TypeScript, Postgres.

## Commands
- `npm run type-check`
- `npm test` (needs Postgres, see README)

## Rules
- Tenant data is only touched through `withTenant(clinicId, tx => ...)`. It sets `app.clinic_id` for row-level security and always filters by `clinic_id` as well.
- `serviceSql` bypasses RLS. Only use it for webhook events and the auth lookup.
- Read `REVIEW.md` before writing or reviewing code. Its blocking items are non-negotiable.
