import { createHmac, timingSafeEqual } from 'node:crypto';
import express, { Router } from 'express';
import { serviceSql } from '../db.js';

const CLAIM_TAKEOVER_SECONDS = 300;

interface ProviderEvent {
  id: string;
  type: string;
  data: { refund_id: string; provider_refund_id: string };
}

export function sign(payload: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function verify(payload: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = Buffer.from(sign(payload, secret), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function claimEvent(eventId: string): Promise<boolean> {
  const rows = await serviceSql`
    INSERT INTO processed_webhook_events (event_id, status, claimed_at)
    VALUES (${eventId}, 'processing', now())
    ON CONFLICT (event_id) DO UPDATE SET status = 'processing', claimed_at = now()
      WHERE processed_webhook_events.status <> 'completed'
        AND processed_webhook_events.claimed_at < now() - make_interval(secs => ${CLAIM_TAKEOVER_SECONDS})
    RETURNING event_id
  `;
  return rows.length > 0;
}

async function finishEvent(eventId: string, status: 'completed' | 'failed') {
  await serviceSql`UPDATE processed_webhook_events SET status = ${status} WHERE event_id = ${eventId}`;
}

export const webhookRouter = Router();

webhookRouter.post('/webhooks/provider', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.WEBHOOK_SECRET ?? 'test_secret';
  if (!verify(req.body, req.header('x-signature'), secret)) {
    return res.status(400).json({ error: 'invalid_signature' });
  }

  const event = JSON.parse(req.body.toString('utf-8')) as ProviderEvent;

  if (!(await claimEvent(event.id))) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    if (event.type === 'refund.succeeded') {
      await serviceSql`
        UPDATE refunds
        SET status = 'succeeded', provider_refund_id = ${event.data.provider_refund_id}
        WHERE id = ${event.data.refund_id} AND status = 'pending'
      `;
    }
    await finishEvent(event.id, 'completed');
    res.status(200).json({ received: true });
  } catch (err) {
    await finishEvent(event.id, 'failed');
    res.status(500).json({ received: false });
  }
});
