#!/usr/bin/env tsx
/**
 * Apply market_props split migration to cloud database
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

  const sqlPath = path.resolve(process.cwd(), '../../supabase/overrides/20251008_market_split.sql');

  if (!fs.existsSync(sqlPath)) {
    console.error('❌ Migration file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('📝 Applying market_props split migration...\n');

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

  // Check market_props table exists
  const tableResult = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'market_props'
  `);

  if (tableResult.rows.length > 0) {
    console.log('✅ market_props table created');
  } else {
    console.log('❌ market_props table NOT found');
  }

  // Check unique index
  const indexResult = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'market_props'
    AND indexname = 'ux_market_props_book_ext'
  `);

  if (indexResult.rows.length > 0) {
    console.log('✅ ux_market_props_book_ext index created');
  } else {
    console.log('⚠️  ux_market_props_book_ext index NOT found');
  }

  // Check promotion_queue.source column
  const colResult = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promotion_queue'
    AND column_name = 'source'
  `);

  if (colResult.rows.length > 0) {
    console.log('✅ promotion_queue.source column added');
  } else {
    console.log('⚠️  promotion_queue.source column NOT found');
  }

  // Check v_prop_read_model view
  const viewResult = await client.query(`
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'v_prop_read_model'
  `);

  if (viewResult.rows.length > 0) {
    console.log('✅ v_prop_read_model view updated');
  } else {
    console.log('⚠️  v_prop_read_model view NOT found');
  }

  // Check v_daily_board view
  const boardViewResult = await client.query(`
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'v_daily_board'
  `);

  if (boardViewResult.rows.length > 0) {
    console.log('✅ v_daily_board view updated');
  } else {
    console.log('⚠️  v_daily_board view NOT found');
  }

  // Check get_unscored_market_props function
  const funcResult = await client.query(`
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'get_unscored_market_props'
  `);

  if (funcResult.rows.length > 0) {
    console.log('✅ get_unscored_market_props() function created');
  } else {
    console.log('⚠️  get_unscored_market_props() function NOT found');
  }

  await client.end();
  console.log('\n✅ Market split migration complete!');
  console.log('\nNext steps:');
  console.log('  1. Run: npx tsx src/scripts/backfill-market-props.ts');
  console.log('  2. Run: npx tsx src/scripts/rescore-market-props.ts');
  console.log('  3. Run: npx tsx src/scripts/verify-gates.ts');
}

applyMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
