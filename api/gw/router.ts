import ipaddr from 'ipaddr.js';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  initDb,
  verifyApiKeyWithEnv,
  getMerchantById,
  isIpWhitelistEnabled,
  listIpWhitelist,
} from '../../lib/db';

// Reuse existing handlers (keeps behavior identical)
import qrisGenerate from '../qris/generate';
import qrisCheck from '../qris/check';
import qrisImage from '../qris/image';
import balance from '../account/balance';

import { requireSignedRequest } from './security';
import { createInvoice, getInvoice, listMyInvoices, checkInvoice, listEvents } from './invoices';

declare global {
  // eslint-disable-next-line no-var
  var __dummy: unknown;
}

type AuthedRequest = express.Request & {
  merchantId?: string;
  gwEnv?: 'production' | 'sandbox';
  rawBody?: string;
};

const router = express.Router();

// Ensure DB tables exist
router.use(async (_req, _res, next) => {
  try {
    await initDb();
    next();
  } catch (e) {
    next(e);
  }
});

// --- API Key auth (merchant active only) ---
router.use(async (req: AuthedRequest, res, next) => {
  const apiKey = String(req.header('x-api-key') || '').trim();
  if (!apiKey) {
    return res.status(401).json({ success: false, error: { code: 'MISSING_API_KEY', message: 'Missing x-api-key' } });
  }
  const verified = await verifyApiKeyWithEnv(apiKey);
  if (!verified) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_API_KEY', message: 'Invalid API key' } });
  }
  const merchantId = verified.merchant_id;
  const merchant = await getMerchantById(merchantId);
  if (!merchant) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_API_KEY', message: 'Invalid API key' } });
  }
  if (merchant.status !== 'active') {
    return res.status(403).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Merchant belum aktif' } });
  }
  req.merchantId = merchantId;
  req.gwEnv = verified.env;
  next();
});



// --- Optional IP whitelist (per-merchant) ---
router.use(async (req: AuthedRequest, res, next) => {
  try {
    if (!req.merchantId) return next();
    const enabled = await isIpWhitelistEnabled(req.merchantId);
    if (!enabled) return next();

    const cidrs = await listIpWhitelist(req.merchantId);
    if (!cidrs.length) {
      return res.status(403).json({ success: false, error: { code: 'IP_NOT_ALLOWED', message: 'IP whitelist enabled but empty' } });
    }

    const xff = String(req.header('x-forwarded-for') || '').split(',')[0].trim();
    const ipRaw = xff || req.ip || '';
    let ip = ipRaw;
    if (ip.startsWith('::ffff:')) ip = ip.slice(7);

    let parsed: any;
    try { parsed = ipaddr.parse(ip); } catch { parsed = null; }
    if (!parsed) {
      return res.status(403).json({ success: false, error: { code: 'IP_NOT_ALLOWED', message: 'Cannot parse client IP' } });
    }

    const ok = cidrs.some((c) => {
      const s = String(c).trim();
      try {
        if (s.includes('/')) {
          const [range, bits] = ipaddr.parseCIDR(s);
          return parsed.match(range, bits);
        }
        const target = ipaddr.parse(s);
        return parsed.toNormalizedString() === target.toNormalizedString();
      } catch {
        return false;
      }
    });

    if (!ok) {
      return res.status(403).json({ success: false, error: { code: 'IP_NOT_ALLOWED', message: 'Client IP not in whitelist' } });
    }

    next();
  } catch (e) { next(e); }
});

// --- Ideal security: timestamp + nonce + HMAC signature ---
router.use(requireSignedRequest({
  windowSeconds: Number(process.env.SIGN_WINDOW_SECONDS || 60),
  nonceTtlSeconds: Number(process.env.NONCE_TTL_SECONDS || 120),
}));

// --- Rate limit per merchant (default 120 req/min) ---
const perMinute = Number(process.env.RATE_LIMIT_PER_MINUTE || 120);
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: isFinite(perMinute) && perMinute > 0 ? perMinute : 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthedRequest) => req.merchantId || req.ip,
    handler: (_req, res) => {
      res.status(429).json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } });
    },
  })
);

// Health (authenticated)
router.get('/health', (req: AuthedRequest, res) => {
  res.json({ success: true, data: { ok: true, merchant_id: req.merchantId } });
});

// QRIS + Balance endpoints (protected) — behavior identical to legacy ones
router.all('/account/balance', (req, res) => balance(req as any, res as any));
router.all('/qris/generate', (req, res) => qrisGenerate(req as any, res as any));
router.all('/qris/check', (req, res) => qrisCheck(req as any, res as any));
router.all('/qris/image', (req, res) => qrisImage(req as any, res as any));

// -----------------
// Invoice / Payment Object (gateway style)
// -----------------
router.post('/invoices', (req, res) => createInvoice(req as any, res));
router.get('/invoices', (req, res) => listMyInvoices(req as any, res));
router.get('/invoices/:id', (req, res) => getInvoice(req as any, res));
router.post('/invoices/:id/check', (req, res) => checkInvoice(req as any, res));
router.get('/invoices/:id/events', (req, res) => listEvents(req as any, res));

export default router;
