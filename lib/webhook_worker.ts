import { createHmac } from 'crypto';
import {
  getDueWebhookDeliveries,
  getMerchantWebhookConfigEnv,
  getMerchantWebhookSecret,
  createAlert,
  markWebhookDeliveryResult,
  type WebhookDelivery,
} from './db';

const MAX_ATTEMPTS = Number(process.env.WEBHOOK_MAX_ATTEMPTS || 8);
const BASE_BACKOFF_SECONDS = Number(process.env.WEBHOOK_BACKOFF_BASE_SECONDS || 60);
const TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS || 8000);

function backoffSeconds(attempt: number): number {
  // attempt starts at 1
  const pow = Math.min(10, Math.max(0, attempt - 1));
  return BASE_BACKOFF_SECONDS * Math.pow(2, pow);
}

function signWebhook(webhookSecret: string, timestamp: number, payloadJson: string): string {
  // signature = HMAC_SHA256(secret, `${timestamp}.${payload}`)
  return createHmac('sha256', webhookSecret).update(`${timestamp}.${payloadJson}`, 'utf8').digest('hex');
}

async function deliverOne(d: WebhookDelivery): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const cfg = await getMerchantWebhookConfigEnv(d.merchant_id, (d as any).env || 'production');
  if (!cfg.webhook_enabled || !cfg.webhook_url) {
    await markWebhookDeliveryResult({
      id: d.id,
      delivered: false,
      error: 'WEBHOOK_DISABLED',
      next_retry_at: null,
    });
    return;
  }

  const whsec = await getMerchantWebhookSecret(d.merchant_id, (d as any).env || 'production');
  if (!whsec) {
    await markWebhookDeliveryResult({ id: d.id, delivered: false, error: 'MISSING_CREDENTIALS', next_retry_at: null });
    return;
  }

  const payloadJson = d.payload_json;
  const signature = signWebhook(whsec, now, payloadJson);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(cfg.webhook_url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-event-type': d.event_type,
        'x-webhook-timestamp': String(now),
        'x-webhook-signature': signature,
      },
      body: payloadJson,
      signal: controller.signal,
    } as any);

    const status = resp.status;
    const text = await resp.text().catch(() => '');
    const snippet = text ? text.slice(0, 500) : null;

    if (status >= 200 && status < 300) {
      await markWebhookDeliveryResult({ id: d.id, delivered: true, status_code: status, response_snippet: snippet });
      return;
    }

    const nextAttempt = d.attempt_count + 1;
    if (nextAttempt >= MAX_ATTEMPTS) {
      await markWebhookDeliveryResult({
        id: d.id,
        delivered: false,
        status_code: status,
        error: `HTTP_${status}`,
        response_snippet: snippet,
        next_retry_at: null,
      });
      await createAlert({ merchant_id: d.merchant_id, type: 'WEBHOOK_FAILED', message: `Webhook failed permanently for event ${d.event_type} (HTTP ${status})` });
      return;
    }

    const nextRetry = now + backoffSeconds(nextAttempt);
    await markWebhookDeliveryResult({
      id: d.id,
      delivered: false,
      status_code: status,
      error: `HTTP_${status}`,
      response_snippet: snippet,
      next_retry_at: nextRetry,
    });
  } catch (e: any) {
    const nextAttempt = d.attempt_count + 1;
    if (nextAttempt >= MAX_ATTEMPTS) {
      await markWebhookDeliveryResult({
        id: d.id,
        delivered: false,
        error: e?.name === 'AbortError' ? 'TIMEOUT' : (e?.message || 'ERROR'),
        next_retry_at: null,
      });
      await createAlert({ merchant_id: d.merchant_id, type: 'WEBHOOK_FAILED', message: `Webhook failed permanently for event ${d.event_type} (${e?.name === 'AbortError' ? 'TIMEOUT' : (e?.message || 'ERROR')})` });
      return;
    }
    const nextRetry = now + backoffSeconds(nextAttempt);
    await markWebhookDeliveryResult({
      id: d.id,
      delivered: false,
      error: e?.name === 'AbortError' ? 'TIMEOUT' : (e?.message || 'ERROR'),
      next_retry_at: nextRetry,
    });
  } finally {
    clearTimeout(t);
  }
}

export async function runWebhookWorkerOnce(): Promise<{ processed: number }> {
  const batch = await getDueWebhookDeliveries(20);
  for (const d of batch) {
    await deliverOne(d);
  }
  return { processed: batch.length };
}
