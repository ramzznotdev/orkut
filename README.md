# Proxy Gateway OrderKuota (Express + SQLite + React)

Project ini adalah proxy/gateway sederhana untuk beberapa endpoint OrderKuota (OTP, Token, Balance) + fitur QRIS.

Versi ini sudah:
- ✅ Database **SQLite lokal** (file-based, tanpa Turso/libSQL)
- ✅ Backend **Express**
- ✅ Frontend **React (Vite SPA)** yang di-serve oleh Express pada **port yang sama**

---

## Struktur
- `server.ts` = Express API + serve frontend
- `api/` = route handler lama (tidak diubah alurnya)
- `lib/` = util + DB (SQLite)
- `web/` = React/Vite app (build → `web/dist`)
- `data/` = lokasi file SQLite (dibuat otomatis)

---

## Environment
Buat `.env` (atau set env di panel):

```env
PORT=9013
SQLITE_PATH=./data/orderkuota.sqlite
```

`SQLITE_PATH` optional (kalau tidak diset, defaultnya `./data/orderkuota.sqlite`).

---

## Install
> Karena frontend punya dependencies sendiri, jalankan install untuk root dan folder `web`.

```bash
npm install
npm --prefix web install
```

---

## Development
Jalankan backend:

```bash
npm run dev
```

Jalankan frontend dev-server (opsional, untuk develop UI):

```bash
npm run dev:web
```

> Saat dev, React jalan di Vite port default (5173) dan request `/api/*` akan di-proxy ke `http://localhost:9013`.

---

## Production (1 port)
Build React lalu start server:

```bash
npm run build
npm run start
```

Atau 1 command:

```bash
npm run prod
```

Express akan serve `web/dist` pada port yang sama (mis. 9013).

---

## API endpoints
Frontend demo memanggil:
- `GET /api/health`

Endpoint lama yang tetap tersedia:
- `POST /api/auth/otp`
- `POST /api/auth/token`
- `POST /api/account/balance`
- `POST /api/qris/generate`
- `POST /api/qris/check`
- `GET|POST /api/qris/image`

---

## Catatan Pterodactyl
- SQLite tidak butuh port tambahan.
- Pastikan folder `data/` bisa ditulis.
- Jika install `sqlite3` gagal (native build), pakai image Node yang mendukung build tools.


## Signed Request (Timestamp + Nonce + HMAC)
All `/api/gw/*` endpoints require headers:
- `x-api-key`
- `x-timestamp` (unix seconds)
- `x-nonce` (unique per request)
- `x-signature` (hex HMAC-SHA256)

Canonical string:

```text
METHOD\nPATH_WITH_QUERY\nTIMESTAMP\nNONCE\nBODY_RAW
```

Use `sdk/signing.js`.

### Contoh (Node.js fetch)

Set env lalu jalankan contoh:

```bash
BASE_URL=http://localhost:9013 \
API_KEY=sk_live_... \
API_SECRET=ss_live_... \
node examples/node_fetch_create_invoice.mjs
```

---

## Onboarding Merchant

1. Register akun merchant di halaman Register (frontend).
2. Isi data: nama, email, nama bisnis, password.
3. Setelah register, merchant status = pending.
4. Setelah di-approve oleh operator/admin, merchant bisa login dan akses dashboard, API key, webhook, dsb.

> Catatan: Fitur admin/monitoring hanya untuk operator, tidak tersedia untuk user/merchant.

