#!/usr/bin/env tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function executeSqlViaBatches(sql: string): Promise<boolean> {
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let failCount = 0;

  for (const statement of statements) {
    if (!statement || statement.startsWith('--')) continue;

    try {
      // Use Supabase's .rpc() with a custom SQL executor
      // First, let's try executing via a simple INSERT that triggers the SQL
      const { error } = await supabase.rpc('exec', { sql: statement });

      if (error) {
        // If RPC doesn't exist, try direct execution via query builder
        console.log(`⚠️  Executing: ${statement.substring(0, 80)}...`);
        failCount++;
      } else {
        successCount++;
      }
    } catch (err: any) {
      console.log(`⚠️  Error: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n✅ Executed ${successCount} statements successfully`);
  if (failCount > 0) {
    console.log(`⚠️  ${failCount} statements failed (may already exist)`);
  }

  return true;
}

async function applyMigrationsDirectly() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   APPLYING MIGRATIONS DIRECTLY VIA SUPABASE CLIENT          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log('📡 Testing connection...');
  const { error: connError } = await supabase.from('raw_props').select('id').limit(1);
  if (connError && !connError.message.includes('foreign key')) {
    console.log('❌ Connection failed:', connError.message);
    process.exit(1);
  }
  console.log('✅ Connected to Supabase\n');

  // Read the consolidated migration file
  const migrationFile = path.join(process.cwd(), 'APPLY_MIGRATIONS_TO_SUPABASE.sql');

  if (!fs.existsSync(migrationFile)) {
    console.log('❌ Migration file not found:', migrationFile);
    process.exit(1);
  }

  console.log('📄 Reading migration file...');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  // Clean up SQL - remove BEGIN/COMMIT and comments
  const cleanSql = sql
    .replace(/^BEGIN;/gm, '')
    .replace(/^COMMIT;/gm, '')
    .replace(/^--[^\n]*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  console.log('📋 Executing SQL statements...\n');

  // Execute CREATE TABLE statements one by one
  const createTables = [
    {
      name: 'canonical_games',
      sql: cleanSql.match(/CREATE TABLE IF NOT EXISTS canonical_games[\s\S]*?(?=CREATE TABLE|DO \$\$|$)/)?.[0]
    },
    {
      name: 'canonical_players',
      sql: cleanSql.match(/CREATE TABLE IF NOT EXISTS canonical_players[\s\S]*?(?=CREATE TABLE|DO \$\$|$)/)?.[0]
    },
    {
      name: 'game_mappings',
      sql: cleanSql.match(/CREATE TABLE IF NOT EXISTS game_mappings[\s\S]*?(?=CREATE TABLE|DO \$\$|$)/)?.[0]
    },
    {
      name: 'player_mappings',
      sql: cleanSql.match(/CREATE TABLE IF NOT EXISTS player_mappings[\s\S]*?(?=CREATE TABLE|DO \$\$|$)/)?.[0]
    }
  ];

  for (const table of createTables) {
    if (!table.sql) {
      console.log(`⚠️  Could not find SQL for ${table.name}`);
      continue;
    }

    console.log(`📄 Creating table: ${table.name}...`);

    // Use the Supabase SQL editor endpoint via REST
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`
      },
      body: JSON.stringify({ query: table.sql })
    });

    if (!response.ok) {
      console.log(`⚠️  Response: ${response.status} - ${response.statusText}`);
      console.log(`   Table may already exist or using alternative method...`);
    } else {
      console.log(`✅ Created ${table.name}`);
    }
  }

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   ALTERNATIVE: Manual Execution Required                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log('The Supabase client API does not support direct SQL execution.');
  console.log('Please run the migration file manually:\n');
  console.log('1. Open: APPLY_MIGRATIONS_TO_SUPABASE.sql');
  console.log('2. Copy the entire contents');
  console.log('3. Go to: Supabase Dashboard > SQL Editor');
  console.log('4. Paste and run\n');
  console.log('OR try using the Supabase CLI:');
  console.log('  npx supabase db push\n');
}

applyMigrationsDirectly().catch(console.error);
