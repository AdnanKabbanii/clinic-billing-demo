CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  role text NOT NULL CHECK (role IN ('admin', 'staff'))
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  refunded_cents integer NOT NULL DEFAULT 0,
  CONSTRAINT refund_within_amount CHECK (refunded_cents BETWEEN 0 AND amount_cents)
);
CREATE INDEX orders_clinic_idx ON orders (clinic_id);

CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  provider_refund_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, idempotency_key)
);

CREATE TABLE processed_webhook_events (
  event_id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  claimed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE refunds FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_orders ON orders
  USING (clinic_id = current_setting('app.clinic_id', true)::uuid)
  WITH CHECK (clinic_id = current_setting('app.clinic_id', true)::uuid);

CREATE POLICY tenant_isolation_refunds ON refunds
  USING (clinic_id = current_setting('app.clinic_id', true)::uuid)
  WITH CHECK (clinic_id = current_setting('app.clinic_id', true)::uuid);
