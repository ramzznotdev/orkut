import type express from 'express';
import { randomUUID } from 'crypto';
import {
  getInvoiceById,
  createInvoiceEvent,
  enqueueWebhookDelivery,
  getMerchantWebhookConfigEnv,
  createRefundRequest,
  listRefundsForMerchant,
} from '../../lib/db';

type AuthedRequest = express.Request & { merchantId?: string; gwEnv?: 'production' | 'sandbox' };

export async function requestRefund(req: AuthedRequest, res: express.Response) {
  const merchantId = req.merchantId;
  const env = (req as any).gwEnv || 'production';
  if (!merchantId) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Merchant unauthenticated' } });

  const invoiceId = String(req.params.id || '').trim();
  const inv = await getInvoiceById(invoiceId, merchantId);
  if (!inv) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });

  const { amount, reason } = req.body || {};
  const amt = amount == null ? Number(inv.final_amount) : Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'amount must be positive' } });
  }

  const refundId = await createRefundRequest({ invoice_id: invoiceId, merchant_id: merchantId, amount: Math.floor(amt), reason: reason ? String(reason) : null });

  const now = Math.floor(Date.now() / 1000);
  await createInvoiceEvent({
    id: randomUUID(),
    invoice_id: invoiceId,
    merchant_id: merchantId,
    event_type: 'refund.requested',
    payload: { refund_id: refundId, invoice_id: invoiceId, amount: Math.floor(amt), reason: reason ?? null },
    created_at: now,
  });

  const whCfg = await getMerchantWebhookConfigEnv(merchantId, env);
  if (whCfg.webhook_enabled && whCfg.webhook_url) {
    await enqueueWebhookDelivery({
      merchant_id: merchantId,
      env,
      invoice_id: invoiceId,
      event_type: 'refund.requested',
      payload: { event_type: 'refund.requested', refund_id: refundId, invoice_id: invoiceId, amount: Math.floor(amt), reason: reason ?? null, created_at: now },
      run_at: now,
    });
  }

  return res.json({ success: true, data: { refund_id: refundId, status: 'requested' } });
}

export async function listMyRefunds(req: AuthedRequest, res: express.Response) {
  const merchantId = req.merchantId;
  if (!merchantId) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Merchant unauthenticated' } });
  const items = await listRefundsForMerchant(merchantId, 200);
  return res.json({ success: true, data: { items } });
}
