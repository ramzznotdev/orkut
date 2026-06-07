import { signGatewayRequest } from '../sdk/signing.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:9013';
const API_KEY = process.env.API_KEY;       // sk_live_...
const API_SECRET = process.env.API_SECRET; // signing secret (bukan webhook secret)

if (!API_KEY || !API_SECRET) {
  console.error('Missing env vars. Example:');
  console.error('  BASE_URL=http://localhost:9013 API_KEY=sk_live_xxx API_SECRET=ss_live_xxx node examples/node_fetch_create_invoice.mjs');
  process.exit(1);
}

const path = '/api/v1/gw/invoices';
const bodyObj = {
  amount: 10000,
  reference_id: 'order_123',
  metadata: { user_id: 'u1', product_id: 'p1' },
};

const { headers, bodyRaw } = signGatewayRequest({
  apiKey: API_KEY,
  apiSecret: API_SECRET,
  method: 'POST',
  urlOrPath: path,
  body: bodyObj,
});

const res = await fetch(`${BASE_URL}${path}`, {
  method: 'POST',
  headers,
  body: bodyRaw,
});

const text = await res.text();
console.log('Status:', res.status);
console.log(text);
