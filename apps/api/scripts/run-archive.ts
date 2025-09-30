import { Pool } from 'pg';
import fs from 'fs/promises';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('[db:archive] DATABASE_URL is missing; exiting gracefully');
    process.exit(0);
  }
  const sqlPath = '/app/scripts/db/archive-raw-props.sql';
  try {
    const sql = await fs.readFile(sqlPath, 'utf8');
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('COMMIT');
      console.log('[db:archive] Archival script executed successfully');
    } catch (err) {
      try { await pool.query('ROLLBACK'); } catch {}
      console.error('[db:archive] Error executing archival SQL:', err);
      process.exit(1);
    } finally {
      await pool.end();
    }
  } catch (e) {
    console.error(`[db:archive] Failed to read SQL at ${sqlPath}:`, e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[db:archive] Unexpected error:', e);
  process.exit(1);
});

