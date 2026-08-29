import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrate() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://novel:novel@localhost:5433/novel';
  console.log(`[db:migrate] Connecting to ${connectionString}...`);

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    const migrationsFolder = path.resolve(__dirname, '../drizzle');
    console.log(`[db:migrate] Applying migrations from ${migrationsFolder}...`);
    await migrate(db, { migrationsFolder });
    console.log('[db:migrate] Migrations completed successfully.');
  } catch (err) {
    console.error('[db:migrate] Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void runMigrate();
