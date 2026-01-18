#!/usr/bin/env tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function checkSchema() {
  console.log('\n🔍 SUPABASE SCHEMA VERIFICATION\n');

  // Check raw_props table and its columns
  console.log('📋 Checking raw_props table...');
  const { data: rawPropsData, error: rawPropsError } = await supabase
    .from('raw_props')
    .select('*')
    .limit(1);

  if (rawPropsError) {
    console.log('❌ raw_props error:', rawPropsError.message);
  } else {
    console.log('✅ raw_props table exists');
    if (rawPropsData && rawPropsData.length > 0) {
      const columns = Object.keys(rawPropsData[0]);
      console.log(`   Columns (${columns.length}):`, columns.slice(0, 15).join(', '));

      // Check for specific canonical columns
      const hasCanonicalGame = columns.includes('canonical_game_id');
      const hasCanonicalPlayer = columns.includes('canonical_player_id');
      const hasAutoApproved = columns.includes('auto_approved');

      console.log(`   - canonical_game_id: ${hasCanonicalGame ? '✅' : '❌'}`);
      console.log(`   - canonical_player_id: ${hasCanonicalPlayer ? '✅' : '❌'}`);
      console.log(`   - auto_approved: ${hasAutoApproved ? '✅' : '❌'}`);
    }
  }

  // Check for canonical entity tables
  console.log('\n📋 Checking canonical entity tables...');
  const tables = [
    'canonical_players',
    'canonical_games',
    'player_mappings',
    'game_mappings'
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`❌ ${table}: NOT FOUND`);
      console.log(`   Error: ${error.message}`);
    } else {
      console.log(`✅ ${table}: EXISTS`);
    }
  }

  // Check existing raw_props count
  console.log('\n📊 Data Statistics...');
  const { count } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total raw_props: ${count || 0}`);

  // Check today's props
  const todayStr = new Date().toISOString().split('T')[0];
  const { count: todayCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${todayStr}T00:00:00Z`);
  console.log(`   Props created today: ${todayCount || 0}`);

  // Check migrations table
  console.log('\n📋 Checking migrations...');
  const { data: migrations, error: migError } = await supabase
    .from('_migrations')
    .select('version, name')
    .order('version', { ascending: false })
    .limit(5);

  if (migError) {
    console.log('❌ Could not read migrations:', migError.message);
  } else if (migrations && migrations.length > 0) {
    console.log('✅ Recent migrations:');
    migrations.forEach((m: any) => console.log(`   - ${m.version}: ${m.name}`));
  }

  console.log('\n');
}

checkSchema().catch(console.error);
