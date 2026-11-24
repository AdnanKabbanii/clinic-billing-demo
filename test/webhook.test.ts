import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { serviceSql } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { sign } from '../src/webhooks/provider.js';
import { seed } from './setup.js';

const app = createApp();
let refundId: string;

beforeEach(async () => {
  await migrate();
  const s = await seed();
  const [r] = await serviceSql<{ id: string }[]>`
    INSERT INTO refunds (clinic_id, order_id, amount_cents, idempotency_key)
    VALUES (${s.clinicA}, ${s.orderA}, 1000, 'k') RETURNING id
  `;
  refundId = r!.id;
});

function deliver(event: object, secret = 'test_secret') {
  const payload = JSON.stringify(event);
  return request(app)
    .post('/webhooks/provider')
    .set('content-type', 'application/json')
    .set('x-signature', sign(payload, secret))
    .send(payload);
}

describe('POST /webhooks/provider', () => {
  const event = () => ({ id: 'evt_1', type: 'refund.succeeded', data: { refund_id: refundId, provider_refund_id: 're_1' } });

  it('rejects a bad signature', async () => {
    const res = await deliver(event(), 'wrong_secret');
    expect(res.status).toBe(400);
  });

  it('marks the refund succeeded', async () => {
    const res = await deliver(event());
    expect(res.status).toBe(200);
    const [r] = await serviceSql`SELECT status FROM refunds WHERE id = ${refundId}`;
    expect(r!.status).toBe('succeeded');
  });

  it('processes a duplicate delivery once', async () => {
    await deliver(event());
    const second = await deliver(event());
    expect(second.body.duplicate).toBe(true);
    const [e] = await serviceSql`SELECT status FROM processed_webhook_events WHERE event_id = 'evt_1'`;
    expect(e!.status).toBe('completed');
  });
});
