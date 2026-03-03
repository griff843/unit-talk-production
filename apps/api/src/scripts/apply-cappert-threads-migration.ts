#!/usr/bin/env tsx
/**
 * Apply capper thread authority migration to Supabase (cloud) via pooler URL
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function parsePooler(urlStr: string) {
  const u = new URL(urlStr);
  const [user, project] = (u.username || '').split('.');
  return {
    host: u.hostname,
    port: Number(u.port || '6543'),
    database: (u.pathname || '/postgres').replace('/', '') || 'postgres',
    user: u.username,
    password: decodeURIComponent(u.password || ''),
    project,
  };
}

async function applyMigration() {
  const poolerUrl =
    process.env.SUPABASE_DB_URL_POOLER ||
    process.env.DATABASE_DIRECT_URL ||
    process.env.DATABASE_URL;
  if (!poolerUrl) {
    console.error('❌ SUPABASE_DB_URL_POOLER (or DATABASE_URL) not set.');
    process.exit(1);
  }

  const cfg = parsePooler(poolerUrl);
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 300000,
  });

  await client.connect();
  console.log('✅ Connected to Supabase pooler:', cfg.host);

  const sqlPath = path.resolve(
    process.cwd(),
    '../../supabase/overrides/20251016_capper_threads.sql'
  );
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ Migration file not found:', sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('📝 Applying capper threads migration...');
  try {
    await client.query(sql);
    console.log('✅ Migration applied');
  } catch (e: any) {
    console.error('❌ Migration error:', e?.message || e);
    await client.end();
    process.exit(1);
  }

  console.log('🔄 Reloading PostgREST schema cache...');
  try {
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('✅ Schema cache reloaded');
  } catch (e: any) {
    console.warn('⚠️ Failed to reload schema cache:', e?.message || e);
  }

  console.log('🔍 Verifying tables/columns...');
  const checks = [
    {
      name: 'user_threads table',
      q: `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_threads'`,
    },
    {
      name: 'bridge_dead_letter table',
      q: `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bridge_dead_letter'`,
    },
    {
      name: 'unified_picks.thread_id column',
      q: `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='unified_picks' AND column_name='thread_id'`,
    },
  ];

  for (const c of checks) {
    const r = await client.query(c.q);
    console.log(r.rowCount > 0 ? `✅ ${c.name}` : `❌ ${c.name} missing`);
  }

  await client.end();
  console.log('\n✅ Capper threads migration complete');
}

applyMigration().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
