#!/usr/bin/env tsx
/**
 * Apply Week 1 migration to cloud database
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  const client = new Client({
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.lxqmuzmqtnnlpfapvief',
    password: 'Adalise843!',
    ssl: { rejectUnauthorized: false },
    statement_timeout: 300000 // 5 minutes
  });

  await client.connect();
  console.log('✅ Connected to Supabase\n');

  const sqlPath = path.resolve(process.cwd(), '../../supabase/migrations/20251006_week1_complete_deployment.sql');

  if (!fs.existsSync(sqlPath)) {
    console.error('❌ Migration file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('📝 Applying Week 1 migration (this may take a few minutes)...\n');

  try {
    await client.query(sql);
    console.log('✅ Migration applied successfully!\n');
  } catch (error: any) {
    console.error('❌ Migration error:', error.message);
    await client.end();
    process.exit(1);
  }

  // Reload schema cache
  console.log('🔄 Reloading PostgREST schema cache...');
  await client.query("NOTIFY pgrst, 'reload schema'");
  console.log('✅ Schema cache reloaded\n');

  // Verify key changes
  console.log('🔍 Verifying migration...\n');

  // Check unified_picks columns
  const colsResult = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'unified_picks'
    AND column_name IN ('over_odds', 'under_odds')
    ORDER BY column_name
  `);

  console.log('unified_picks columns:');
  if (colsResult.rows.length === 2) {
    colsResult.rows.forEach(r => console.log('  ✅', r.column_name));
  } else {
    console.log('  ❌ Missing columns!');
  }

  // Check materialized views
  const viewsResult = await client.query(`
    SELECT matviewname
    FROM pg_matviews
    WHERE matviewname IN ('player_recent_performance', 'player_prop_history')
    ORDER BY matviewname
  `);

  console.log('\nMaterialized views:');
  if (viewsResult.rows.length === 2) {
    viewsResult.rows.forEach(r => console.log('  ✅', r.matviewname));
  } else {
    console.log('  ⚠️  Only', viewsResult.rows.length, 'of 2 views found');
  }

  // Check function
  const funcResult = await client.query(`
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_name = 'count_outcomes_by_sport'
    AND routine_schema = 'public'
  `);

  console.log('\nDatabase functions:');
  if (funcResult.rows.length > 0) {
    console.log('  ✅ count_outcomes_by_sport');
  } else {
    console.log('  ⚠️  count_outcomes_by_sport not found');
  }

  await client.end();
  console.log('\n✅ Week 1 migration complete!');
  console.log('\nNext steps:');
  console.log('  1. Run: npx tsx src/scripts/normalize-raw-props.ts');
  console.log('  2. Run: npx tsx src/scripts/verify-gates.ts');
}

applyMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
