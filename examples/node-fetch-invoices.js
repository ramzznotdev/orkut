// Example: create invoice via signed gateway request
// Usage:
//   node examples/node-fetch-invoices.js \
//     --base http://localhost:9013 \
//     --key sk_live_xxx \
//     --secret ss_live_xxx

import { signGatewayRequest } from '../sdk/signing.js';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const base = arg('--base', 'http://localhost:9013');
const apiKey = arg('--key');
const apiSecret = arg('--secret');

if (!apiKey || !apiSecret) {
  console.error('Missing --key or --secret');
  process.exit(1);
}

const body = {
  amount: 10000,
  reference_id: 'ORDER-123',
  metadata: { user_id: 'u1', product_id: 'p1' },
};

const path = '/api/v1/gw/invoices';
const { headers, bodyRaw } = signGatewayRequest({
  apiKey,
  apiSecret,
  method: 'POST',
  urlOrPath: path,
  body,
});

const res = await fetch(base + path, {
  method: 'POST',
  headers,
  body: bodyRaw,
});

const json = await res.json().catch(() => ({}));
console.log('Status:', res.status);
console.log(JSON.stringify(json, null, 2));
