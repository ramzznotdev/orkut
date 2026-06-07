import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

async function initDb() {
  console.log('Creating tables...');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS pending_transactions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      base_amount INTEGER NOT NULL,
      unique_suffix INTEGER NOT NULL,
      final_amount INTEGER NOT NULL,
      qris_string TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS paid_transactions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      final_amount INTEGER NOT NULL,
      paid_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_suffix 
    ON pending_transactions(username, unique_suffix)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_pending_expires 
    ON pending_transactions(expires_at)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_paid_expires 
    ON paid_transactions(expires_at)
  `);

  console.log('Database initialized successfully!');
}

initDb().catch(console.error);
