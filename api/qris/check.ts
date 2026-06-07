import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getQrisHistory } from '../../lib/orderkuota.js';
import {
  initDb,
  getPendingTransaction,
  deletePendingTransaction,
  createPaidTransaction,
  getPaidTransaction,
} from '../../lib/db.js';

const PAID_EXPIRY_SECONDS = 3600; // 1 hour

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST allowed' },
    });
  }

  try {
    const { username, token, transaction_id } = req.body;

    if (!username || !token || !transaction_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'username, token, and transaction_id required' },
      });
    }

    await initDb();

    // Check if already paid
    const paidTx = await getPaidTransaction(transaction_id);
    if (paidTx) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'paid',
          final_amount: paidTx.final_amount,
          paid_at: paidTx.paid_at,
        },
      });
    }

    // Get pending transaction
    const tx = await getPendingTransaction(transaction_id);
    if (!tx) {
      return res.status(200).json({
        success: true,
        data: { status: 'not_found' },
      });
    }

    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    if (now > tx.expires_at) {
      await deletePendingTransaction(transaction_id);
      return res.status(200).json({
        success: true,
        data: { status: 'expired' },
      });
    }

    // Check history from OrderKuota
    const historyResult = await getQrisHistory(username, token) as Record<string, unknown>;

    // Try multiple possible response structures
    const historyData = (historyResult?.qris_ajaib_history as Record<string, unknown>)?.results 
      || (historyResult?.qris_history as Record<string, unknown>)?.results
      || [];
    
    const history = Array.isArray(historyData) ? historyData : [];
    
    const found = history.find((h: Record<string, unknown>) => {
      // Parse kredit field (format: "1.001" with dot as thousand separator)
      const kreditStr = String(h.kredit || '').replace(/\./g, '');
      const amt = parseInt(kreditStr, 10) || 0;
      return amt === tx.final_amount && h.status === 'IN';
    });

    if (found) {
      await deletePendingTransaction(transaction_id);
      await createPaidTransaction({
        id: transaction_id,
        username,
        final_amount: tx.final_amount,
        paid_at: now,
        expires_at: now + PAID_EXPIRY_SECONDS,
      });

      return res.status(200).json({
        success: true,
        data: {
          status: 'paid',
          final_amount: tx.final_amount,
          paid_at: now,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        status: 'pending',
        final_amount: tx.final_amount,
        expires_in: tx.expires_at - now,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: { code: 'CHECK_ERROR', message },
    });
  }
}
