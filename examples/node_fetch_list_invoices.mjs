import { signGatewayRequest } from '../sdk/signing.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:9013';
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('Set API_KEY and API_SECRET env vars');
  process.exit(1);
}

const path = '/api/v1/gw/invoices?limit=20';

const { headers } = signGatewayRequest({
  apiKey: API_KEY,
  apiSecret: API_SECRET,
  method: 'GET',
  urlOrPath: path,
});

const res = await fetch(BASE_URL + path, { method: 'GET', headers });
console.log('status:', res.status);
console.log(await res.text());
