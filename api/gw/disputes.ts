import type express from 'express';
import { createDispute, listDisputesForMerchant, getInvoiceById } from '../../lib/db';

type AuthedRequest = express.Request & { merchantId?: string };

export async function openDispute(req: AuthedRequest, res: express.Response) {
  const merchantId = req.merchantId;
  if (!merchantId) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Merchant unauthenticated' } });
  const invoiceId = String(req.params.id || '').trim();
  const inv = await getInvoiceById(invoiceId, merchantId);
  if (!inv) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });

  const { message, evidence_url } = req.body || {};
  if (!message) return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'message required' } });

  const id = await createDispute({ invoice_id: invoiceId, merchant_id: merchantId, message: String(message), evidence_url: evidence_url ? String(evidence_url) : null });
  return res.json({ success: true, data: { dispute_id: id, status: 'open' } });
}

export async function listMyDisputes(req: AuthedRequest, res: express.Response) {
  const merchantId = req.merchantId;
  if (!merchantId) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Merchant unauthenticated' } });
  const items = await listDisputesForMerchant(merchantId, 200);
  return res.json({ success: true, data: { items } });
}
