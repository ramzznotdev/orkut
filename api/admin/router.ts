import express from 'express';
import path from 'path';
import fs from 'fs';
import { validateQris, generateDynamicQris } from '../../lib/qris';

import {
  initDb,
  // Verification
  listSubmittedVerificationRequests,
  getVerificationRequestById,
  approveVerification,
  rejectVerification,
  needMoreInfoVerification,
  getMerchantById,
  updateMerchantWa,
  getMerchantCredentials,

  // CMS + settings
  listAllSettings,
  setSetting,
  getSettingRaw,
  upsertSitePage,
  deleteSitePage,
  getSitePage,
  listSitePages,
  upsertMessageTemplate,
  getMessageTemplate,
  listMessageTemplates,

  // Webhook deliveries (admin)
  listWebhookDeliveries,
  getMerchantWebhookConfig,

  // Operations
  listRefundsByStatus,
  approveRefund,
  rejectRefund,
  processRefund,
  listDisputesByStatus,
  updateDisputeAdmin,
  runSettlementForDate,
  listSettlements,
  markSettlementCompleted,
  createPayout,
  markPayoutPaid,
  getGlobalStats,
  exportInvoicesCsv,
  exportWebhookDeliveriesCsv,
  listOpenAlerts,
  resolveAlert,
} from '../../lib/db';

const router = express.Router();

router.use(async (_req, _res, next) => {
  try {
    await initDb();
    next();
  } catch (e) {
    next(e);
  }
});

function getUserEmail(req: express.Request): string | null {
  const email = (req.headers['x-user-email'] as string | undefined)?.trim();
  return email ? email.toLowerCase() : null;
}

function isAdminEmail(email: string): boolean {
  const raw = String(process.env.ADMIN_EMAILS || '').trim();
  if (!raw) return false;
  const set = new Set(raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  return set.has(email.toLowerCase());
}

function requireAdmin(req: express.Request, res: express.Response): string | null {
  const email = getUserEmail(req);
  if (!email) {
    res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
    return null;
  }
  if (!isAdminEmail(email)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return null;
  }
  return email;
}




// =====================
// Operator Settings: OrderKuota (Secrets)
// =====================
function maskSecret(v: string, head = 6, tail = 4): string {
  if (!v) return '';
  if (v.length <= head + tail + 3) return v.slice(0, 2) + '…' + v.slice(-2);
  return v.slice(0, head) + '…' + v.slice(-tail);
}

// GET current (masked)
router.get('/settings/orderkuota', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;

  const s = (await getSettingRaw('orderkuota_operator')) || null;
  const token = s?.token ? String(s.token) : '';
  const staticQris = s?.qris_static ? String(s.qris_static) : '';
  const usn = s?.usn ? String(s.usn) : '';
  const idOrkut = s?.idOrkut ? String(s.idOrkut) : '';
  const baseUrl = s?.base_url ? String(s.base_url) : '';

  res.json({
    success: true,
    data: {
      connected: !!token,
      base_url: baseUrl,
      usn,
      idOrkut,
      token_masked: token ? maskSecret(token) : null,
      pw_masked: s?.pwOrkut ? maskSecret(String(s.pwOrkut)) : null,
      pin_masked: s?.pinOrkut ? maskSecret(String(s.pinOrkut), 2, 1) : null,
      qris_static_masked: staticQris ? maskSecret(staticQris, 12, 8) : null,
      qris_static_valid: staticQris ? validateQris(staticQris) : false,
      updated_at: s?.updated_at || null,
    }
  });
});

// PUT update (secrets stored in DB settings)
router.put('/settings/orderkuota', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;

  const body = req.body || {};
  const next = {
    base_url: typeof body.base_url === 'string' ? body.base_url.trim() : '',
    usn: typeof body.usn === 'string' ? body.usn.trim() : '',
    idOrkut: typeof body.idOrkut === 'string' ? body.idOrkut.trim() : '',
    token: typeof body.token === 'string' ? body.token.trim() : '',
    pwOrkut: typeof body.pwOrkut === 'string' ? body.pwOrkut : '',
    pinOrkut: typeof body.pinOrkut === 'string' ? body.pinOrkut : '',
    qris_static: typeof body.qris_static === 'string' ? body.qris_static.trim() : '',
  };

  if (!next.token) return res.status(400).json({ success: false, error: { code: 'INVALID', message: 'token wajib' } });
  if (!next.qris_static) return res.status(400).json({ success: false, error: { code: 'INVALID', message: 'qris_static wajib (string QRIS statis)' } });
  if (!validateQris(next.qris_static)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_QRIS', message: 'QRIS statis tidak valid (CRC mismatch). Pastikan paste payload string, bukan gambar.' } });
  }

  const now = Math.floor(Date.now() / 1000);
  await setSetting('orderkuota_operator', { ...next, updated_at: now });

  res.json({ success: true, data: { ok: true } });
});

// POST test generate QRIS dinamis dari QRIS statis yang disimpan
router.post('/tools/qris-test', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;

  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'amount tidak valid' } });
  }

  const s = (await getSettingRaw('orderkuota_operator')) || null;
  const staticQris = s?.qris_static ? String(s.qris_static) : '';
  if (!staticQris) {
    return res.status(400).json({ success: false, error: { code: 'NOT_CONFIGURED', message: 'QRIS statis belum diset di Admin Settings' } });
  }
  if (!validateQris(staticQris)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_QRIS', message: 'QRIS statis tersimpan invalid (CRC mismatch)' } });
  }

  const dynamic = generateDynamicQris(staticQris, amount);
  const dynamicValid = validateQris(dynamic);

  res.json({
    success: true,
    data: {
      amount,
      qris_static_valid: true,
      qris_dynamic: dynamic,
      qris_dynamic_valid: dynamicValid,
    }
  });
});

// =====================
// Verification Review
// =====================
router.get('/verification/queue', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const items = await listSubmittedVerificationRequests();
  res.json({ success: true, data: { items } });
});

router.get('/verification/:id', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const vr = await getVerificationRequestById(String(req.params.id));
  if (!vr) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
  const merchant = await getMerchantById(vr.merchant_id);
  const creds = merchant ? await getMerchantCredentials(merchant.id) : null;
  res.json({ success: true, data: { vr, merchant, credentials: creds } });
});

router.get('/verification/:id/screenshot', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const vr = await getVerificationRequestById(String(req.params.id));
  if (!vr) return res.status(404).end();
  const abs = path.join(process.cwd(), vr.screenshot_path);
  if (!fs.existsSync(abs)) return res.status(404).end();
  res.sendFile(abs);
});

router.post('/verification/:id/approve', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const wa = typeof req.body?.wa_number === 'string' ? String(req.body.wa_number).trim() : undefined;
  const { merchant, credentials } = await approveVerification({ id: String(req.params.id), reviewed_by: adminEmail, wa_number: wa });
  res.json({ success: true, data: { merchant, credentials } });
});

router.post('/verification/:id/reject', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ success: false, error: { code: 'INVALID_REASON', message: 'Reason wajib' } });
  const wa = typeof req.body?.wa_number === 'string' ? String(req.body.wa_number).trim() : undefined;
  await rejectVerification({ id: String(req.params.id), reviewed_by: adminEmail, reason, wa_number: wa });
  res.json({ success: true, data: { ok: true } });
});

router.post('/verification/:id/need-more-info', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ success: false, error: { code: 'INVALID_REASON', message: 'Reason wajib' } });
  const wa = typeof req.body?.wa_number === 'string' ? String(req.body.wa_number).trim() : undefined;
  await needMoreInfoVerification({ id: String(req.params.id), reviewed_by: adminEmail, reason, wa_number: wa });
  res.json({ success: true, data: { ok: true } });
});

router.patch('/merchants/:id/wa', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const wa = typeof req.body?.wa_number === 'string' ? String(req.body.wa_number).trim() : null;
  const enabled = req.body?.wa_enabled === false ? false : true;
  await updateMerchantWa(String(req.params.id), wa, enabled);
  const merchant = await getMerchantById(String(req.params.id));
  res.json({ success: true, data: { merchant } });
});

// =====================
// CMS + Settings
// =====================
router.get('/settings', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const settings = await listAllSettings();
  res.json({ success: true, data: { settings } });
});

router.put('/settings/:key', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const key = String(req.params.key || '').trim();
  await setSetting(key, req.body?.value);
  const value = await getSettingRaw(key);
  res.json({ success: true, data: { key, value } });
});

router.get('/pages', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const pages = await listSitePages();
  res.json({ success: true, data: { pages } });
});

router.get('/pages/:slug', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const slug = String(req.params.slug || '').trim();
  const page = await getSitePage(slug);
  if (!page) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Page not found' } });
  res.json({ success: true, data: { page } });
});

router.put('/pages/:slug', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const slug = String(req.params.slug || '').trim();
  const title = String(req.body?.title || '').trim() || slug;
  const content_md = String(req.body?.content_md || '').trim();
  if (!content_md) return res.status(400).json({ success: false, error: { code: 'INVALID_CONTENT', message: 'content_md required' } });
  await upsertSitePage(slug, title, content_md);
  const page = await getSitePage(slug);
  res.json({ success: true, data: { page } });
});

router.delete('/pages/:slug', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const slug = String(req.params.slug || '').trim();
  await deleteSitePage(slug);
  res.json({ success: true, data: { ok: true } });
});

router.get('/templates', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const templates = await listMessageTemplates();
  res.json({ success: true, data: { templates } });
});

router.get('/templates/:key', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const key = String(req.params.key || '').trim();
  const t = await getMessageTemplate(key);
  if (!t) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
  res.json({ success: true, data: { template: t } });
});

router.put('/templates/:key', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const key = String(req.params.key || '').trim();
  const template_text = String(req.body?.template_text || '').trim();
  if (!template_text) return res.status(400).json({ success: false, error: { code: 'INVALID_TEMPLATE', message: 'template_text required' } });
  await upsertMessageTemplate(key, template_text);
  const t = await getMessageTemplate(key);
  res.json({ success: true, data: { template: t } });
});

// =====================
// Webhook deliveries (admin)
// =====================
router.get('/webhooks/deliveries', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const merchantId = typeof req.query.merchant_id === 'string' ? req.query.merchant_id : null;
  if (!merchantId) return res.status(400).json({ success: false, error: { code: 'MISSING_MERCHANT', message: 'merchant_id query required' } });
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  const deliveries = await listWebhookDeliveries(String(merchantId), limit, offset);
  const cfg = await getMerchantWebhookConfig(String(merchantId));
  res.json({ success: true, data: { deliveries, webhook_config: cfg } });
});

// =====================
// Operations: stats, refunds, disputes, settlements, exports, alerts
// =====================
router.get('/stats', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
  const stats = await getGlobalStats(days);
  res.json({ success: true, data: { stats } });
});

// Refunds
router.get('/refunds', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const status = String(req.query.status || 'requested') as any;
  const items = await listRefundsByStatus(status, 200);
  res.json({ success: true, data: { items } });
});

router.post('/refunds/:id/approve', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  await approveRefund(String(req.params.id), adminEmail);
  res.json({ success: true, data: { ok: true } });
});

router.post('/refunds/:id/reject', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  await rejectRefund(String(req.params.id), adminEmail);
  res.json({ success: true, data: { ok: true } });
});

router.post('/refunds/:id/process', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  await processRefund(String(req.params.id), adminEmail);
  res.json({ success: true, data: { ok: true } });
});

// Disputes
router.get('/disputes', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const status = String(req.query.status || 'open') as any;
  const items = await listDisputesByStatus(status, 200);
  res.json({ success: true, data: { items } });
});

router.patch('/disputes/:id', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const status = String(req.body?.status || '').trim();
  if (!status) return res.status(400).json({ success: false, error: { code: 'MISSING_STATUS', message: 'status required' } });
  const admin_note = typeof req.body?.admin_note === 'string' ? String(req.body.admin_note) : null;
  await updateDisputeAdmin({ id: String(req.params.id), status: status as any, admin_note });
  res.json({ success: true, data: { ok: true } });
});

// Settlements
router.post('/settlements/run', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const date = String(req.body?.period_date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ success: false, error: { code: 'INVALID_DATE', message: 'period_date must be YYYY-MM-DD' } });
  const out = await runSettlementForDate(date);
  res.json({ success: true, data: out });
});

router.get('/settlements', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const items = await listSettlements(200);
  res.json({ success: true, data: { items } });
});

router.post('/settlements/:id/complete', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  await markSettlementCompleted(String(req.params.id));
  res.json({ success: true, data: { ok: true } });
});

router.post('/settlements/:id/payout', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const method = String(req.body?.method || 'manual').trim();
  const reference = String(req.body?.reference || '').trim() || 'manual';
  const id = await createPayout(String(req.params.id), method, reference);
  res.json({ success: true, data: { payout_id: id } });
});

router.post('/payouts/:id/paid', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  await markPayoutPaid(String(req.params.id));
  res.json({ success: true, data: { ok: true } });
});

// Exports
router.get('/exports/invoices.csv', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const merchant_id = typeof req.query.merchant_id === 'string' ? String(req.query.merchant_id) : null;
  const from_ts = req.query.from_ts ? Number(req.query.from_ts) : null;
  const to_ts = req.query.to_ts ? Number(req.query.to_ts) : null;
  const csv = await exportInvoicesCsv({ merchant_id, from_ts, to_ts, limit: 50000 });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
});

router.get('/exports/webhooks.csv', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const merchant_id = typeof req.query.merchant_id === 'string' ? String(req.query.merchant_id) : null;
  if (!merchant_id) return res.status(400).json({ success: false, error: { code: 'MISSING_MERCHANT', message: 'merchant_id required' } });
  const from_ts = req.query.from_ts ? Number(req.query.from_ts) : null;
  const to_ts = req.query.to_ts ? Number(req.query.to_ts) : null;
  const csv = await exportWebhookDeliveriesCsv({ merchant_id, from_ts, to_ts, limit: 50000 });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
});

// Alerts
router.get('/alerts', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  const items = await listOpenAlerts(100);
  res.json({ success: true, data: { items } });
});

router.post('/alerts/:id/resolve', async (req, res) => {
  const adminEmail = requireAdmin(req, res);
  if (!adminEmail) return;
  await resolveAlert(String(req.params.id));
  res.json({ success: true, data: { ok: true } });
});

export default router;
