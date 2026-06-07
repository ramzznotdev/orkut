import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// === import handler API (asli dari project lama) ===
import health from "./api/health";
import otp from "./api/auth/otp";
import token from "./api/auth/token";
import balance from "./api/account/balance";
import qrisGenerate from "./api/qris/generate";
import qrisCheck from "./api/qris/check";
import qrisImage from "./api/qris/image";

// === app routes (flow baru) ===
import appRouter from "./api/app/router";
import adminRouter from "./api/admin/router";
import gwRouter from "./api/gw/router";
import publicRouter from "./api/public/router";
import { startScheduler } from "./lib/scheduler";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Capture raw body for HMAC signature verification (gateway endpoints)
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf?.toString('utf8') || '';
    },
  })
);

// === API ROUTES (tetap sama) ===
app.all("/api/health", (req, res) => health(req as any, res as any));
app.all("/api/auth/otp", (req, res) => otp(req as any, res as any));
app.all("/api/auth/token", (req, res) => token(req as any, res as any));
app.all("/api/account/balance", (req, res) => balance(req as any, res as any));
app.all("/api/qris/generate", (req, res) => qrisGenerate(req as any, res as any));
app.all("/api/qris/check", (req, res) => qrisCheck(req as any, res as any));
app.all("/api/qris/image", (req, res) => qrisImage(req as any, res as any));

// v1 aliases for legacy routes
app.all("/api/v1/health", (req, res) => health(req as any, res as any));
app.all("/api/v1/auth/otp", (req, res) => otp(req as any, res as any));
app.all("/api/v1/auth/token", (req, res) => token(req as any, res as any));
app.all("/api/v1/account/balance", (req, res) => balance(req as any, res as any));
app.all("/api/v1/qris/generate", (req, res) => qrisGenerate(req as any, res as any));
app.all("/api/v1/qris/check", (req, res) => qrisCheck(req as any, res as any));
app.all("/api/v1/qris/image", (req, res) => qrisImage(req as any, res as any));

// Flow baru (merchant profile + verifikasi)
app.use("/api/app", appRouter);
app.use("/api/admin", adminRouter);

// Gateway protected routes (API key required)
app.use('/api/gw', gwRouter);

// Public CMS endpoints
app.use('/api/public', publicRouter);

// =====================
// API Versioning (v1)
// =====================
// New clients should use /api/v1/*.
// Unversioned routes are kept for backward compatibility.
app.use('/api/v1/app', appRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/gw', gwRouter);
app.use('/api/v1/public', publicRouter);

// =====================
// React SPA (utama) → /
// =====================
const webDist = path.join(__dirname, "web", "dist");
const hasWebDist = fs.existsSync(path.join(webDist, "index.html"));

if (hasWebDist) {
  app.use(express.static(webDist));

  // SPA fallback (Express v5 safe): serve index.html untuk semua route non-API
  app.get(/.*/, (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }
    return res.sendFile(path.join(webDist, "index.html"));
  });
} else {
  // Kalau React belum dibuild, tampilkan halaman kecil
  app.get(/.*/, (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Proxy Gateway OrderKuota</title>
    <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:24px;max-width:760px;margin:0 auto} code{background:#f2f2f2;padding:2px 6px;border-radius:6px}</style>
  </head>
  <body>
    <h1>React frontend belum dibuild</h1>
    <p>Build dulu folder <code>web</code> di lokal (hasilkan <code>web/dist</code>), lalu upload ke server.</p>
  </body>
</html>`);
  });
}

startScheduler();

const PORT = Number(process.env.PORT || 9013);
app.listen(PORT, () => {
  console.log(`🚀 Express running on port ${PORT}`);
  console.log(`🖥️  React frontend: ${hasWebDist ? "ON" : "OFF (build dulu)"}`);
});
