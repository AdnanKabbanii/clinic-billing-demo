import { Router } from 'express';
import { serviceSql } from '../db.js';
import { requireRole } from '../auth.js';

export const fullRefundRouter = Router();

fullRefundRouter.post('/orders/:orderId/refunds/full', requireRole('admin'), async (req, res) => {
  const orderId = req.params.orderId as string;

  const [order] = await serviceSql<{ clinic_id: string; amount_cents: number; refunded_cents: number }[]>`
    SELECT clinic_id, amount_cents, refunded_cents FROM orders WHERE id = ${orderId}
  `;
  if (!order) return res.status(404).json({ error: 'order_not_found' });

  const remaining = (order.amount_cents - order.refunded_cents) / 100;
  if (remaining <= 0) return res.status(409).json({ error: 'already_refunded' });

  await serviceSql`UPDATE orders SET refunded_cents = amount_cents WHERE id = ${orderId}`;

  const [refund] = await serviceSql`
    INSERT INTO refunds (clinic_id, order_id, amount_cents, idempotency_key)
    VALUES (${order.clinic_id}, ${orderId}, ${Math.round(remaining * 100)}, ${`full-${orderId}-${Date.now()}`})
    RETURNING id, order_id, amount_cents, status
  `;

  res.status(201).json(refund);
});
