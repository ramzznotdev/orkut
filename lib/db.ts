import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import { PendingTransaction, PaidTransaction } from './types.js';
import fs from 'fs';
import path from 'path';
import { createHash, randomBytes, randomUUID } from 'crypto';

let dbPromise: Promise<Database> | null = null;

function getDbPath(): string {
  // Default location inside the project (good for Pterodactyl volume)
  return process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'orderkuota.sqlite');
}

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    const filename = getDbPath();
    fs.mkdirSync(path.dirname(filename), { recursive: true });

    dbPromise = open({
      filename,
      driver: sqlite3.Database,
    });

    // Helpful pragmas for small/medium workloads
    const db = await dbPromise;
    await db.exec('PRAGMA journal_mode=WAL;');
    await db.exec('PRAGMA synchronous=NORMAL;');
    await db.exec('PRAGMA foreign_keys=ON;');
  }

  return dbPromise;
}

export async function initDb(): Promise<void> {
  const db = await getDb();

  // ---- Settings (configurable, non-hardcode) ----
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Default settings (idempotent)
  const now = Math.floor(Date.now() / 1000);
  await db.run(
    `INSERT OR IGNORE INTO settings(key, value_json, updated_at) VALUES(?, ?, ?)`
    ,
    'verification_wait_hours',
    JSON.stringify(48),
    now
  );

  await db.run(
    `INSERT OR IGNORE INTO settings(key, value_json, updated_at) VALUES(?, ?, ?)`
    ,
    'upload_max_mb',
    JSON.stringify(5),
    now
  );

  await db.run(
    `INSERT OR IGNORE INTO settings(key, value_json, updated_at) VALUES(?, ?, ?)`
    ,
    'wa_required',
    JSON.stringify(true),
    now
  );

  await db.exec(`
    CREATE TABLE IF NOT EXISTS pending_transactions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      base_amount INTEGER NOT NULL,
      unique_suffix INTEGER NOT NULL,
      final_amount INTEGER NOT NULL,
      qris_string TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS paid_transactions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      final_amount INTEGER NOT NULL,
      paid_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_suffix
    ON pending_transactions(username, unique_suffix);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pending_expires
    ON pending_transactions(expires_at);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_paid_expires
    ON paid_transactions(expires_at);
  `);

  // ---- Merchant + Verification (flow baru) ----
  await db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      status TEXT NOT NULL,
      wa_number TEXT,
      wa_enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Migration: add password_hash if missing
  try {
    await db.exec('ALTER TABLE merchants ADD COLUMN password_hash TEXT;');
  } catch {
    // ignore if already exists
  }

  // Merchant credentials (API key + webhook secret)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS merchant_credentials (
      merchant_id TEXT PRIMARY KEY,
      api_key_hash TEXT NOT NULL,
      api_key_prefix TEXT NOT NULL,
      api_secret TEXT NOT NULL,
      webhook_secret TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      rotated_at INTEGER,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );
  `);

  // Lightweight migration for older DBs: add api_secret if missing
  try {
    await db.exec(`ALTER TABLE merchant_credentials ADD COLUMN api_secret TEXT;`);
  } catch {
    // ignore if column already exists
  }
  // Backfill any NULL/empty api_secret values
  try {
    const rows = await db.all<any[]>(`SELECT merchant_id FROM merchant_credentials WHERE api_secret IS NULL OR api_secret = ''`);
    for (const r of rows) {
      const sec = randomToken('sksec_', 24);
      await db.run('UPDATE merchant_credentials SET api_secret = ? WHERE merchant_id = ?', sec, String(r.merchant_id));
    }
  } catch {
    // ignore
  }
  // Nonce store for anti-replay (TTL-based)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS used_nonces (
      merchant_id TEXT NOT NULL,
      nonce TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (merchant_id, nonce),
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_used_nonces_expires ON used_nonces(expires_at);
  `);

  // ---- Invoice / Payment Object (gateway) ----
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      username TEXT NOT NULL,
      reference_id TEXT,
      base_amount INTEGER NOT NULL,
      unique_suffix INTEGER NOT NULL,
      final_amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      qris_string TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      paid_at INTEGER,
      metadata_json TEXT,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );
  `);

  try { await db.exec(`ALTER TABLE invoices ADD COLUMN env TEXT NOT NULL DEFAULT 'production';`); } catch {}
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_invoices_merchant_created ON invoices(merchant_id, created_at);
  `);
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_events (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice ON invoice_events(invoice_id, created_at);
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS verification_requests (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL UNIQUE,
      store_link TEXT NOT NULL,
      wa_number TEXT NOT NULL,
      screenshot_path TEXT NOT NULL,
      status TEXT NOT NULL,
      submitted_at INTEGER NOT NULL,
      reviewed_at INTEGER,
      reviewed_by TEXT,
      reason TEXT,
      wait_hours INTEGER NOT NULL,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);
  `);


  // ---- CMS (pages + templates) ----
  await db.exec(`
    CREATE TABLE IF NOT EXISTS site_pages (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content_md TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS message_templates (
      key TEXT PRIMARY KEY,
      template_text TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // ---- Webhook config + deliveries ----
  try { await db.exec(`ALTER TABLE merchants ADD COLUMN webhook_url TEXT;`); } catch {}
  try { await db.exec(`ALTER TABLE merchants ADD COLUMN webhook_enabled INTEGER NOT NULL DEFAULT 0;`); } catch {}

  await db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      invoice_id TEXT,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL,
      next_retry_at INTEGER NOT NULL,
      last_status_code INTEGER,
      last_error TEXT,
      response_snippet TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );
  `);

    try { await db.exec(`ALTER TABLE webhook_deliveries ADD COLUMN env TEXT NOT NULL DEFAULT 'production';`); } catch {}
await db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_due ON webhook_deliveries(status, next_retry_at);`);

// ---- Security: IP whitelist + per-merchant fee config + sandbox config ----
try { await db.exec(`ALTER TABLE merchants ADD COLUMN ip_whitelist_enabled INTEGER NOT NULL DEFAULT 0;`); } catch {}
try { await db.exec(`ALTER TABLE merchants ADD COLUMN fee_bps INTEGER NOT NULL DEFAULT 0;`); } catch {}
try { await db.exec(`ALTER TABLE merchants ADD COLUMN fee_fixed INTEGER NOT NULL DEFAULT 0;`); } catch {}
try { await db.exec(`ALTER TABLE merchants ADD COLUMN suspended_reason TEXT;`); } catch {}
try { await db.exec(`ALTER TABLE merchants ADD COLUMN sandbox_webhook_url TEXT;`); } catch {}
try { await db.exec(`ALTER TABLE merchants ADD COLUMN sandbox_webhook_enabled INTEGER NOT NULL DEFAULT 0;`); } catch {}

await db.exec(`
  CREATE TABLE IF NOT EXISTS merchant_ip_whitelist (
    merchant_id TEXT NOT NULL,
    cidr TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (merchant_id, cidr),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
  );
`);

await db.exec(`CREATE INDEX IF NOT EXISTS idx_ip_whitelist_merchant ON merchant_ip_whitelist(merchant_id);`);

// ---- Sandbox credentials columns (kept in same table for easy migration) ----
try { await db.exec(`ALTER TABLE merchant_credentials ADD COLUMN sandbox_api_key_hash TEXT;`); } catch {}
try { await db.exec(`ALTER TABLE merchant_credentials ADD COLUMN sandbox_api_key_prefix TEXT;`); } catch {}
try { await db.exec(`ALTER TABLE merchant_credentials ADD COLUMN sandbox_api_secret TEXT;`); } catch {}
try { await db.exec(`ALTER TABLE merchant_credentials ADD COLUMN sandbox_webhook_secret TEXT;`); } catch {}

// ---- Refunds & disputes ----
await db.exec(`
  CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT,
    status TEXT NOT NULL,
    requested_at INTEGER NOT NULL,
    approved_at INTEGER,
    processed_at INTEGER,
    approved_by TEXT,
    processed_by TEXT,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
  );
`);
await db.exec(`CREATE INDEX IF NOT EXISTS idx_refunds_merchant ON refunds(merchant_id, requested_at);`);
await db.exec(`CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status, requested_at);`);

await db.exec(`
  CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    evidence_url TEXT,
    admin_note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
  );
`);
await db.exec(`CREATE INDEX IF NOT EXISTS idx_disputes_merchant ON disputes(merchant_id, created_at);`);
await db.exec(`CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status, created_at);`);

// ---- Settlement & payout (audit) ----
await db.exec(`
  CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    period_date TEXT NOT NULL, -- YYYY-MM-DD (merchant local)
    gross_amount INTEGER NOT NULL,
    fee_amount INTEGER NOT NULL,
    net_amount INTEGER NOT NULL,
    status TEXT NOT NULL, -- pending|completed
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    UNIQUE(merchant_id, period_date),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
  );
`);
await db.exec(`CREATE INDEX IF NOT EXISTS idx_settlements_merchant ON settlements(merchant_id, period_date);`);

await db.exec(`
  CREATE TABLE IF NOT EXISTS settlement_items (
    settlement_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    fee INTEGER NOT NULL,
    net INTEGER NOT NULL,
    PRIMARY KEY (settlement_id, invoice_id),
    FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  );
`);

await db.exec(`
  CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY,
    settlement_id TEXT NOT NULL,
    method TEXT,
    reference TEXT,
    status TEXT NOT NULL, -- pending|paid|failed
    created_at INTEGER NOT NULL,
    paid_at INTEGER,
    FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE
  );
`);

// ---- Alerts (simple monitoring) ----
await db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    merchant_id TEXT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
  );
`);
await db.exec(`CREATE INDEX IF NOT EXISTS idx_alerts_open ON alerts(resolved_at, created_at);`);

}

// -----------------
// Settings helpers
// -----------------
export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const db = await getDb();
  const row = await db.get<any>('SELECT value_json FROM settings WHERE key = ?', key);
  if (!row) return fallback;
  try {
    const v = JSON.parse(String(row.value_json));
    const num = Number(v);
    return Number.isFinite(num) ? num : fallback;
  } catch {
    return fallback;
  }
}

// -----------------
// Merchant helpers
// -----------------
export type Merchant = {
  id: string;
  owner_email: string;
  password_hash?: string | null;
  status: 'unverified' | 'submitted' | 'active' | 'rejected' | 'suspended';
  wa_number?: string | null;
  wa_enabled?: number;
  created_at: number;
  updated_at: number;
};

export type MerchantCredentials = {
  merchant_id: string;
  api_key_prefix: string;
  api_secret?: string;
  webhook_secret: string;
  created_at: number;
  rotated_at: number | null;
};

export type Invoice = {
  id: string;
  merchant_id: string;
  env?: 'production' | 'sandbox';
  username: string;
  reference_id: string | null;
  base_amount: number;
  unique_suffix: number;
  final_amount: number;
  status: 'created' | 'pending' | 'paid' | 'expired' | 'refunded';
  qris_string: string;
  created_at: number;
  expires_at: number;
  paid_at: number | null;
  metadata_json: string | null;
};

export type VerificationRequest = {
  id: string;
  merchant_id: string;
  store_link: string;
  wa_number: string;
  screenshot_path: string;
  status: 'submitted' | 'approved' | 'rejected' | 'need_more_info';
  submitted_at: number;
  reviewed_at: number | null;
  reviewed_by: string | null;
  reason: string | null;
  wait_hours: number;
};

export async function getMerchantByEmail(email: string): Promise<Merchant | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT * FROM merchants WHERE owner_email = ?', email.toLowerCase());
  if (!row) return null;
  return {
    id: String(row.id),
    owner_email: String(row.owner_email),
    password_hash: row.password_hash ? String(row.password_hash) : null,
    status: String(row.status) as Merchant['status'],
    wa_number: row.wa_number ? String(row.wa_number) : null,
    wa_enabled: typeof row.wa_enabled === 'number' ? row.wa_enabled : Number(row.wa_enabled ?? 1),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

export async function getMerchantById(id: string): Promise<Merchant | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT * FROM merchants WHERE id = ?', id);
  if (!row) return null;
  return {
    id: String(row.id),
    owner_email: String(row.owner_email),
    status: String(row.status) as any,
    wa_number: row.wa_number ? String(row.wa_number) : null,
    wa_enabled: typeof row.wa_enabled === 'number' ? row.wa_enabled : Number(row.wa_enabled ?? 1),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

export async function getOrCreateMerchantByEmail(email: string): Promise<Merchant> {
  const normalized = email.toLowerCase();
  const existing = await getMerchantByEmail(normalized);
  if (existing) return existing;

  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const id = randomUUID();
  await db.run(
    'INSERT INTO merchants (id, owner_email, status, wa_number, wa_enabled, created_at, updated_at) VALUES (?, ?, ?, NULL, 1, ?, ?)',
    id,
    normalized,
    'unverified',
    now,
    now
  );
  return {
    id,
    owner_email: normalized,
    status: 'unverified',
    wa_number: null,
    wa_enabled: 1,
    created_at: now,
    updated_at: now,
  };
}

export async function updateMerchantStatus(merchantId: string, status: Merchant['status']): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('UPDATE merchants SET status = ?, updated_at = ? WHERE id = ?', status, now, merchantId);
}

export async function updateMerchantWa(merchantId: string, wa_number: string | null, wa_enabled: boolean): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('UPDATE merchants SET wa_number = ?, wa_enabled = ?, updated_at = ? WHERE id = ?', wa_number, wa_enabled ? 1 : 0, now, merchantId);
}

export async function getMerchantCredentials(merchantId: string): Promise<MerchantCredentials | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT * FROM merchant_credentials WHERE merchant_id = ?', merchantId);
  if (!row) return null;
  return {
    merchant_id: String(row.merchant_id),
    api_key_prefix: String(row.api_key_prefix),
    api_secret: row.api_secret ? String(row.api_secret) : undefined,
    webhook_secret: String(row.webhook_secret),
    created_at: Number(row.created_at),
    rotated_at: row.rotated_at ? Number(row.rotated_at) : null,
  };
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function randomToken(prefix: string, bytes: number): string {
  const raw = randomBytes(bytes).toString('base64url');
  return `${prefix}${raw}`;
}

export async function createOrRotateCredentials(merchantId: string): Promise<{ api_key: string; api_key_prefix: string; api_secret: string; webhook_secret: string }> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const apiKey = randomToken('sk_live_', 24);
  const apiKeyPrefix = apiKey.slice(0, 12);
  const apiSecret = randomToken('sksec_', 24);
  const webhookSecret = randomToken('whsec_', 24);
  const apiKeyHash = sha256Hex(apiKey);

  const existing = await db.get<any>('SELECT merchant_id FROM merchant_credentials WHERE merchant_id = ?', merchantId);
  if (!existing) {
    await db.run(
      'INSERT INTO merchant_credentials(merchant_id, api_key_hash, api_key_prefix, api_secret, webhook_secret, created_at, rotated_at) VALUES(?, ?, ?, ?, ?, ?, NULL)',
      merchantId,
      apiKeyHash,
      apiKeyPrefix,
      apiSecret,
      webhookSecret,
      now
    );
  } else {
    await db.run(
      'UPDATE merchant_credentials SET api_key_hash = ?, api_key_prefix = ?, api_secret = ?, webhook_secret = ?, rotated_at = ? WHERE merchant_id = ?',
      apiKeyHash,
      apiKeyPrefix,
      apiSecret,
      webhookSecret,
      now,
      merchantId
    );
  }

  return { api_key: apiKey, api_key_prefix: apiKeyPrefix, api_secret: apiSecret, webhook_secret: webhookSecret };

}

export async function createOrRotateSandboxCredentials(merchantId: string): Promise<{ api_key: string; api_key_prefix: string; api_secret: string; webhook_secret: string }> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const apiKey = randomToken('sk_test_', 24);
  const apiKeyPrefix = apiKey.slice(0, 12);
  const apiSecret = randomToken('sksec_test_', 24);
  const webhookSecret = randomToken('whsec_test_', 24);
  const apiKeyHash = sha256Hex(apiKey);

  const existing = await db.get<any>('SELECT merchant_id FROM merchant_credentials WHERE merchant_id = ?', merchantId);
  if (!existing) {
    // Ensure a production row exists first
    await createOrRotateCredentials(merchantId);
  }
  await db.run(
    'UPDATE merchant_credentials SET sandbox_api_key_hash = ?, sandbox_api_key_prefix = ?, sandbox_api_secret = ?, sandbox_webhook_secret = ? WHERE merchant_id = ?',
    apiKeyHash,
    apiKeyPrefix,
    apiSecret,
    webhookSecret,
    merchantId
  );

  return { api_key: apiKey, api_key_prefix: apiKeyPrefix, api_secret: apiSecret, webhook_secret: webhookSecret };
}

export type ApiKeyVerification = { merchant_id: string; env: 'production' | 'sandbox' };

export async function verifyApiKeyWithEnv(apiKey: string): Promise<ApiKeyVerification | null> {
  if (!apiKey) return null;
  const db = await getDb();
  const hash = sha256Hex(apiKey);
  const row = await db.get<any>(
    'SELECT merchant_id, api_key_hash, sandbox_api_key_hash FROM merchant_credentials WHERE api_key_hash = ? OR sandbox_api_key_hash = ?',
    hash,
    hash
  );
  if (!row?.merchant_id) return null;
  const env: 'production' | 'sandbox' = String(row.api_key_hash) === hash ? 'production' : 'sandbox';
  return { merchant_id: String(row.merchant_id), env };
}

export async function getMerchantSigningSecret(merchantId: string, env: 'production' | 'sandbox' = 'production'): Promise<string | null> {
  const db = await getDb();
  const row = await db.get<any>(
    'SELECT api_secret, sandbox_api_secret FROM merchant_credentials WHERE merchant_id = ?',
    merchantId
  );
  if (!row) return null;
  const sec = env === 'sandbox' ? String(row.sandbox_api_secret || '') : String(row.api_secret || '');
  return sec || null;
}

export async function getMerchantWebhookSecret(merchantId: string, env: 'production' | 'sandbox' = 'production'): Promise<string | null> {
  const db = await getDb();
  const row = await db.get<any>(
    'SELECT webhook_secret, sandbox_webhook_secret FROM merchant_credentials WHERE merchant_id = ?',
    merchantId
  );
  if (!row) return null;
  const sec = env === 'sandbox' ? String(row.sandbox_webhook_secret || '') : String(row.webhook_secret || '');
  return sec || null;
}

export async function getMerchantWebhookConfigEnv(merchantId: string, env: 'production' | 'sandbox' = 'production'): Promise<{ webhook_url: string | null; webhook_enabled: boolean }> {
  const db = await getDb();
  const row = await db.get<any>('SELECT webhook_url, webhook_enabled, sandbox_webhook_url, sandbox_webhook_enabled FROM merchants WHERE id = ?', merchantId);
  if (!row) return { webhook_url: null, webhook_enabled: false };
  if (env === 'sandbox') {
    return { webhook_url: row.sandbox_webhook_url ? String(row.sandbox_webhook_url) : null, webhook_enabled: Number(row.sandbox_webhook_enabled || 0) === 1 };
  }
  return { webhook_url: row.webhook_url ? String(row.webhook_url) : null, webhook_enabled: Number(row.webhook_enabled || 0) === 1 };
}

export async function setMerchantWebhookConfigEnv(merchantId: string, env: 'production' | 'sandbox', params: { webhook_url?: string | null; webhook_enabled?: boolean }): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  if (env === 'sandbox') {
    await db.run(
      'UPDATE merchants SET sandbox_webhook_url = COALESCE(?, sandbox_webhook_url), sandbox_webhook_enabled = COALESCE(?, sandbox_webhook_enabled), updated_at = ? WHERE id = ?',
      params.webhook_url ?? null,
      typeof params.webhook_enabled === 'boolean' ? (params.webhook_enabled ? 1 : 0) : null,
      now,
      merchantId
    );
  } else {
    await db.run(
      'UPDATE merchants SET webhook_url = COALESCE(?, webhook_url), webhook_enabled = COALESCE(?, webhook_enabled), updated_at = ? WHERE id = ?',
      params.webhook_url ?? null,
      typeof params.webhook_enabled === 'boolean' ? (params.webhook_enabled ? 1 : 0) : null,
      now,
      merchantId
    );
  }
}


export async function verifyApiKey(apiKey: string): Promise<string | null> {
  // Returns merchant_id if valid
  if (!apiKey) return null;
  const db = await getDb();
  const hash = sha256Hex(apiKey);
  const row = await db.get<any>('SELECT merchant_id FROM merchant_credentials WHERE api_key_hash = ?', hash);
  return row?.merchant_id ? String(row.merchant_id) : null;
}

export async function listSubmittedVerificationRequests(): Promise<Array<{ vr: VerificationRequest; merchant: Merchant }>> {
  const db = await getDb();
  const rows = await db.all<any[]>(
    `SELECT vr.*, m.owner_email, m.status as merchant_status, m.created_at as merchant_created_at, m.updated_at as merchant_updated_at, m.wa_number as merchant_wa_number, m.wa_enabled as merchant_wa_enabled
     FROM verification_requests vr
     JOIN merchants m ON m.id = vr.merchant_id
     WHERE m.status = 'submitted' AND vr.status = 'submitted'
     ORDER BY vr.submitted_at ASC`
  );
  return rows.map((row: any) => {
    const vr: VerificationRequest = {
      id: String(row.id),
      merchant_id: String(row.merchant_id),
      store_link: String(row.store_link),
      wa_number: String(row.wa_number),
      screenshot_path: String(row.screenshot_path),
      status: String(row.status) as any,
      submitted_at: Number(row.submitted_at),
      reviewed_at: row.reviewed_at ? Number(row.reviewed_at) : null,
      reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
      reason: row.reason ? String(row.reason) : null,
      wait_hours: Number(row.wait_hours),
    };
    const merchant: Merchant = {
      id: String(row.merchant_id),
      owner_email: String(row.owner_email),
      status: String(row.merchant_status) as any,
      wa_number: row.merchant_wa_number ? String(row.merchant_wa_number) : null,
      wa_enabled: Number(row.merchant_wa_enabled ?? 1),
      created_at: Number(row.merchant_created_at),
      updated_at: Number(row.merchant_updated_at),
    };
    return { vr, merchant };
  });
}

export async function getVerificationRequestById(id: string): Promise<VerificationRequest | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT * FROM verification_requests WHERE id = ?', id);
  if (!row) return null;
  return {
    id: String(row.id),
    merchant_id: String(row.merchant_id),
    store_link: String(row.store_link),
    wa_number: String(row.wa_number),
    screenshot_path: String(row.screenshot_path),
    status: String(row.status) as any,
    submitted_at: Number(row.submitted_at),
    reviewed_at: row.reviewed_at ? Number(row.reviewed_at) : null,
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    reason: row.reason ? String(row.reason) : null,
    wait_hours: Number(row.wait_hours),
  };
}

export async function reviewVerificationRequest(params: { id: string; status: VerificationRequest['status']; reviewed_by: string; reason?: string | null; wa_number?: string | null }): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const vr = await getVerificationRequestById(params.id);
  if (!vr) throw new Error('Verification request not found');

  const nextWa = params.wa_number ?? vr.wa_number;

  await db.run(
    'UPDATE verification_requests SET status = ?, reviewed_at = ?, reviewed_by = ?, reason = ?, wa_number = ? WHERE id = ?',
    params.status,
    now,
    params.reviewed_by,
    params.reason ?? null,
    nextWa,
    params.id
  );

  // Keep merchant.wa_number in sync
  await updateMerchantWa(vr.merchant_id, nextWa, true);
}

export async function approveVerification(params: { id: string; reviewed_by: string; wa_number?: string | null }): Promise<{ merchant: Merchant; credentials: { api_key: string; api_key_prefix: string; webhook_secret: string } }> {
  const db = await getDb();
  const vr = await getVerificationRequestById(params.id);
  if (!vr) throw new Error('Verification request not found');

  const merchant = await getMerchantById(vr.merchant_id);
  if (!merchant) throw new Error('Merchant not found');

  // Mark verification approved + sync WA
  await reviewVerificationRequest({ id: params.id, status: 'approved', reviewed_by: params.reviewed_by, wa_number: params.wa_number ?? vr.wa_number, reason: null });

  // Activate merchant
  await updateMerchantStatus(merchant.id, 'active');

  // Create credentials (rotate if already exists)
  const creds = await createOrRotateCredentials(merchant.id);

  const updated = await getMerchantById(merchant.id);
  if (!updated) throw new Error('Merchant not found after update');
  return { merchant: updated, credentials: creds };
}

export async function rejectVerification(params: { id: string; reviewed_by: string; reason: string; wa_number?: string | null }): Promise<void> {
  const vr = await getVerificationRequestById(params.id);
  if (!vr) throw new Error('Verification request not found');
  await reviewVerificationRequest({ id: params.id, status: 'rejected', reviewed_by: params.reviewed_by, reason: params.reason, wa_number: params.wa_number ?? vr.wa_number });
  await updateMerchantStatus(vr.merchant_id, 'rejected');
}

export async function needMoreInfoVerification(params: { id: string; reviewed_by: string; reason: string; wa_number?: string | null }): Promise<void> {
  const vr = await getVerificationRequestById(params.id);
  if (!vr) throw new Error('Verification request not found');
  await reviewVerificationRequest({ id: params.id, status: 'need_more_info', reviewed_by: params.reviewed_by, reason: params.reason, wa_number: params.wa_number ?? vr.wa_number });
  // keep merchant status as submitted
}

export async function setMerchantActiveAndCreateCredentials(merchantId: string): Promise<{ api_key: string; api_key_prefix: string; webhook_secret: string }> {
  await updateMerchantStatus(merchantId, 'active');
  return await createOrRotateCredentials(merchantId);
}

export async function createVerificationRequest(input: {
  merchant_id: string;
  store_link: string;
  wa_number: string;
  screenshot_path: string;
  submitted_at: number;
  wait_hours: number;
}): Promise<VerificationRequest> {
  const db = await getDb();
  const id = randomUUID();
  await db.run(
    `INSERT INTO verification_requests
      (id, merchant_id, store_link, wa_number, screenshot_path, status, submitted_at, reviewed_at, reviewed_by, reason, wait_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`
    ,
    id,
    input.merchant_id,
    input.store_link,
    input.wa_number,
    input.screenshot_path,
    'submitted',
    input.submitted_at,
    input.wait_hours
  );
  return {
    id,
    merchant_id: input.merchant_id,
    store_link: input.store_link,
    wa_number: input.wa_number,
    screenshot_path: input.screenshot_path,
    status: 'submitted',
    submitted_at: input.submitted_at,
    reviewed_at: null,
    reviewed_by: null,
    reason: null,
    wait_hours: input.wait_hours,
  };
}

export async function getVerificationRequestByMerchantId(merchantId: string): Promise<VerificationRequest | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT * FROM verification_requests WHERE merchant_id = ?', merchantId);
  if (!row) return null;
  return {
    id: String(row.id),
    merchant_id: String(row.merchant_id),
    store_link: String(row.store_link),
    wa_number: String(row.wa_number),
    screenshot_path: String(row.screenshot_path),
    status: String(row.status) as VerificationRequest['status'],
    submitted_at: Number(row.submitted_at),
    reviewed_at: row.reviewed_at ? Number(row.reviewed_at) : null,
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    reason: row.reason ? String(row.reason) : null,
    wait_hours: Number(row.wait_hours),
  };
}

export async function cleanupExpired(): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);

  await db.run('DELETE FROM pending_transactions WHERE expires_at < ?', now);
  await db.run('DELETE FROM paid_transactions WHERE expires_at < ?', now);
}

export async function getAvailableSuffix(username: string): Promise<number> {
  await cleanupExpired();

  const db = await getDb();
  const rows = await db.all<{ unique_suffix: number }[]>(
    'SELECT unique_suffix FROM pending_transactions WHERE username = ?',
    username
  );

  const usedSet = new Set<number>(rows.map(r => Number((r as any).unique_suffix)));

  for (let i = 1; i <= 500; i++) {
    if (!usedSet.has(i)) return i;
  }
  for (let i = 501; i <= 999; i++) {
    if (!usedSet.has(i)) return i;
  }

  throw new Error('No suffix available');
}

export async function createPendingTransaction(tx: PendingTransaction): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO pending_transactions
      (id, username, base_amount, unique_suffix, final_amount, qris_string, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    tx.id,
    tx.username,
    tx.base_amount,
    tx.unique_suffix,
    tx.final_amount,
    tx.qris_string,
    tx.created_at,
    tx.expires_at
  );
}

export async function getPendingTransaction(id: string): Promise<PendingTransaction | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT * FROM pending_transactions WHERE id = ?', id);
  if (!row) return null;

  return {
    id: String(row.id),
    username: String(row.username),
    base_amount: Number(row.base_amount),
    unique_suffix: Number(row.unique_suffix),
    final_amount: Number(row.final_amount),
    qris_string: String(row.qris_string),
    created_at: Number(row.created_at),
    expires_at: Number(row.expires_at),
  };
}

export async function deletePendingTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM pending_transactions WHERE id = ?', id);
}

export async function createPaidTransaction(tx: PaidTransaction): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO paid_transactions (id, username, final_amount, paid_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    tx.id,
    tx.username,
    tx.final_amount,
    tx.paid_at,
    tx.expires_at
  );
}

export async function getPaidTransaction(id: string): Promise<PaidTransaction | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT * FROM paid_transactions WHERE id = ?', id);
  if (!row) return null;

  return {
    id: String(row.id),
    username: String(row.username),
    final_amount: Number(row.final_amount),
    paid_at: Number(row.paid_at),
    expires_at: Number(row.expires_at),
  };
}

// -----------------
// Anti-replay nonce helpers
// -----------------
export async function isNonceUsed(merchantId: string, nonce: string): Promise<boolean> {
  if (!merchantId || !nonce) return true;
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  // cleanup a bit opportunistically
  await db.run('DELETE FROM used_nonces WHERE expires_at <= ?', now);
  const row = await db.get<any>('SELECT 1 FROM used_nonces WHERE merchant_id = ? AND nonce = ? AND expires_at > ?', merchantId, nonce, now);
  return !!row;
}

export async function markNonceUsed(merchantId: string, nonce: string, expiresAt: number): Promise<void> {
  const db = await getDb();
  await db.run('INSERT OR REPLACE INTO used_nonces(merchant_id, nonce, expires_at) VALUES(?, ?, ?)', merchantId, nonce, expiresAt);
}

export async function getMerchantSecretForSigning(merchantId: string, env: 'production' | 'sandbox' = 'production'): Promise<string | null> {
  return getMerchantSigningSecret(merchantId, env);
}

// -----------------
// Invoice / Payment Object helpers
// -----------------
export type InvoiceStatus = 'created' | 'pending' | 'paid' | 'expired' | 'refunded';

export type Invoice = {
  id: string;
  merchant_id: string;
  env?: 'production' | 'sandbox';
  username: string;
  reference_id: string | null;
  base_amount: number;
  unique_suffix: number;
  final_amount: number;
  status: InvoiceStatus;
  qris_string: string;
  created_at: number;
  expires_at: number;
  paid_at: number | null;
  metadata_json: string | null;
};

export async function createInvoiceRecord(input: {
  id: string;
  merchant_id: string;
  env?: 'production' | 'sandbox';
  username: string;
  reference_id?: string | null;
  base_amount: number;
  unique_suffix: number;
  final_amount: number;
  status: InvoiceStatus;
  qris_string: string;
  created_at: number;
  expires_at: number;
  metadata?: any;
}): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO invoices
      (id, merchant_id, env, username, reference_id, base_amount, unique_suffix, final_amount, status, qris_string, created_at, expires_at, paid_at, metadata_json)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
    ,
    input.id,
    input.merchant_id,
    (input.env ?? 'production'),
    input.username,
    input.reference_id ?? null,
    input.base_amount,
    input.unique_suffix,
    input.final_amount,
    input.status,
    input.qris_string,
    input.created_at,
    input.expires_at,
    input.metadata ? JSON.stringify(input.metadata) : null
  );
}

export async function getInvoiceById(invoiceId: string, merchantId?: string): Promise<Invoice | null> {
  const db = await getDb();
  const row = merchantId
    ? await db.get<any>('SELECT * FROM invoices WHERE id = ? AND merchant_id = ?', invoiceId, merchantId)
    : await db.get<any>('SELECT * FROM invoices WHERE id = ?', invoiceId);
  if (!row) return null;
  return {
    id: String(row.id),
    merchant_id: String(row.merchant_id),
    username: String(row.username),
    reference_id: row.reference_id ? String(row.reference_id) : null,
    base_amount: Number(row.base_amount),
    unique_suffix: Number(row.unique_suffix),
    final_amount: Number(row.final_amount),
    status: String(row.status) as InvoiceStatus,
    qris_string: String(row.qris_string),
    created_at: Number(row.created_at),
    expires_at: Number(row.expires_at),
    paid_at: row.paid_at ? Number(row.paid_at) : null,
    metadata_json: row.metadata_json ? String(row.metadata_json) : null,
  };
}

export async function updateInvoiceStatus(invoiceId: string, merchantId: string, status: InvoiceStatus, paidAt?: number | null): Promise<void> {
  const db = await getDb();
  if (status === 'paid') {
    await db.run('UPDATE invoices SET status = ?, paid_at = ? WHERE id = ? AND merchant_id = ?', status, paidAt ?? Math.floor(Date.now() / 1000), invoiceId, merchantId);
  } else {
    await db.run('UPDATE invoices SET status = ? WHERE id = ? AND merchant_id = ?', status, invoiceId, merchantId);
  }
}

export async function listInvoices(merchantId: string, limit = 50, offset = 0): Promise<Invoice[]> {
  const db = await getDb();
  const rows = await db.all<any[]>(
    'SELECT * FROM invoices WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    merchantId,
    limit,
    offset
  );
  return rows.map((row: any) => ({
    id: String(row.id),
    merchant_id: String(row.merchant_id),
    username: String(row.username),
    reference_id: row.reference_id ? String(row.reference_id) : null,
    base_amount: Number(row.base_amount),
    unique_suffix: Number(row.unique_suffix),
    final_amount: Number(row.final_amount),
    status: String(row.status) as InvoiceStatus,
    qris_string: String(row.qris_string),
    created_at: Number(row.created_at),
    expires_at: Number(row.expires_at),
    paid_at: row.paid_at ? Number(row.paid_at) : null,
    metadata_json: row.metadata_json ? String(row.metadata_json) : null,
  }));
}

export async function createInvoiceEvent(input: { id: string; invoice_id: string; merchant_id: string; event_type: string; payload?: any; created_at: number }): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO invoice_events (id, invoice_id, merchant_id, event_type, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
    ,
    input.id,
    input.invoice_id,
    input.merchant_id,
    input.event_type,
    input.payload ? JSON.stringify(input.payload) : null,
    input.created_at
  );
}

export async function listInvoiceEvents(invoiceId: string, merchantId: string, limit = 50): Promise<Array<{ id: string; event_type: string; payload_json: string | null; created_at: number }>> {
  const db = await getDb();
  const rows = await db.all<any[]>(
    'SELECT id, event_type, payload_json, created_at FROM invoice_events WHERE invoice_id = ? AND merchant_id = ? ORDER BY created_at DESC LIMIT ?',
    invoiceId,
    merchantId,
    limit
  );
  return rows.map((r: any) => ({
    id: String(r.id),
    event_type: String(r.event_type),
    payload_json: r.payload_json ? String(r.payload_json) : null,
    created_at: Number(r.created_at),
  }));
}

// -----------------
// Webhook config + deliveries
// -----------------
export type WebhookConfig = {
  webhook_url: string | null;
  webhook_enabled: number; // 0/1
};

export type WebhookDelivery = {
  id: string;
  merchant_id: string;
  env: 'production' | 'sandbox';
  invoice_id: string | null;
  event_type: string;
  payload_json: string;
  status: 'queued' | 'delivered' | 'failed';
  attempt_count: number;
  next_retry_at: number;
  last_status_code: number | null;
  last_error: string | null;
  response_snippet: string | null;
  created_at: number;
  updated_at: number;
};

export async function getMerchantWebhookConfig(merchantId: string): Promise<WebhookConfig> {
  const db = await getDb();
  const row = await db.get<any>('SELECT webhook_url, webhook_enabled FROM merchants WHERE id = ?', merchantId);
  return {
    webhook_url: row?.webhook_url ? String(row.webhook_url) : null,
    webhook_enabled: Number(row?.webhook_enabled || 0),
  };
}

export async function setMerchantWebhookConfig(merchantId: string, cfg: { webhook_url?: string | null; webhook_enabled?: boolean }): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const existing = await getMerchantWebhookConfig(merchantId);
  const url = cfg.webhook_url !== undefined ? cfg.webhook_url : existing.webhook_url;
  const enabled = cfg.webhook_enabled !== undefined ? (cfg.webhook_enabled ? 1 : 0) : existing.webhook_enabled;
  await db.run('UPDATE merchants SET webhook_url = ?, webhook_enabled = ?, updated_at = ? WHERE id = ?', url, enabled, now, merchantId);
}

export async function enqueueWebhookDelivery(input: { merchant_id: string; env?: 'production' | 'sandbox'; invoice_id?: string | null; event_type: string; payload: any; run_at?: number }): Promise<string> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const id = randomUUID();
  const runAt = input.run_at ?? now;
  await db.run(
    `INSERT INTO webhook_deliveries (id, merchant_id, env, invoice_id, event_type, payload_json, status, attempt_count, next_retry_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?)`
    ,
    id,
    input.merchant_id,
    (input.env ?? 'production'),
    input.invoice_id ?? null,
    input.event_type,
    JSON.stringify(input.payload ?? {}),
    runAt,
    now,
    now
  );
  return id;
}

export async function listWebhookDeliveries(merchantId: string, limit = 100, offset = 0): Promise<WebhookDelivery[]> {
  const db = await getDb();
  const rows = await db.all<any[]>(
    `SELECT * FROM webhook_deliveries WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    merchantId,
    limit,
    offset
  );
  return rows.map((r: any) => ({
    id: String(r.id),
    merchant_id: String(r.merchant_id),
    env: (String(r.env || 'production') === 'sandbox' ? 'sandbox' : 'production'),
    invoice_id: r.invoice_id ? String(r.invoice_id) : null,
    event_type: String(r.event_type),
    payload_json: String(r.payload_json),
    status: String(r.status) as any,
    attempt_count: Number(r.attempt_count),
    next_retry_at: Number(r.next_retry_at),
    last_status_code: r.last_status_code == null ? null : Number(r.last_status_code),
    last_error: r.last_error ? String(r.last_error) : null,
    response_snippet: r.response_snippet ? String(r.response_snippet) : null,
    created_at: Number(r.created_at),
    updated_at: Number(r.updated_at),
  }));
}

export async function getDueWebhookDeliveries(limit = 20): Promise<WebhookDelivery[]> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const rows = await db.all<any[]>(
    `SELECT * FROM webhook_deliveries WHERE status = 'queued' AND next_retry_at <= ? ORDER BY next_retry_at ASC LIMIT ?`,
    now,
    limit
  );
  return rows.map((r: any) => ({
    id: String(r.id),
    merchant_id: String(r.merchant_id),
    env: (String(r.env || 'production') === 'sandbox' ? 'sandbox' : 'production'),
    invoice_id: r.invoice_id ? String(r.invoice_id) : null,
    event_type: String(r.event_type),
    payload_json: String(r.payload_json),
    status: String(r.status) as any,
    attempt_count: Number(r.attempt_count),
    next_retry_at: Number(r.next_retry_at),
    last_status_code: r.last_status_code == null ? null : Number(r.last_status_code),
    last_error: r.last_error ? String(r.last_error) : null,
    response_snippet: r.response_snippet ? String(r.response_snippet) : null,
    created_at: Number(r.created_at),
    updated_at: Number(r.updated_at),
  }));
}

export async function markWebhookDeliveryResult(input: { id: string; delivered: boolean; status_code?: number | null; error?: string | null; response_snippet?: string | null; next_retry_at?: number | null }): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const row = await db.get<any>('SELECT attempt_count FROM webhook_deliveries WHERE id = ?', input.id);
  const attempt = Number(row?.attempt_count || 0) + 1;
  const status = input.delivered ? 'delivered' : (input.next_retry_at === null ? 'failed' : 'queued');
  const nextRetry = input.delivered ? null : (input.next_retry_at ?? (now + 60));
  await db.run(
    `UPDATE webhook_deliveries
     SET status = ?, attempt_count = ?, next_retry_at = ?, last_status_code = ?, last_error = ?, response_snippet = ?, updated_at = ?
     WHERE id = ?`,
    status,
    attempt,
    nextRetry ?? now,
    input.status_code ?? null,
    input.error ?? null,
    input.response_snippet ?? null,
    now,
    input.id
  );
  // If permanently failed, mark failed
  if (!input.delivered && input.next_retry_at === null) {
    await db.run(`UPDATE webhook_deliveries SET status = 'failed', updated_at = ? WHERE id = ?`, now, input.id);
  }
}

// -----------------
// CMS: pages + templates + settings
// -----------------
export async function upsertSitePage(slug: string, title: string, content_md: string): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run(
    `INSERT INTO site_pages(slug, title, content_md, updated_at) VALUES(?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET title=excluded.title, content_md=excluded.content_md, updated_at=excluded.updated_at`,
    slug,
    title,
    content_md,
    now
  );
}

export async function getSitePage(slug: string): Promise<{ slug: string; title: string; content_md: string; updated_at: number } | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT slug, title, content_md, updated_at FROM site_pages WHERE slug = ?', slug);
  if (!row) return null;
  return { slug: String(row.slug), title: String(row.title), content_md: String(row.content_md), updated_at: Number(row.updated_at) };
}

export async function listSitePages(): Promise<Array<{ slug: string; title: string; updated_at: number }>> {
  const db = await getDb();
  const rows = await db.all<any[]>('SELECT slug, title, updated_at FROM site_pages ORDER BY slug ASC');
  return rows.map((r: any) => ({ slug: String(r.slug), title: String(r.title), updated_at: Number(r.updated_at) }));
}

export async function deleteSitePage(slug: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM site_pages WHERE slug = ?', slug);
}

export async function upsertMessageTemplate(key: string, template_text: string): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run(
    `INSERT INTO message_templates(key, template_text, updated_at) VALUES(?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET template_text=excluded.template_text, updated_at=excluded.updated_at`,
    key,
    template_text,
    now
  );
}

export async function getMessageTemplate(key: string): Promise<{ key: string; template_text: string; updated_at: number } | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT key, template_text, updated_at FROM message_templates WHERE key = ?', key);
  if (!row) return null;
  return { key: String(row.key), template_text: String(row.template_text), updated_at: Number(row.updated_at) };
}

export async function listMessageTemplates(): Promise<Array<{ key: string; template_text: string; updated_at: number }>> {
  const db = await getDb();
  const rows = await db.all<any[]>('SELECT key, template_text, updated_at FROM message_templates ORDER BY key ASC');
  return rows.map((r: any) => ({ key: String(r.key), template_text: String(r.template_text), updated_at: Number(r.updated_at) }));
}

export async function setSetting(key: string, value: any): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run(
    `INSERT INTO settings(key, value_json, updated_at) VALUES(?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`,
    key,
    JSON.stringify(value),
    now
  );
}

export async function getSettingRaw(key: string): Promise<any | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT value_json FROM settings WHERE key = ?', key);
  if (!row) return null;
  try {
    return JSON.parse(String(row.value_json));
  } catch {
    return null;
  }
}






// -----------------
// Invoice maintenance helpers (scheduler)
// -----------------
export async function listInvoicesDueForExpiry(limit = 200): Promise<Array<{ id: string; merchant_id: string }>> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const rows = await db.all<any[]>(
    `SELECT id, merchant_id FROM invoices WHERE status = 'pending' AND expires_at <= ? ORDER BY expires_at ASC LIMIT ?`,
    now,
    limit
  );
  return rows.map((r: any) => ({ id: String(r.id), merchant_id: String(r.merchant_id) }));
}

export async function setInvoiceExpired(invoiceId: string, merchantId: string, now: number): Promise<void> {
  const db = await getDb();
  await db.run(`UPDATE invoices SET status = 'expired' WHERE id = ? AND merchant_id = ?`, invoiceId, merchantId);
}

export async function cleanupExpiredRows(): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('DELETE FROM used_nonces WHERE expires_at <= ?', now);
  await db.run('DELETE FROM paid_transactions WHERE expires_at <= ?', now);
  await db.run('DELETE FROM pending_transactions WHERE expires_at <= ?', now);
}

export async function listAllSettings(): Promise<Array<{ key: string; value_json: string; updated_at: number }>> {
  const db = await getDb();
  const rows = await db.all<any[]>('SELECT key, value_json, updated_at FROM settings ORDER BY key ASC');
  return rows.map((r: any) => ({ key: String(r.key), value_json: String(r.value_json), updated_at: Number(r.updated_at) }));
}


//
// -----------------
// IP whitelist helpers
// -----------------
export async function listIpWhitelist(merchantId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.all<any[]>('SELECT cidr FROM merchant_ip_whitelist WHERE merchant_id = ? ORDER BY cidr ASC', merchantId);
  return rows.map(r => String(r.cidr));
}

export async function addIpWhitelist(merchantId: string, cidr: string): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('INSERT OR IGNORE INTO merchant_ip_whitelist(merchant_id, cidr, created_at) VALUES(?, ?, ?)', merchantId, cidr.trim(), now);
}

export async function removeIpWhitelist(merchantId: string, cidr: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM merchant_ip_whitelist WHERE merchant_id = ? AND cidr = ?', merchantId, cidr.trim());
}

export async function setIpWhitelistEnabled(merchantId: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('UPDATE merchants SET ip_whitelist_enabled = ?, updated_at = ? WHERE id = ?', enabled ? 1 : 0, now, merchantId);
}

export async function isIpWhitelistEnabled(merchantId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.get<any>('SELECT ip_whitelist_enabled FROM merchants WHERE id = ?', merchantId);
  return Number(row?.ip_whitelist_enabled || 0) === 1;
}

export async function createAlert(params: { merchant_id?: string | null; type: string; message: string }): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('INSERT INTO alerts(id, merchant_id, type, message, created_at, resolved_at) VALUES(?, ?, ?, ?, ?, NULL)',
    randomUUID(),
    params.merchant_id ?? null,
    params.type,
    params.message,
    now
  );
}

export async function listOpenAlerts(limit = 50): Promise<any[]> {
  const db = await getDb();
  const rows = await db.all<any[]>(
    'SELECT * FROM alerts WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT ?',
    limit
  );
  return rows;
}

export async function resolveAlert(id: string): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('UPDATE alerts SET resolved_at = ? WHERE id = ?', now, id);
}

// -----------------
// Refund helpers
// -----------------
export type RefundStatus = 'requested' | 'approved' | 'processed' | 'rejected';

export async function createRefundRequest(params: { invoice_id: string; merchant_id: string; amount: number; reason?: string | null }): Promise<string> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const id = randomUUID();
  await db.run(
    'INSERT INTO refunds(id, invoice_id, merchant_id, amount, reason, status, requested_at) VALUES(?, ?, ?, ?, ?, ?, ?)',
    id,
    params.invoice_id,
    params.merchant_id,
    Math.max(0, Math.floor(params.amount)),
    params.reason ?? null,
    'requested',
    now
  );
  return id;
}

export async function getRefundById(id: string): Promise<any | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT * FROM refunds WHERE id = ?', id);
  return row || null;
}

export async function listRefundsForMerchant(merchantId: string, limit = 100): Promise<any[]> {
  const db = await getDb();
  return db.all<any[]>(
    'SELECT * FROM refunds WHERE merchant_id = ? ORDER BY requested_at DESC LIMIT ?',
    merchantId,
    limit
  );
}

export async function listRefundsByStatus(status: RefundStatus, limit = 100): Promise<any[]> {
  const db = await getDb();
  return db.all<any[]>(
    'SELECT * FROM refunds WHERE status = ? ORDER BY requested_at DESC LIMIT ?',
    status,
    limit
  );
}

export async function approveRefund(id: string, adminEmail: string): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('UPDATE refunds SET status = ?, approved_at = ?, approved_by = ? WHERE id = ? AND status = ?',
    'approved', now, adminEmail, id, 'requested'
  );
}

export async function rejectRefund(id: string, adminEmail: string): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('UPDATE refunds SET status = ?, approved_at = ?, approved_by = ? WHERE id = ? AND status = ?',
    'rejected', now, adminEmail, id, 'requested'
  );
}

export async function processRefund(id: string, adminEmail: string): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const r = await db.get<any>('SELECT * FROM refunds WHERE id = ?', id);
  if (!r) throw new Error('Refund not found');
  if (String(r.status) !== 'approved') throw new Error('Refund must be approved first');

  await db.run('UPDATE refunds SET status = ?, processed_at = ?, processed_by = ? WHERE id = ?',
    'processed', now, adminEmail, id
  );
}

// -----------------
// Dispute helpers
// -----------------
export type DisputeStatus = 'open' | 'need_more_info' | 'resolved' | 'rejected';

export async function createDispute(params: { invoice_id: string; merchant_id: string; message: string; evidence_url?: string | null }): Promise<string> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const id = randomUUID();
  await db.run(
    'INSERT INTO disputes(id, invoice_id, merchant_id, status, message, evidence_url, admin_note, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, NULL, ?, ?)',
    id,
    params.invoice_id,
    params.merchant_id,
    'open',
    params.message,
    params.evidence_url ?? null,
    now,
    now
  );
  return id;
}

export async function listDisputesForMerchant(merchantId: string, limit = 100): Promise<any[]> {
  const db = await getDb();
  return db.all<any[]>('SELECT * FROM disputes WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ?', merchantId, limit);
}

export async function listDisputesByStatus(status: DisputeStatus, limit = 100): Promise<any[]> {
  const db = await getDb();
  return db.all<any[]>('SELECT * FROM disputes WHERE status = ? ORDER BY created_at DESC LIMIT ?', status, limit);
}

export async function updateDisputeAdmin(params: { id: string; status: DisputeStatus; admin_note?: string | null }): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('UPDATE disputes SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?',
    params.status, params.admin_note ?? null, now, params.id
  );
}

// -----------------
// Settlement helpers (audit)
// -----------------
function feeForAmount(amount: number, feeBps: number, feeFixed: number): number {
  const pct = Math.floor((amount * feeBps) / 10000);
  return Math.max(0, pct + feeFixed);
}

export async function runSettlementForDate(periodDate: string): Promise<{ settlements_created: number }> {
  // periodDate: YYYY-MM-DD
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);

  // Get all active merchants
  const merchants = await db.all<any[]>('SELECT id, fee_bps, fee_fixed FROM merchants WHERE status = ?', 'active');

  let created = 0;
  for (const m of merchants) {
    const merchantId = String(m.id);
    const feeBps = Number(m.fee_bps || 0);
    const feeFixed = Number(m.fee_fixed || 0);

    // Paid invoices on that date (UTC-based day)
    const start = Math.floor(new Date(periodDate + 'T00:00:00Z').getTime() / 1000);
    const end = Math.floor(new Date(periodDate + 'T23:59:59Z').getTime() / 1000) + 1;

    const paidInvoices = await db.all<any[]>(
      `SELECT id, final_amount FROM invoices
       WHERE merchant_id = ? AND status = 'paid' AND paid_at IS NOT NULL AND paid_at >= ? AND paid_at < ?`,
      merchantId, start, end
    );

    if (!paidInvoices.length) continue;

    const existing = await db.get<any>('SELECT id FROM settlements WHERE merchant_id = ? AND period_date = ?', merchantId, periodDate);
    if (existing?.id) continue;

    const settlementId = randomUUID();
    let gross = 0;
    let fee = 0;
    let net = 0;

    for (const inv of paidInvoices) {
      const amt = Number(inv.final_amount || 0);
      const f = feeForAmount(amt, feeBps, feeFixed);
      const n = Math.max(0, amt - f);
      gross += amt; fee += f; net += n;
    }

    await db.run(
      'INSERT INTO settlements(id, merchant_id, period_date, gross_amount, fee_amount, net_amount, status, created_at, completed_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, NULL)',
      settlementId, merchantId, periodDate, gross, fee, net, 'pending', now
    );

    for (const inv of paidInvoices) {
      const amt = Number(inv.final_amount || 0);
      const f = feeForAmount(amt, feeBps, feeFixed);
      const n = Math.max(0, amt - f);
      await db.run('INSERT INTO settlement_items(settlement_id, invoice_id, amount, fee, net) VALUES(?, ?, ?, ?, ?)',
        settlementId, String(inv.id), amt, f, n
      );
    }

    created += 1;
  }

  return { settlements_created: created };
}

export async function listSettlementsForMerchant(merchantId: string, limit = 60): Promise<any[]> {
  const db = await getDb();
  return db.all<any[]>('SELECT * FROM settlements WHERE merchant_id = ? ORDER BY period_date DESC LIMIT ?', merchantId, limit);
}

export async function listSettlements(limit = 200): Promise<any[]> {
  const db = await getDb();
  return db.all<any[]>('SELECT * FROM settlements ORDER BY period_date DESC LIMIT ?', limit);
}

export async function markSettlementCompleted(settlementId: string): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('UPDATE settlements SET status = ?, completed_at = ? WHERE id = ?', 'completed', now, settlementId);
}

export async function createPayout(settlementId: string, method: string, reference: string): Promise<string> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const id = randomUUID();
  await db.run('INSERT INTO payouts(id, settlement_id, method, reference, status, created_at, paid_at) VALUES(?, ?, ?, ?, ?, ?, NULL)',
    id, settlementId, method, reference, 'pending', now
  );
  return id;
}

export async function markPayoutPaid(payoutId: string): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run('UPDATE payouts SET status = ?, paid_at = ? WHERE id = ?', 'paid', now, payoutId);
}

// -----------------
// Stats helpers (basic observability)
// -----------------
export async function getGlobalStats(days = 30): Promise<any> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const since = now - days * 86400;

  const total = await db.get<any>('SELECT COUNT(1) as c FROM invoices WHERE created_at >= ?', since);
  const paid = await db.get<any>('SELECT COUNT(1) as c FROM invoices WHERE status = ? AND created_at >= ?', 'paid', since);
  const expired = await db.get<any>('SELECT COUNT(1) as c FROM invoices WHERE status = ? AND created_at >= ?', 'expired', since);
  const refunded = await db.get<any>('SELECT COUNT(1) as c FROM invoices WHERE status = ? AND created_at >= ?', 'refunded', since);

  const whFail = await db.get<any>("SELECT COUNT(1) as c FROM webhook_deliveries WHERE status != 'delivered' AND attempt_count >= ? AND created_at >= ?", Number(process.env.WEBHOOK_MAX_ATTEMPTS || 8), since);

  return {
    window_days: days,
    invoices_total: Number(total?.c || 0),
    invoices_paid: Number(paid?.c || 0),
    invoices_expired: Number(expired?.c || 0),
    invoices_refunded: Number(refunded?.c || 0),
    webhook_failures: Number(whFail?.c || 0),
  };
}

export async function getMerchantStats(merchantId: string, days = 30): Promise<any> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const since = now - days * 86400;

  const total = await db.get<any>('SELECT COUNT(1) as c FROM invoices WHERE merchant_id = ? AND created_at >= ?', merchantId, since);
  const paid = await db.get<any>('SELECT COUNT(1) as c FROM invoices WHERE merchant_id = ? AND status = ? AND created_at >= ?', merchantId, 'paid', since);
  const expired = await db.get<any>('SELECT COUNT(1) as c FROM invoices WHERE merchant_id = ? AND status = ? AND created_at >= ?', merchantId, 'expired', since);
  const refunded = await db.get<any>('SELECT COUNT(1) as c FROM invoices WHERE merchant_id = ? AND status = ? AND created_at >= ?', merchantId, 'refunded', since);

  const whFail = await db.get<any>("SELECT COUNT(1) as c FROM webhook_deliveries WHERE merchant_id = ? AND status != 'delivered' AND attempt_count >= ? AND created_at >= ?", merchantId, Number(process.env.WEBHOOK_MAX_ATTEMPTS || 8), since);

  return {
    window_days: days,
    invoices_total: Number(total?.c || 0),
    invoices_paid: Number(paid?.c || 0),
    invoices_expired: Number(expired?.c || 0),
    invoices_refunded: Number(refunded?.c || 0),
    webhook_failures: Number(whFail?.c || 0),
  };
}



export async function exportInvoicesCsv(params: { merchant_id?: string | null; from_ts?: number | null; to_ts?: number | null; limit?: number }): Promise<string> {
  const db = await getDb();
  const where: string[] = [];
  const args: any[] = [];
  if (params.merchant_id) { where.push('merchant_id = ?'); args.push(params.merchant_id); }
  if (params.from_ts != null) { where.push('created_at >= ?'); args.push(params.from_ts); }
  if (params.to_ts != null) { where.push('created_at <= ?'); args.push(params.to_ts); }
  const clause = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  const limit = Math.min(50000, Math.max(1, Number(params.limit || 5000)));
  const rows = await db.all<any[]>(`SELECT id, merchant_id, env, username, reference_id, base_amount, unique_suffix, final_amount, status, created_at, expires_at, paid_at FROM invoices ${clause} ORDER BY created_at DESC LIMIT ?`, ...args, limit);

  const header = ['invoice_id','merchant_id','env','username','reference_id','base_amount','unique_suffix','final_amount','status','created_at','expires_at','paid_at'];
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      esc(r.id), esc(r.merchant_id), esc(r.env || 'production'), esc(r.username), esc(r.reference_id),
      esc(r.base_amount), esc(r.unique_suffix), esc(r.final_amount), esc(r.status),
      esc(r.created_at), esc(r.expires_at), esc(r.paid_at)
    ].join(','));
  }
  return lines.join('\n');
}

export async function exportWebhookDeliveriesCsv(params: { merchant_id: string; from_ts?: number | null; to_ts?: number | null; limit?: number }): Promise<string> {
  const db = await getDb();
  const where: string[] = ['merchant_id = ?'];
  const args: any[] = [params.merchant_id];
  if (params.from_ts != null) { where.push('created_at >= ?'); args.push(params.from_ts); }
  if (params.to_ts != null) { where.push('created_at <= ?'); args.push(params.to_ts); }
  const clause = 'WHERE ' + where.join(' AND ');
  const limit = Math.min(50000, Math.max(1, Number(params.limit || 5000)));
  const rows = await db.all<any[]>(`SELECT id, env, invoice_id, event_type, status, attempt_count, last_status_code, last_error, created_at, updated_at FROM webhook_deliveries ${clause} ORDER BY created_at DESC LIMIT ?`, ...args, limit);

  const header = ['delivery_id','env','invoice_id','event_type','status','attempt_count','last_status_code','last_error','created_at','updated_at'];
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      esc(r.id), esc(r.env || 'production'), esc(r.invoice_id), esc(r.event_type), esc(r.status),
      esc(r.attempt_count), esc(r.last_status_code), esc(r.last_error), esc(r.created_at), esc(r.updated_at)
    ].join(','));
  }
  return lines.join('\n');
}

