#!/usr/bin/env node
/**
 * Seed Test Provider Offers v2
 * Sprint: MARKET-DATA-INGESTION-WIREUP-002
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED TEST PROVIDER OFFERS v2');
  console.log('═══════════════════════════════════════════════════════════════');

  // Get canonical_events
  const { data: events } = await supabase.from('canonical_events').select('id, external_id').limit(10);
  console.log(`\n📋 Found ${events?.length || 0} canonical_events`);

  // Get markets
  const { data: markets } = await supabase.from('markets').select('id, canonical_key');
  const marketMap = new Map(markets?.map(m => [m.canonical_key, m.id]) || []);
  console.log(`📋 Found ${marketMap.size} markets`);

  // Get market_types
  const { data: marketTypes } = await supabase.from('market_types').select('id, market_key');
  const marketTypeMap = new Map(marketTypes?.map(mt => [mt.market_key, mt.id]) || []);

  // Get providers
  const { data: providers } = await supabase.from('provider_registry').select('id, code');
  const providerMap = new Map(providers?.map(p => [p.code, p.id]) || []);
  console.log(`📋 Found ${providerMap.size} providers`);

  // Get initial count
  const { count: beforeCount } = await supabase.from('provider_offers').select('id', { count: 'exact', head: true });
  console.log(`\n📊 Before: provider_offers = ${beforeCount}`);

  const moneylineMarketId = marketMap.get('game_moneyline');
  const moneylineTypeId = marketTypeMap.get('team_moneyline');
  const spreadMarketId = marketMap.get('game_spread');
  const spreadTypeId = marketTypeMap.get('team_spread');

  // Providers to use
  const testProviders = ['fanduel', 'draftkings', 'betmgm', 'pinnacle'];
  const snapshotAt = new Date().toISOString();

  let inserted = 0;
  let skipped = 0;

  // Seed offers for each event with each provider
  console.log('\n📋 Creating offers...');
  for (const event of events || []) {
    for (const providerCode of testProviders) {
      const providerId = providerMap.get(providerCode);
      if (!providerId) continue;

      // Moneyline offer
      const homeOdds = Math.round(-150 + (Math.random() * 50 - 25));
      const awayOdds = Math.round(130 + (Math.random() * 50 - 25));

      const mlOffer = {
        event_id: event.id,
        market_id: moneylineMarketId,
        market_type_id: moneylineTypeId,
        provider: providerCode,
        provider_id: providerId,
        provider_event_id: event.external_id,
        provider_market_key: `moneyline:${event.external_id}`,
        home_odds: homeOdds,
        away_odds: awayOdds,
        snapshot_at: snapshotAt,
        is_opening: false,
        is_closing: false,
        mapping_confidence: 1.0,
        meta: { test: true },
      };

      const { error: mlErr } = await supabase.from('provider_offers').insert(mlOffer);
      if (mlErr) {
        if (mlErr.code === '23505') skipped++;
        else console.log(`   ⚠ ML error: ${mlErr.message}`);
      } else {
        inserted++;
      }

      // Spread offer
      if (spreadMarketId && spreadTypeId) {
        const line = Math.round((Math.random() * 10 - 5) * 2) / 2;
        const spreadOffer = {
          event_id: event.id,
          market_id: spreadMarketId,
          market_type_id: spreadTypeId,
          provider: providerCode,
          provider_id: providerId,
          provider_event_id: event.external_id,
          provider_market_key: `spread:${event.external_id}`,
          line: line,
          over_odds: -110 + Math.round(Math.random() * 10 - 5),
          under_odds: -110 + Math.round(Math.random() * 10 - 5),
          snapshot_at: snapshotAt,
          is_opening: false,
          is_closing: false,
          mapping_confidence: 1.0,
          meta: { test: true },
        };

        const { error: spErr } = await supabase.from('provider_offers').insert(spreadOffer);
        if (spErr) {
          if (spErr.code === '23505') skipped++;
          else console.log(`   ⚠ Spread error: ${spErr.message}`);
        } else {
          inserted++;
        }
      }
    }
    console.log(`   ✓ Event ${event.external_id?.substring(0, 20)}...`);
  }

  // Get final count
  const { count: afterCount } = await supabase.from('provider_offers').select('id', { count: 'exact', head: true });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n📈 Results:`);
  console.log(`   Offers inserted: ${inserted}`);
  console.log(`   Offers skipped (duplicate): ${skipped}`);
  console.log(`\n📊 After: provider_offers = ${afterCount} (+${afterCount - beforeCount})`);

  // Verification
  console.log('\n✅ VERIFICATION:');
  if (afterCount > 0) {
    console.log(`   ✓ provider_offers > 0: PASS (${afterCount})`);
  } else {
    console.log(`   ✗ provider_offers > 0: FAIL (${afterCount})`);
  }

  // Check multi-book
  const { data: uniqueProvidersData } = await supabase
    .from('provider_offers')
    .select('provider_id');

  const uniqueProviders = new Set(uniqueProvidersData?.map(p => p.provider_id) || []);
  if (uniqueProviders.size >= 2) {
    console.log(`   ✓ Multi-book coverage: PASS (${uniqueProviders.size} providers)`);
  } else {
    console.log(`   ⚠ Multi-book coverage: ${uniqueProviders.size} providers`);
  }

  // Check offer distribution
  const { data: distribution } = await supabase.rpc('exec_sql', {
    sql: `SELECT provider, COUNT(*) as count FROM provider_offers GROUP BY provider ORDER BY count DESC`
  });

  // Alternative if exec_sql doesn't work
  for (const pCode of testProviders) {
    const { count } = await supabase.from('provider_offers').select('id', { count: 'exact', head: true }).eq('provider', pCode);
    console.log(`   ${pCode}: ${count || 0} offers`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
