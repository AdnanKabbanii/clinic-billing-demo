import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../db.js';
import { requireRole } from '../auth.js';

const body = z.object({ amountCents: z.number().int().positive() });

interface RefundRow {
  id: string;
  order_id: string;
  amount_cents: number;
  status: string;
}

export const refundsRouter = Router();

refundsRouter.post('/orders/:orderId/refunds', requireRole('admin'), async (req, res) => {
  const parsed = body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const idempotencyKey = req.header('idempotency-key');
  if (!idempotencyKey) return res.status(400).json({ error: 'idempotency_key_required' });

  const { clinicId } = req.auth!;
  const orderId = req.params.orderId as string;
  const { amountCents } = parsed.data;

  const result = await withTenant(clinicId, async (tx) => {
    const [existing] = await tx<RefundRow[]>`
      SELECT id, order_id, amount_cents, status FROM refunds
      WHERE clinic_id = ${clinicId} AND idempotency_key = ${idempotencyKey}
    `;
    if (existing) {
      if (existing.order_id !== orderId || existing.amount_cents !== amountCents) {
        return { status: 422, body: { error: 'idempotency_key_reused' } };
      }
      return { status: 200, body: existing };
    }

    const [order] = await tx<{ amount_cents: number; refunded_cents: number }[]>`
      SELECT amount_cents, refunded_cents FROM orders
      WHERE id = ${orderId} AND clinic_id = ${clinicId}
      FOR UPDATE
    `;
    if (!order) return { status: 404, body: { error: 'order_not_found' } };

    if (order.refunded_cents + amountCents > order.amount_cents) {
      return { status: 409, body: { error: 'exceeds_refundable_amount' } };
    }

    await tx`
      UPDATE orders SET refunded_cents = refunded_cents + ${amountCents}
      WHERE id = ${orderId} AND clinic_id = ${clinicId}
    `;

    const [refund] = await tx<RefundRow[]>`
      INSERT INTO refunds (clinic_id, order_id, amount_cents, idempotency_key)
      VALUES (${clinicId}, ${orderId}, ${amountCents}, ${idempotencyKey})
      RETURNING id, order_id, amount_cents, status
    `;
    return { status: 201, body: refund };
  });

  res.status(result.status).json(result.body);
});
