import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import {
  initDb,
  getOrCreateMerchantByEmail,
  getMerchantByEmail,
  createVerificationRequest,
  getVerificationRequestByMerchantId,
  updateMerchantStatus,
  getSettingNumber,
  getMerchantCredentials,
  createOrRotateCredentials,
  createOrRotateSandboxCredentials,
  getMerchantWebhookConfig,
  setMerchantWebhookConfig,
  getMerchantWebhookConfigEnv,
  setMerchantWebhookConfigEnv,
  listIpWhitelist,
  addIpWhitelist,
  removeIpWhitelist,
  setIpWhitelistEnabled,
  isIpWhitelistEnabled,
  getMerchantStats,
  exportInvoicesCsv,
  exportWebhookDeliveriesCsv,
  listSettlementsForMerchant,
  listWebhookDeliveries,
} from "../../lib/db";

const router = express.Router();

import bcrypt from 'bcryptjs';

// === Register (email + password) ===
router.post('/auth/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !email.includes('@') || password.length < 6) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email/password tidak valid' } });
  }
  const existing = await getMerchantByEmail(email);
  if (existing && existing.password_hash) {
    return res.status(409).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'Email sudah terdaftar' } });
  }
  const hash = await bcrypt.hash(password, 10);
  let merchant = existing;
  if (!existing) {
    merchant = await getOrCreateMerchantByEmail(email);
  }
  const db = await import('../../lib/db');
  await db.default.getDb().then(dbInst => dbInst.run('UPDATE merchants SET password_hash = ? WHERE owner_email = ?', hash, email));
  return res.json({ success: true, data: { email } });
});

// === Login (email + password) ===
router.post('/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email/password wajib' } });
  }
  const merchant = await getMerchantByEmail(email);
  if (!merchant || !merchant.password_hash) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Email tidak ditemukan' } });
  }
  const ok = await bcrypt.compare(password, merchant.password_hash);
  if (!ok) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Password salah' } });
  }
  return res.json({ success: true, data: { email } });
});

// Ensure tables exist
router.use(async (_req, _res, next) => {
  try {
    await initDb();
    next();
  } catch (e) {
    next(e);
  }
});

function getUserEmail(req: express.Request): string | null {
  // Sementara (MVP): frontend simpan email dari "Login Google" mock.
  // Nanti bisa diganti ke Google OAuth session.
  const email = (req.headers["x-user-email"] as string | undefined)?.trim();
  return email ? email.toLowerCase() : null;
}

// === Mock Google login (sementara) ===
router.post("/auth/mock-google", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ success: false, error: { code: "INVALID_EMAIL", message: "Email tidak valid" } });
  }

  // Create merchant profile if doesn't exist
  await getOrCreateMerchantByEmail(email);
  // Frontend expects a simple ok flag for mock login
  return res.json({ success: true, data: { ok: true } });
});

// === Get current merchant profile ===
router.get("/me", async (req, res) => {
  const email = getUserEmail(req);
  if (!email) {
    return res.status(401).json({ success: false, error: { code: "UNAUTH", message: "Missing x-user-email" } });
  }
  const merchant = await getMerchantByEmail(email);
  if (!merchant) {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Merchant not found" } });
  }
  const vr = await getVerificationRequestByMerchantId(merchant.id);
  const rawAdmins = String(process.env.ADMIN_EMAILS || '').trim();
  const is_admin = rawAdmins
    ? new Set(rawAdmins.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)).has(email)
    : false;
  const creds = merchant.status === 'active' ? await getMerchantCredentials(merchant.id) : null;
  // Keep the response shape friendly for the Bolt UI (email + merchant summary)
  return res.json({
    success: true,
    data: {
      email,
      is_admin,
      merchant: { id: merchant.id, status: merchant.status },
      // extra fields used by dashboard pages
      merchant_full: merchant,
      verification_request: vr,
      credentials: creds,
    },
  });
});

// Get credentials (active only)
router.get('/credentials', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  }
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });
  const creds = await getMerchantCredentials(merchant.id);
  return res.json({ success: true, data: { merchant, credentials: creds } });
});


// Rotate sandbox API key (active only)
router.post('/credentials/rotate-sandbox', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  }
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });
  const creds = await createOrRotateSandboxCredentials(merchant.id);
  return res.json({ success: true, data: { merchant, sandbox_credentials: creds } });
});


// Rotate API key (+ webhook secret) (active only)
router.post('/credentials/rotate', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  }
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });
  const creds = await createOrRotateCredentials(merchant.id);
  return res.json({ success: true, data: { merchant, credentials: creds } });
});

// === Verification submit (1x) ===
const uploadDir = path.join(process.cwd(), "uploads", "verification");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 10) || ".png";
      cb(null, `${Date.now()}_${randomUUID()}${ext}`);
    },
  }),
  limits: {
    // Default 5MB, bisa diubah lewat setting (settings table)
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});

router.post("/verification/submit", upload.single("screenshot"), async (req, res) => {
  const email = getUserEmail(req);
  if (!email) {
    return res.status(401).json({ success: false, error: { code: "UNAUTH", message: "Missing x-user-email" } });
  }

  const merchant = await getOrCreateMerchantByEmail(email);

  if (merchant.status !== "unverified") {
    return res.status(409).json({
      success: false,
      error: {
        code: "ALREADY_SUBMITTED",
        message: "Pengajuan verifikasi sudah pernah dibuat. Mohon tunggu.",
      },
    });
  }

  const storeLink = String((req.body?.store_link ?? "")).trim();
  const wa = String((req.body?.wa_number ?? "")).trim();
  if (!storeLink || !/^https?:\/\//i.test(storeLink)) {
    return res.status(400).json({ success: false, error: { code: "INVALID_LINK", message: "Link merchant harus URL (http/https)" } });
  }
  if (!wa) {
    return res.status(400).json({ success: false, error: { code: "INVALID_WA", message: "Nomor WhatsApp wajib" } });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, error: { code: "MISSING_SCREENSHOT", message: "Screenshot merchant wajib" } });
  }

  const waitHours = await getSettingNumber("verification_wait_hours", 48);
  const now = Math.floor(Date.now() / 1000);

  const vr = await createVerificationRequest({
    merchant_id: merchant.id,
    store_link: storeLink,
    wa_number: wa,
    screenshot_path: path.relative(process.cwd(), req.file.path),
    submitted_at: now,
    wait_hours: waitHours,
  });

  await updateMerchantStatus(merchant.id, "submitted");

  return res.json({ success: true, data: { verification_request: vr, merchant: { ...merchant, status: "submitted" } } });
});


// === Webhook config (active only) ===
router.get('/webhook/config', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });
  const env = (typeof req.query.env === 'string' && req.query.env === 'sandbox') ? 'sandbox' : 'production';
  const cfg = await getMerchantWebhookConfigEnv(merchant.id, env);
  return res.json({ success: true, data: { webhook_config: cfg } });
});

router.post('/webhook/config', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });

  const webhook_url = typeof req.body?.webhook_url === 'string' ? String(req.body.webhook_url).trim() : null;
  const webhook_enabled = req.body?.webhook_enabled === true;

  if (webhook_url && !/^https?:\/\//i.test(webhook_url)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'webhook_url harus http/https' } });
  }

  await setMerchantWebhookConfig(merchant.id, { webhook_url, webhook_enabled });
  const env = (typeof req.query.env === 'string' && req.query.env === 'sandbox') ? 'sandbox' : 'production';
  const cfg = await getMerchantWebhookConfigEnv(merchant.id, env);
  return res.json({ success: true, data: { webhook_config: cfg } });
});

// Webhook deliveries log (active only)
router.get('/webhook/deliveries', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });

  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  const deliveries = await listWebhookDeliveries(merchant.id, limit, offset);
  return res.json({ success: true, data: { deliveries, limit, offset } });
});



// === Security: IP whitelist (active only) ===
router.get('/security/ip-whitelist', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });
  const enabled = await isIpWhitelistEnabled(merchant.id);
  const cidrs = await listIpWhitelist(merchant.id);
  return res.json({ success: true, data: { enabled, cidrs } });
});

router.post('/security/ip-whitelist', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });

  const cidr = typeof req.body?.cidr === 'string' ? String(req.body.cidr).trim() : '';
  const enabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : null;

  if (enabled !== null) await setIpWhitelistEnabled(merchant.id, enabled);
  if (cidr) await addIpWhitelist(merchant.id, cidr);

  const outEnabled = await isIpWhitelistEnabled(merchant.id);
  const cidrs = await listIpWhitelist(merchant.id);
  return res.json({ success: true, data: { enabled: outEnabled, cidrs } });
});

router.delete('/security/ip-whitelist', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });

  const cidr = typeof req.body?.cidr === 'string' ? String(req.body.cidr).trim() : '';
  if (!cidr) return res.status(400).json({ success: false, error: { code: 'MISSING_CIDR', message: 'cidr required' } });

  await removeIpWhitelist(merchant.id, cidr);
  const cidrs = await listIpWhitelist(merchant.id);
  const enabled = await isIpWhitelistEnabled(merchant.id);
  return res.json({ success: true, data: { enabled, cidrs } });
});

// === Stats, settlements, exports (active only) ===
router.get('/stats', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
  const stats = await getMerchantStats(merchant.id, days);
  return res.json({ success: true, data: { stats } });
});

router.get('/settlements', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });
  const items = await listSettlementsForMerchant(merchant.id, 60);
  return res.json({ success: true, data: { items } });
});

router.get('/exports/invoices.csv', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });
  const from_ts = req.query.from_ts ? Number(req.query.from_ts) : null;
  const to_ts = req.query.to_ts ? Number(req.query.to_ts) : null;
  const csv = await exportInvoicesCsv({ merchant_id: merchant.id, from_ts, to_ts, limit: 50000 });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
});

router.get('/exports/webhooks.csv', async (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.status(401).json({ success: false, error: { code: 'UNAUTH', message: 'Missing x-user-email' } });
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
  if (merchant.status !== 'active') return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });
  const from_ts = req.query.from_ts ? Number(req.query.from_ts) : null;
  const to_ts = req.query.to_ts ? Number(req.query.to_ts) : null;
  const csv = await exportWebhookDeliveriesCsv({ merchant_id: merchant.id, from_ts, to_ts, limit: 50000 });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
});


export default router;
