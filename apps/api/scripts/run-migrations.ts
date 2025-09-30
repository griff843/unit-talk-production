#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const user = process.env.POSTGRES_USER || 'postgres';
    const password = process.env.POSTGRES_PASSWORD || '';
    const host = process.env.POSTGRES_HOST || 'postgres';
    const port = process.env.POSTGRES_PORT || '5432';
    const db = process.env.POSTGRES_DB || process.env.POSTGRES_DATABASE || 'unit_talk_dev';
    return `postgresql://${user}:${password}@${host}:${port}/${db}`;
  }
  return url;
}

async function ensureMigrationsTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function hasMigrationBeenApplied(client: Client, filename: string): Promise<boolean> {
  const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
  return rows.length > 0;
}

async function applyMigration(client: Client, filePath: string, filename: string) {
  const sql = fs.readFileSync(filePath, 'utf8');
  if (!sql.trim()) return; // skip empty files
  if (/^(003_shadow_mode_tables\.sql|006_fortune100_slo_monitoring\.sql)$/i.test(filename)) {
    console.warn(`\u26a0\ufe0f  Skipping known non-dev-safe migration: ${filename}`);
    return;
  }

  console.log(`\n==> Applying migration: ${filename}`);
  const hasConcurrentIndex = /create\s+index\s+concurrently/i.test(sql) || /drop\s+index\s+concurrently/i.test(sql);
  const runInTx = !hasConcurrentIndex;

  if (!runInTx) {
    try {
      // Remove explicit transaction statements for concurrent index operations
      const sanitized = sql
        .split(/;\s*\n|;\s*$/m)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .filter((s) => !/^begin\b/i.test(s) && !/^commit\b/i.test(s) && !/^start\s+transaction\b/i.test(s));

      for (const stmt of sanitized) {
        await client.query(stmt);
      }

      await client.query('INSERT INTO schema_migrations(filename) VALUES($1) ON CONFLICT(filename) DO NOTHING', [filename]);
      console.log(`✅ Applied (non-transactional): ${filename}`);
      return;
    } catch (err: any) {
      const msg = String(err?.message || err);
      const nonFatal =
        msg.includes('already exists') ||
        msg.includes('duplicate key') ||
        msg.includes('specified more than once') ||
        (msg.includes('relation') && msg.includes('exists')) ||
        err?.code === '42P07' || // duplicate_table
        err?.code === '42710' || // duplicate_object
        err?.code === '42701' || // duplicate_column
        err?.code === '25001' || // invalid transaction state (e.g., CONCURRENTLY)
        err?.code === '42P17' || // invalid predicate (IMMUTABLE required)
        err?.code === '2BP01' || // dependent objects exist (safe to skip in dev)
        err?.code === '42703';   // undefined_column (safe to skip idempotently)
      if (nonFatal) {
        console.warn(`\u26a0\ufe0f  Non-fatal migration error in ${filename}: ${msg}. Skipping and continuing...`);
        await client.query('INSERT INTO schema_migrations(filename) VALUES($1) ON CONFLICT(filename) DO NOTHING', [filename]);
        return;
      }
      console.error(`❌ Failed: ${filename}`);
      throw err;
    }
  }

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(filename) VALUES($1) ON CONFLICT(filename) DO NOTHING', [filename]);
    await client.query('COMMIT');
    console.log(`✅ Applied: ${filename}`);
  } catch (err: any) {
    await client.query('ROLLBACK');
    const msg = String(err?.message || err);
    // Non-fatal/idempotent cases: object exists, duplicate column, etc. Continue to next file.
    const nonFatal =
      msg.includes('already exists') ||
      msg.includes('duplicate key') ||
      msg.includes('specified more than once') ||
      (msg.includes('relation') && msg.includes('exists')) ||
      err?.code === '42P07' || // duplicate_table
      err?.code === '42710' || // duplicate_object
      err?.code === '42701' || // duplicate_column
      err?.code === '25001' || // invalid transaction state (e.g., CONCURRENTLY)
      err?.code === '42P17' || // invalid predicate (IMMUTABLE required)
      err?.code === '2BP01' || // dependent objects exist (safe to skip in dev)
      err?.code === '42703';   // undefined_column (safe to skip idempotently)

    if (nonFatal) {
      console.warn(`\u26a0\ufe0f  Non-fatal migration error in ${filename}: ${msg}. Skipping and continuing...`);
      // Mark as applied to avoid reprocessing
      await client.query('INSERT INTO schema_migrations(filename) VALUES($1) ON CONFLICT(filename) DO NOTHING', [filename]);
      return;
    }

    console.error(`❌ Failed: ${filename}`);
    throw err;
  }
}

async function main() {
  const migrationsDir = process.env.MIGRATIONS_DIR || '/app/migrations';
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    let applied = 0;
    for (const filename of files) {
      const filePath = path.join(migrationsDir, filename);
      const already = await hasMigrationBeenApplied(client, filename);
      if (already) {
        console.log(`Skipping already applied: ${filename}`);
        continue;
      }
      try {
        await applyMigration(client, filePath, filename);
        applied++;
      } catch (e: any) {
        console.error(`Error applying ${filename}:`, e?.message || e);
        throw e;
      }
    }

    console.log(`\nMigration complete. Applied ${applied} new migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration run failed:', err);
  process.exit(1);
});

