import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';

function getDbPath(): string {
  return process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'orderkuota.sqlite');
}

async function initDb() {
  const filename = getDbPath();
  fs.mkdirSync(path.dirname(filename), { recursive: true });

  const db = await open({ filename, driver: sqlite3.Database });

  console.log('Creating tables...');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS pending_transactions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      base_amount INTEGER NOT NULL,
      unique_suffix INTEGER NOT NULL,
      final_amount INTEGER NOT NULL,
      qris_string TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS paid_transactions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      final_amount INTEGER NOT NULL,
      paid_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_suffix
    ON pending_transactions(username, unique_suffix);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pending_expires
    ON pending_transactions(expires_at);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_paid_expires
    ON paid_transactions(expires_at);
  `);

  console.log('Done.');
  await db.close();
}

initDb().catch((e) => {
  console.error(e);
  process.exit(1);
});
