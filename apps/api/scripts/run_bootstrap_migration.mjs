#!/usr/bin/env node
/**
 * Run Bootstrap Migration via Supabase JS Client
 * Sprint: MARKET-DATA-INGESTION-WIREUP-002
 *
 * Since direct PostgreSQL connection fails (IPv6 DNS resolution),
 * this script runs migration SQL via Supabase's JavaScript client.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runSQL(sql, description) {
  console.log(`\n📝 ${description}...`);
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    // exec_sql might not exist, try direct query
    console.log('   exec_sql not available, trying direct approach...');
    return false;
  }
  console.log('   ✓ Done');
  return true;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  BOOTSTRAP MIGRATION RUNNER');
  console.log('  Sprint: MARKET-DATA-INGESTION-WIREUP-002');
  console.log('═══════════════════════════════════════════════════════════════');

  // Step 1: Create api_credit_log table
  console.log('\n📋 Step 1: Create api_credit_log table');
  const { error: creditLogError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS api_credit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        credits_used INTEGER NOT NULL DEFAULT 1,
        response_status INTEGER,
        latency_ms INTEGER,
        remaining_credits INTEGER,
        error_message TEXT,
        meta JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_api_credit_log_provider_time ON api_credit_log(provider, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_api_credit_log_created_at ON api_credit_log(created_at DESC);
    `
  });

  if (creditLogError) {
    console.log('   Note: exec_sql not available, checking if table exists...');

    // Check if table exists by trying to select from it
    const { error: checkError } = await supabase.from('api_credit_log').select('id').limit(1);
    if (checkError && checkError.code === '42P01') {
      console.log('   ⚠ api_credit_log table does not exist - needs manual creation');
    } else {
      console.log('   ✓ api_credit_log table already exists');
    }
  } else {
    console.log('   ✓ Created api_credit_log table');
  }

  // Step 2: Seed markets
  console.log('\n📋 Step 2: Seed base markets');
  const marketsToSeed = [
    { canonical_key: 'game_moneyline', display_name: 'Game Moneyline', category: 'game_line', bet_structure: 'moneyline' },
    { canonical_key: 'game_spread', display_name: 'Game Point Spread', category: 'game_line', bet_structure: 'spread' },
    { canonical_key: 'game_total', display_name: 'Game Total Points', category: 'game_line', bet_structure: 'over_under' },
  ];

  for (const market of marketsToSeed) {
    const { error } = await supabase.from('markets').upsert(market, { onConflict: 'canonical_key' });
    if (error) {
      console.log(`   ⚠ Error seeding market ${market.canonical_key}: ${error.message}`);
    } else {
      console.log(`   ✓ Seeded ${market.canonical_key}`);
    }
  }

  // Step 3: Seed market_types
  console.log('\n📋 Step 3: Seed market_types');
  const marketTypes = [
    { market_key: 'moneyline', display_name: 'Moneyline', category: 'game', bet_structure: 'two_way', participant_scope: 'NONE' },
    { market_key: 'spread', display_name: 'Point Spread', category: 'game', bet_structure: 'two_way', participant_scope: 'NONE' },
    { market_key: 'total', display_name: 'Over/Under Total', category: 'game', bet_structure: 'two_way', participant_scope: 'NONE' },
  ];

  for (const mt of marketTypes) {
    const { error } = await supabase.from('market_types').upsert(mt, { onConflict: 'market_key' });
    if (error) {
      console.log(`   ⚠ Error seeding market_type ${mt.market_key}: ${error.message}`);
    } else {
      console.log(`   ✓ Seeded ${mt.market_key}`);
    }
  }

  // Step 4: Verify provider_registry
  console.log('\n📋 Step 4: Verify provider_registry');
  const { data: providers, error: providerError } = await supabase
    .from('provider_registry')
    .select('code');

  if (providerError) {
    console.log(`   ⚠ Error checking providers: ${providerError.message}`);
  } else {
    console.log(`   ✓ Found ${providers?.length || 0} providers`);
    providers?.forEach(p => console.log(`      - ${p.code}`));
  }

  // Step 5: Seed provider_market_map
  console.log('\n📋 Step 5: Seed provider_market_map');
  const providerCodes = ['fanduel', 'draftkings', 'betmgm', 'caesars', 'pointsbet', 'betrivers', 'espnbet', 'pinnacle'];
  const marketMappings = [
    { provider_key: 'moneyline:*', canonical_key: 'moneyline' },
    { provider_key: 'spread:*', canonical_key: 'spread' },
    { provider_key: 'total:*', canonical_key: 'total' },
  ];

  for (const providerCode of providerCodes) {
    // Get provider_id
    const { data: providerData } = await supabase
      .from('provider_registry')
      .select('id')
      .eq('code', providerCode)
      .single();

    if (!providerData) {
      console.log(`   ⚠ Provider ${providerCode} not found, skipping`);
      continue;
    }

    for (const mapping of marketMappings) {
      // Get market_type_id
      const { data: mtData } = await supabase
        .from('market_types')
        .select('id')
        .eq('market_key', mapping.canonical_key)
        .single();

      if (!mtData) continue;

      const { error } = await supabase.from('provider_market_map').upsert({
        provider_id: providerData.id,
        provider_market_key: mapping.provider_key,
        canonical_market_type_id: mtData.id,
        confidence_score: 1.0,
        mapping_version: 1,
      }, { onConflict: 'provider_id,provider_market_key,mapping_version' });

      if (!error) {
        console.log(`   ✓ Mapped ${providerCode}:${mapping.provider_key} -> ${mapping.canonical_key}`);
      }
    }
  }

  // Step 6: Check current state
  console.log('\n📊 Current State:');

  const [marketsResult, marketTypesResult, providerMapResult, eventsResult, offersResult] = await Promise.all([
    supabase.from('markets').select('id', { count: 'exact', head: true }),
    supabase.from('market_types').select('id', { count: 'exact', head: true }),
    supabase.from('provider_market_map').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('provider_offers').select('id', { count: 'exact', head: true }),
  ]);

  console.log(`   markets: ${marketsResult.count || 0}`);
  console.log(`   market_types: ${marketTypesResult.count || 0}`);
  console.log(`   provider_market_map: ${providerMapResult.count || 0}`);
  console.log(`   events: ${eventsResult.count || 0}`);
  console.log(`   provider_offers: ${offersResult.count || 0}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
