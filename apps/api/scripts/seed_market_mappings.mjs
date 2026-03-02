#!/usr/bin/env node
/**
 * Seed provider_market_map with correct market types
 * Sprint: MARKET-DATA-INGESTION-WIREUP-002
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED MARKET MAPPINGS');
  console.log('═══════════════════════════════════════════════════════════════');

  // Get providers
  const { data: providers } = await supabase.from('provider_registry').select('id, code');
  console.log(`\n📋 Found ${providers?.length || 0} providers`);

  // Get market types we need
  const { data: marketTypes } = await supabase.from('market_types').select('id, market_key');
  console.log(`📋 Found ${marketTypes?.length || 0} market types`);

  // Find the right market types
  const moneyline = marketTypes?.find(m => m.market_key === 'team_moneyline');
  const spread = marketTypes?.find(m => m.market_key === 'team_spread');
  const total = marketTypes?.find(m => m.market_key === 'game_total');

  console.log('\n📋 Market type mapping:');
  console.log(`   moneyline → team_moneyline (id: ${moneyline?.id})`);
  console.log(`   spread → team_spread (id: ${spread?.id})`);
  console.log(`   total → game_total (id: ${total?.id})`);

  if (!moneyline || !spread || !total) {
    console.error('❌ Missing market types');
    process.exit(1);
  }

  // Define mappings
  const mappings = [
    { key: 'moneyline:*', market_type_id: moneyline.id },
    { key: 'spread:*', market_type_id: spread.id },
    { key: 'total:*', market_type_id: total.id },
  ];

  // Create mappings for each provider
  console.log('\n📋 Creating mappings...');
  let inserted = 0;
  let errors = 0;

  for (const provider of providers || []) {
    for (const map of mappings) {
      const { error } = await supabase.from('provider_market_map').upsert({
        provider_id: provider.id,
        provider_market_key: map.key,
        canonical_market_type_id: map.market_type_id,
        confidence_score: 1.0,
        mapping_version: 1,
        source: 'bootstrap',
      }, { onConflict: 'provider_id,provider_market_key,mapping_version' });

      if (error) {
        console.log(`   ⚠ Error for ${provider.code}:${map.key}: ${error.message}`);
        errors++;
      } else {
        console.log(`   ✓ ${provider.code}:${map.key}`);
        inserted++;
      }
    }
  }

  // Verify
  const { count } = await supabase.from('provider_market_map').select('id', { count: 'exact', head: true });

  console.log('\n📊 Results:');
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total provider_market_map entries: ${count}`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
