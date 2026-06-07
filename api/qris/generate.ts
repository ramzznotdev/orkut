import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { initDb, getAvailableSuffix, createPendingTransaction } from '../../lib/db.js';
import { generateDynamicQris } from '../../lib/qris.js';

const EXPIRY_SECONDS = 600; // 10 minutes

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
    const { username, token, amount } = req.body;

    if (!username || !token || !amount) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'username, token, and amount required' },
      });
    }

    const baseAmount = parseInt(amount, 10);
    if (isNaN(baseAmount) || baseAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'amount must be positive number' },
      });
    }

    const { qris_static } = req.body;
    
    if (!qris_static) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'qris_static is required' },
      });
    }

    await initDb();

    const suffix = await getAvailableSuffix(username);
    const finalAmount = baseAmount + suffix;

    const qrisString = generateDynamicQris(qris_static, finalAmount);

    const now = Math.floor(Date.now() / 1000);
    const txId = uuidv4();

    await createPendingTransaction({
      id: txId,
      username,
      base_amount: baseAmount,
      unique_suffix: suffix,
      final_amount: finalAmount,
      qris_string: qrisString,
      created_at: now,
      expires_at: now + EXPIRY_SECONDS,
    });

    return res.status(200).json({
      success: true,
      data: {
        transaction_id: txId,
        base_amount: baseAmount,
        unique_suffix: suffix,
        final_amount: finalAmount,
        qris_string: qrisString,
        expires_at: now + EXPIRY_SECONDS,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: { code: 'GENERATE_ERROR', message },
    });
  }
}
