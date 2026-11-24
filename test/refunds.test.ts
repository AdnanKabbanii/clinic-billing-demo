import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { serviceSql } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { seed } from './setup.js';

const app = createApp();
let s: Awaited<ReturnType<typeof seed>>;

beforeEach(async () => {
  await migrate();
  s = await seed();
});

function refund(userId: string, orderId: string, amountCents: number, key: string) {
  return request(app)
    .post(`/orders/${orderId}/refunds`)
    .set('x-user-id', userId)
    .set('idempotency-key', key)
    .send({ amountCents });
}

describe('POST /orders/:orderId/refunds', () => {
  it('refunds an order in the caller clinic', async () => {
    const res = await refund(s.adminA, s.orderA, 2500, 'k1');
    expect(res.status).toBe(201);
    const [order] = await serviceSql`SELECT refunded_cents FROM orders WHERE id = ${s.orderA}`;
    expect(order!.refunded_cents).toBe(2500);
  });

  it('returns 404 for an order owned by another clinic', async () => {
    const res = await refund(s.adminB, s.orderA, 2500, 'k1');
    expect(res.status).toBe(404);
    const [order] = await serviceSql`SELECT refunded_cents FROM orders WHERE id = ${s.orderA}`;
    expect(order!.refunded_cents).toBe(0);
  });

  it('forbids staff from issuing refunds', async () => {
    const res = await refund(s.staffA, s.orderA, 2500, 'k1');
    expect(res.status).toBe(403);
  });

  it('replays the same refund for a retried idempotency key', async () => {
    const first = await refund(s.adminA, s.orderA, 2500, 'retry-key');
    const second = await refund(s.adminA, s.orderA, 2500, 'retry-key');
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    const [order] = await serviceSql`SELECT refunded_cents FROM orders WHERE id = ${s.orderA}`;
    expect(order!.refunded_cents).toBe(2500);
  });

  it('rejects an idempotency key reused with a different amount', async () => {
    await refund(s.adminA, s.orderA, 2500, 'same-key');
    const res = await refund(s.adminA, s.orderA, 9000, 'same-key');
    expect(res.status).toBe(422);
  });

  it('never refunds more than the order total under concurrency', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => refund(s.adminA, s.orderA, 4000, `concurrent-${i}`)),
    );
    const created = results.filter((r) => r.status === 201).length;
    expect(created).toBe(2);
    const [order] = await serviceSql`SELECT refunded_cents FROM orders WHERE id = ${s.orderA}`;
    expect(order!.refunded_cents).toBe(8000);
  });
});

describe('row-level security backstop', () => {
  it('hides other clinics rows even if a query forgets the clinic filter', async () => {
    const { withTenant } = await import('../src/db.js');
    const rows = await withTenant(s.clinicB, (tx) => tx`SELECT id FROM orders`);
    expect(rows).toHaveLength(0);
  });
});
