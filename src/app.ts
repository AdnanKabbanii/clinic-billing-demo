import express from 'express';
import { requireAuth } from './auth.js';
import { refundsRouter } from './routes/refunds.js';
import { fullRefundRouter } from './routes/fullRefund.js';
import { webhookRouter } from './webhooks/provider.js';

export function createApp() {
  const app = express();
  app.use(webhookRouter);
  app.use(express.json());
  app.use(requireAuth);
  app.use(refundsRouter);
  app.use(fullRefundRouter);
  return app;
}
