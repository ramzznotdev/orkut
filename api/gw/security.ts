import type express from 'express';
import crypto from 'crypto';
import {
  getMerchantSecretForSigning,
  markNonceUsed,
  isNonceUsed,
} from '../../lib/db';

export type AuthedRequest = express.Request & {
  merchantId?: string;
  rawBody?: string;
};

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function canonicalString(req: AuthedRequest, timestamp: string, nonce: string): string {
  const method = (req.method || 'GET').toUpperCase();
  // Use originalUrl so query string is included (prevents tampering)
  const path = req.originalUrl || req.url || '/';
  const body = typeof req.rawBody === 'string' ? req.rawBody : '';
  return `${method}\n${path}\n${timestamp}\n${nonce}\n${body}`;
}

export function makeHmac(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Ideal anti-replay + request signing:
 * - Requires x-timestamp (unix seconds)
 * - Requires x-nonce (unique per merchant within TTL)
 * - Requires x-signature (hex HMAC-SHA256)
 */
export function requireSignedRequest(opts?: { windowSeconds?: number; nonceTtlSeconds?: number }) {
  const windowSeconds = opts?.windowSeconds ?? Number(process.env.SIGN_WINDOW_SECONDS || 60);
  const nonceTtlSeconds = opts?.nonceTtlSeconds ?? Number(process.env.NONCE_TTL_SECONDS || 120);

  return async (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
    try {
      if (!req.merchantId) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Merchant belum terautentikasi' } });
      }

      const tsStr = String(req.header('x-timestamp') || '').trim();
      const nonce = String(req.header('x-nonce') || '').trim();
      const sig = String(req.header('x-signature') || '').trim();

      if (!tsStr || !nonce || !sig) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_SIGNATURE_HEADERS', message: 'x-timestamp, x-nonce, x-signature required' },
        });
      }

      const ts = Number(tsStr);
      if (!Number.isFinite(ts) || ts <= 0) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_TIMESTAMP', message: 'Invalid x-timestamp' } });
      }

      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - ts) > windowSeconds) {
        return res.status(401).json({
          success: false,
          error: { code: 'REQUEST_EXPIRED', message: `Request expired (window ±${windowSeconds}s)` },
        });
      }

      // Replay protection
      const used = await isNonceUsed(req.merchantId, nonce);
      if (used) {
        return res.status(409).json({
          success: false,
          error: { code: 'REPLAY_DETECTED', message: 'Nonce already used' },
        });
      }

      const secret = await getMerchantSecretForSigning(req.merchantId, (req as any).gwEnv || 'production');
      if (!secret) {
        return res.status(401).json({ success: false, error: { code: 'NO_SIGNING_SECRET', message: 'Signing secret missing' } });
      }

      const data = canonicalString(req, tsStr, nonce);
      const expected = makeHmac(secret, data);
      if (!timingSafeEqualHex(expected, sig)) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Invalid x-signature' },
        });
      }

      await markNonceUsed(req.merchantId, nonce, now + nonceTtlSeconds);
      next();
    } catch (e) {
      next(e);
    }
  };
}
