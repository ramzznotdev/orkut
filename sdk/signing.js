// Simple helper for OrderKuota ProxyGateway signed requests (timestamp + nonce + HMAC)
// Works in Node.js 18+

import crypto from 'crypto';

/**
 * Build the canonical string used by the server:
 * METHOD\nPATH_WITH_QUERY\nTIMESTAMP\nNONCE\nBODY_RAW
 */
export function canonicalString({ method, pathWithQuery, timestamp, nonce, bodyRaw }) {
  const m = (method || 'GET').toUpperCase();
  const p = pathWithQuery || '/';
  const ts = String(timestamp);
  const n = String(nonce);
  const b = bodyRaw || '';
  return `${m}\n${p}\n${ts}\n${n}\n${b}`;
}

export function hmacSha256Hex(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function makeNonce(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Create signed headers for gateway endpoints.
 *
 * IMPORTANT:
 * - pathWithQuery MUST match what the server sees as req.originalUrl
 *   Example: /api/gw/invoices?limit=20
 * - bodyRaw MUST be the exact string you send as HTTP body.
 */
export function signGatewayRequest({
  apiKey,
  apiSecret,
  method,
  urlOrPath,
  body, // object OR string OR undefined
  timestamp = Math.floor(Date.now() / 1000),
  nonce = makeNonce(),
}) {
  if (!apiKey) throw new Error('apiKey is required');
  if (!apiSecret) throw new Error('apiSecret is required');

  const m = (method || 'GET').toUpperCase();

  // Determine path+query
  let pathWithQuery = urlOrPath;
  try {
    // If full URL provided, extract pathname+search
    const u = new URL(urlOrPath);
    pathWithQuery = u.pathname + u.search;
  } catch {
    // Keep as-is (already a path)
  }
  if (!pathWithQuery.startsWith('/')) pathWithQuery = '/' + pathWithQuery;

  // Determine raw body string EXACTLY as sent
  let bodyRaw = '';
  if (typeof body === 'string') {
    bodyRaw = body;
  } else if (body !== undefined && body !== null) {
    bodyRaw = JSON.stringify(body);
  }

  const data = canonicalString({ method: m, pathWithQuery, timestamp, nonce, bodyRaw });
  const signature = hmacSha256Hex(apiSecret, data);

  return {
    headers: {
      'x-api-key': apiKey,
      'x-timestamp': String(timestamp),
      'x-nonce': nonce,
      'x-signature': signature,
      ...(bodyRaw ? { 'content-type': 'application/json' } : {}),
    },
    bodyRaw,
    pathWithQuery,
  };
}
