import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getToken } from '../../lib/orderkuota.js';

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
    const { username, otp } = req.body;

    if (!username || !otp) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'username and otp required' },
      });
    }

    const result = await getToken(username, otp);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: { code: 'TOKEN_ERROR', message },
    });
  }
}
