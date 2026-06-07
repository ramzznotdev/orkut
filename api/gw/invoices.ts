import type express from 'express';
import { randomUUID } from 'crypto';
import {
  createInvoiceEvent,
  createInvoiceRecord,
  getInvoiceById,
  listInvoiceEvents,
  listInvoices,
  updateInvoiceStatus,
  getAvailableSuffix,
  createPendingTransaction,
  getPendingTransaction,
  deletePendingTransaction,
  createPaidTransaction,
  getPaidTransaction,
  enqueueWebhookDelivery,
  getMerchantWebhookConfigEnv,
} from '../../lib/db';
import { generateDynamicQris } from '../../lib/qris';
import { getQrisHistory } from '../../lib/orderkuota';

type AuthedRequest = express.Request & { merchantId?: string; gwEnv?: 'production' | 'sandbox' };

const EXPIRY_SECONDS = Number(process.env.INVOICE_EXPIRY_SECONDS || 600); // default 10m
const PAID_EXPIRY_SECONDS = Number(process.env.PAID_EXPIRY_SECONDS || 3600); // default 1h

export async function createInvoice(req: AuthedRequest, res: express.Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST allowed' } });
  }

  const merchantId = req.merchantId;
  const env = (req as any).gwEnv || 'production';
  if (!merchantId) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Merchant unauthenticated' } });
  }

  const { username, token, amount, qris_static, reference_id, metadata } = req.body || {};
  if (!username || !token || !amount || !qris_static) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'username, token, amount, qris_static required' } });
  }

  const baseAmount = parseInt(String(amount), 10);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'amount must be positive number' } });
  }

  // NOTE: token is not stored. We only use it to allow the merchant to check status later.
  const now = Math.floor(Date.now() / 1000);
  const invoiceId = randomUUID();

  // Reuse the same suffix logic used by legacy QRIS generator
  const suffix = await getAvailableSuffix(String(username));
  const finalAmount = baseAmount + suffix;
  const qrisString = generateDynamicQris(String(qris_static), finalAmount);

  await createPendingTransaction({
    id: invoiceId,
    username: String(username),
    base_amount: baseAmount,
    unique_suffix: suffix,
    final_amount: finalAmount,
    qris_string: qrisString,
    created_at: now,
    expires_at: now + EXPIRY_SECONDS,
  });

  await createInvoiceRecord({
    id: invoiceId,
    merchant_id: merchantId,
    env,
    username: String(username),
    reference_id: reference_id ? String(reference_id) : null,
    base_amount: baseAmount,
    unique_suffix: suffix,
    final_amount: finalAmount,
    status: 'pending',
    qris_string: qrisString,
    created_at: now,
    expires_at: now + EXPIRY_SECONDS,
    metadata: metadata ?? null,
  });

  await createInvoiceEvent({
    id: randomUUID(),
    invoice_id: invoiceId,
    merchant_id: merchantId,
    event_type: 'payment.created',
    payload: { invoice_id: invoiceId, reference_id: reference_id ?? null, amount: baseAmount, final_amount: finalAmount },
    created_at: now,
  });


  // Enqueue webhook (if enabled)
  const whCfg = await getMerchantWebhookConfigEnv(merchantId, env);
  if (whCfg.webhook_enabled && whCfg.webhook_url) {
    await enqueueWebhookDelivery({
      merchant_id: merchantId,
      env,
      invoice_id: invoiceId,
      event_type: 'payment.created',
      payload: { event_type: 'payment.created', invoice_id: invoiceId, reference_id: reference_id ?? null, base_amount: baseAmount, final_amount: finalAmount, created_at: now },
      run_at: now,
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      invoice_id: invoiceId,
      reference_id: reference_id ?? null,
      base_amount: baseAmount,
      unique_suffix: suffix,
      final_amount: finalAmount,
      qris_string: qrisString,
      status: 'pending',
      expires_at: now + EXPIRY_SECONDS,
    },
  });
}

export async function getInvoice(req: AuthedRequest, res: express.Response) {
  const merchantId = req.merchantId;
  const env = (req as any).gwEnv || 'production';
  if (!merchantId) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Merchant unauthenticated' } });
  const invoiceId = String(req.params.id || '').trim();
  const inv = await getInvoiceById(invoiceId, merchantId);
  if (!inv) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
  return res.json({ success: true, data: inv });
}

export async function listMyInvoices(req: AuthedRequest, res: express.Response) {
  const merchantId = req.merchantId;
  if (!merchantId) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Merchant unauthenticated' } });
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  const items = await listInvoices(merchantId, limit, offset);
  return res.json({ success: true, data: { items, limit, offset } });
}

export async function listEvents(req: AuthedRequest, res: express.Response) {
  const merchantId = req.merchantId;
  if (!merchantId) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Merchant unauthenticated' } });
  const invoiceId = String(req.params.id || '').trim();
  const items = await listInvoiceEvents(invoiceId, merchantId, 100);
  return res.json({ success: true, data: { items } });
}

// Check payment status and update invoice lifecycle
export async function checkInvoice(req: AuthedRequest, res: express.Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST allowed' } });
  }
  const merchantId = req.merchantId;
  const env = (req as any).gwEnv || 'production';
  if (!merchantId) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Merchant unauthenticated' } });

  const invoiceId = String(req.params.id || '').trim();
  const { username, token } = req.body || {};
  if (!username || !token) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'username and token required' } });
  }

  const inv = await getInvoiceById(invoiceId, merchantId);
  if (!inv) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });

  const now = Math.floor(Date.now() / 1000);

  // already paid cached
  const paidTx = await getPaidTransaction(invoiceId);
  if (paidTx) {
    if (inv.status !== 'paid') {
      await updateInvoiceStatus(invoiceId, merchantId, 'paid', paidTx.paid_at);
      await createInvoiceEvent({
        id: randomUUID(),
        invoice_id: invoiceId,
        merchant_id: merchantId,
        event_type: 'payment.paid',
        payload: { invoice_id: invoiceId, final_amount: paidTx.final_amount, paid_at: paidTx.paid_at },
        created_at: now,
      });

      // Enqueue webhook (if enabled)
      const whCfg = await getMerchantWebhookConfigEnv(merchantId, env);
      if (whCfg.webhook_enabled && whCfg.webhook_url) {
        await enqueueWebhookDelivery({
          merchant_id: merchantId,
          env,
          invoice_id: invoiceId,
          event_type: 'payment.paid',
          payload: { event_type: 'payment.paid', invoice_id: invoiceId, final_amount: paidTx.final_amount, paid_at: paidTx.paid_at, created_at: now },
          run_at: now,
        });
      }

    }
    return res.json({ success: true, data: { status: 'paid', final_amount: paidTx.final_amount, paid_at: paidTx.paid_at } });
  }

  const pending = await getPendingTransaction(invoiceId);
  if (!pending) {
    // If invoice exists but tx missing, treat as not_found/expired
    return res.json({ success: true, data: { status: inv.status === 'expired' ? 'expired' : 'not_found' } });
  }

  if (now > pending.expires_at) {
    await deletePendingTransaction(invoiceId);
    if (inv.status !== 'expired') {
      await updateInvoiceStatus(invoiceId, merchantId, 'expired', null);
      await createInvoiceEvent({
        id: randomUUID(),
        invoice_id: invoiceId,
        merchant_id: merchantId,
        event_type: 'payment.expired',
        payload: { invoice_id: invoiceId },
        created_at: now,
      });

      // Enqueue webhook (if enabled)
      const whCfg = await getMerchantWebhookConfigEnv(merchantId, env);
      if (whCfg.webhook_enabled && whCfg.webhook_url) {
        await enqueueWebhookDelivery({
          merchant_id: merchantId,
          env,
          invoice_id: invoiceId,
          event_type: 'payment.expired',
          payload: { event_type: 'payment.expired', invoice_id: invoiceId, created_at: now },
          run_at: now,
        });
      }
    }
    return res.json({ success: true, data: { status: 'expired' } });
  }

  // Pull OrderKuota history and match amount as in legacy check
  const historyResult = (await getQrisHistory(String(username), String(token))) as Record<string, unknown>;
  const historyData = (historyResult?.qris_ajaib_history as Record<string, unknown>)?.results
    || (historyResult?.qris_history as Record<string, unknown>)?.results
    || [];

  const history = Array.isArray(historyData) ? historyData : [];
  const found = history.find((h: any) => {
    const kreditStr = String(h.kredit || '').replace(/\./g, '');
    const amt = parseInt(kreditStr, 10) || 0;
    return amt === pending.final_amount && h.status === 'IN';
  });

  if (found) {
    await deletePendingTransaction(invoiceId);
    await createPaidTransaction({
      id: invoiceId,
      username: String(username),
      final_amount: pending.final_amount,
      paid_at: now,
      expires_at: now + PAID_EXPIRY_SECONDS,
    });
    await updateInvoiceStatus(invoiceId, merchantId, 'paid', now);
    await createInvoiceEvent({
      id: randomUUID(),
      invoice_id: invoiceId,
      merchant_id: merchantId,
      event_type: 'payment.paid',
      payload: { invoice_id: invoiceId, final_amount: pending.final_amount, paid_at: now },
      created_at: now,
    });

    // Enqueue webhook (if enabled)
    const whCfg = await getMerchantWebhookConfigEnv(merchantId, env);
    if (whCfg.webhook_enabled && whCfg.webhook_url) {
      await enqueueWebhookDelivery({
        merchant_id: merchantId,
        env,
        invoice_id: invoiceId,
        event_type: 'payment.paid',
        payload: { event_type: 'payment.paid', invoice_id: invoiceId, final_amount: pending.final_amount, paid_at: now, created_at: now },
        run_at: now,
      });
    }

    return res.json({ success: true, data: { status: 'paid', final_amount: pending.final_amount, paid_at: now } });
  }

  return res.json({
    success: true,
    data: { status: 'pending', final_amount: pending.final_amount, expires_in: pending.expires_at - now },
  });
}
