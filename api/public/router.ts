import express from 'express';
import {
  initDb,
  getSitePage,
  listSitePages,
  getSettingRaw,
} from '../../lib/db';

const router = express.Router();

router.use(async (_req, _res, next) => {
  try {
    await initDb();
    next();
  } catch (e) {
    next(e);
  }
});

router.get('/pages', async (_req, res) => {
  const pages = await listSitePages();
  res.json({ success: true, data: { pages } });
});

router.get('/pages/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  const page = await getSitePage(slug);
  if (!page) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Page not found' } });
  res.json({ success: true, data: { page } });
});

// Public config for frontend copy (kept minimal)
router.get('/config', async (_req, res) => {
  const verification_wait_hours = await getSettingRaw('verification_wait_hours');
  const upload_max_mb = await getSettingRaw('upload_max_mb');
  const wa_required = await getSettingRaw('wa_required');
  res.json({
    success: true,
    data: {
      verification_wait_hours: verification_wait_hours ?? 48,
      upload_max_mb: upload_max_mb ?? 5,
      wa_required: wa_required ?? true,
    },
  });
});

export default router;
