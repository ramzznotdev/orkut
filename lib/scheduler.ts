import { randomUUID } from 'crypto';
import {
  initDb,
  listInvoicesDueForExpiry,
  setInvoiceExpired,
  createInvoiceEvent,
  enqueueWebhookDelivery,
  cleanupExpiredRows,
} from './db';
import { runWebhookWorkerOnce } from './webhook_worker';

const INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS || 15000);

export function startScheduler() {
  // Fire-and-forget loop
  initDb().catch((e) => console.error('initDb failed', e));

  setInterval(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);

      // Expire due invoices
      const due = await listInvoicesDueForExpiry(200);
      for (const inv of due) {
        await setInvoiceExpired(inv.id, inv.merchant_id, now);
        await createInvoiceEvent({
          id: randomUUID(),
          invoice_id: inv.id,
          merchant_id: inv.merchant_id,
          event_type: 'payment.expired',
          payload: { invoice_id: inv.id },
          created_at: now,
        });
        await enqueueWebhookDelivery({
          merchant_id: inv.merchant_id,
          invoice_id: inv.id,
          event_type: 'payment.expired',
          payload: { invoice_id: inv.id, event_type: 'payment.expired', created_at: now },
          run_at: now,
        });
      }

      // Cleanup
      await cleanupExpiredRows();

      // Webhook worker retry queue
      await runWebhookWorkerOnce();
    } catch (e) {
      console.error('scheduler tick error', e);
    }
  }, INTERVAL_MS);

  console.log(`⏱️ Scheduler started (interval ${INTERVAL_MS}ms)`);
}
