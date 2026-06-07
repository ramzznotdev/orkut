import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as QRCode from 'qrcode';

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
    const { qris_string, size = 300, format = 'png' } = req.body;

    if (!qris_string) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'qris_string is required' },
      });
    }

    const options: QRCode.QRCodeToDataURLOptions = {
      type: format === 'png' ? 'image/png' : 'image/jpeg',
      width: Math.min(Math.max(size, 100), 1000),
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    };

    const dataUrl = await QRCode.toDataURL(qris_string, options);

    return res.status(200).json({
      success: true,
      data: {
        qr_image: dataUrl,
        size: options.width,
        format,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: { code: 'IMAGE_ERROR', message },
    });
  }
}
