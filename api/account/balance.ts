import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBalance } from '../../lib/orderkuota.js';

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
    const { username, token } = req.body;

    if (!username || !token) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'username and token required' },
      });
    }

    const result = await getBalance(username, token) as {
      account?: { results?: { balance?: number; qris_balance?: number } };
    };

    const accountData = result?.account?.results;
    if (!accountData) {
      return res.status(500).json({
        success: false,
        error: { code: 'BALANCE_ERROR', message: 'Failed to get balance' },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        balance: accountData.balance || 0,
        qris_balance: accountData.qris_balance || 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: { code: 'BALANCE_ERROR', message },
    });
  }
}
