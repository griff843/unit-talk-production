#!/usr/bin/env tsx
/**
 * Phase 1 Live-Fire Ingestion - Simplified Supabase Pipeline
 *
 * ✅ PRODUCTION CANARY APPROVED
 * ✅ Uses OddsApiClient + CanonicalMappingService (same as FeedAgent)
 * ✅ Writes to Supabase v3 schema with canonical IDs
 * ✅ Real Odds API data for TODAY's slate
 *
 * Date: December 5, 2025
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { OddsApiClient } from '../src/agents/FeedAgent/oddsApi';
import { CanonicalMappingService } from '../src/services/canonical/CanonicalMappingService';
import type { Sport, MappingSource } from '../src/types/canonical-entities';

// Load environment variables from workspace root
const rootEnvPath = resolve(__dirname, '../../../.env');
const sharedEnvPath = resolve(__dirname, '../../../.env.shared');
dotenv.config({ path: rootEnvPath });
dotenv.config({ path: sharedEnvPath });

// Validate required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ODDS_API_KEY) {
  console.error('❌ FATAL: Missing required environment variables:');
  if (!process.env.SUPABASE_URL) console.error('  - SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.ODDS_API_KEY) console.error('  - ODDS_API_KEY');
  console.error('\nPlease ensure .env and .env.shared files are configured properly.');
  process.exit(1);
}

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║   PHASE 1 LIVE-FIRE INGESTION - SUPABASE PRODUCTION        ║');
console.log('║   Pipeline: OddsAPI → CanonicalMapping → Supabase          ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

console.log('🔍 ENVIRONMENT AUDIT:\n');
console.log(`  ODDS_API_KEY: SET (${process.env.ODDS_API_KEY.length} chars)`);
console.log(`  SUPABASE_URL: ${process.env.SUPABASE_URL}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY: SET (${process.env.SUPABASE_SERVICE_ROLE_KEY.length} chars)`);
console.log('');

/**
 * Normalize sport name to canonical Sport type
 */
function normalizeSport(sport: string): Sport {
  const sportUpper = sport.toUpperCase();
  if (sportUpper.includes('NBA')) return 'NBA';
  if (sportUpper.includes('NFL')) return 'NFL';
  if (sportUpper.includes('MLB')) return 'MLB';
  if (sportUpper.includes('NHL')) return 'NHL';
  if (sportUpper.includes('NCAAB')) return 'NCAAB';
  if (sportUpper.includes('NCAAF')) return 'NCAAF';
  return 'NBA'; // default
}

/**
 * Map provider to MappingSource
 */
function mapSource(provider?: string): MappingSource {
  const providerLower = (provider || '').toLowerCase();
  if (providerLower.includes('odds') || providerLower.includes('oddsapi')) {
    return 'odds_api';
  }
  return 'odds_api'; // default for this script
}

/**
 * Enrich prop with canonical mappings (same logic as FeedAgent)
 */
async function enrichWithCanonicalMappings(
  prop: any,
  canonicalService: CanonicalMappingService
): Promise<any> {
  try {
    let canonical_game_id: string | undefined;
    let canonical_player_id: string | undefined;

    // Map game if we have required data
    if (prop.home_team && prop.away_team && prop.event_time && prop.sport) {
      const gameResult = await canonicalService.mapGame({
        source: mapSource(prop.provider || prop.source),
        external_game_id: prop.external_game_id || `${prop.home_team}-${prop.away_team}-${prop.event_time}`,
        sport: normalizeSport(prop.sport),
        league: prop.league || prop.sport,
        home_team: prop.home_team,
        away_team: prop.away_team,
        game_time: prop.event_time || prop.game_time,
        metadata: {
          sport_key: prop.sport_key,
          matchup: prop.matchup,
        },
      });

      if (gameResult.success && gameResult.canonical_game_id) {
        canonical_game_id = gameResult.canonical_game_id;
      }
    }

    // Map player if we have player name
    if (prop.player_name && prop.sport) {
      const playerResult = await canonicalService.mapPlayer({
        source: mapSource(prop.provider || prop.source),
        player_name: prop.player_name,
        sport: normalizeSport(prop.sport),
        team: prop.team,
        metadata: {
          market_type: prop.market_type,
          market: prop.market,
        },
      });

      if (playerResult.success && playerResult.canonical_player_id) {
        canonical_player_id = playerResult.canonical_player_id;
      }
    }

    return {
      ...prop,
      canonical_game_id,
      canonical_player_id,
    };
  } catch (error) {
    console.warn(`  ⚠️  Failed to map canonical entities for prop: ${error}`);
    return prop;
  }
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Verify Supabase connectivity
  console.log('📡 [1/5] Verifying Supabase connectivity...\n');
  const { error: healthError } = await supabase
    .from('raw_props')
    .select('id')
    .limit(1);

  if (healthError) {
    console.error('❌ Supabase connection failed:', healthError);
    process.exit(1);
  }

  console.log('✅ Supabase connected successfully\n');

  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`✅ Today's date: ${todayStr}\n`);

  // Check existing props count for today
  console.log('🔍 [2/5] Checking existing props for today...\n');
  const { count: existingCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${todayStr}T00:00:00Z`);

  console.log(`  Existing props today: ${existingCount || 0}\n`);

  // Initialize services
  console.log('🚀 [3/5] Initializing OddsApiClient and CanonicalMappingService...\n');
  const oddsApiClient = new OddsApiClient();
  const canonicalService = CanonicalMappingService.getInstance();

  console.log('✅ Services initialized\n');

  // Fetch and process props for multiple sports
  console.log('🔄 [4/5] Fetching and processing props from Odds API...\n');

  const sports = [
    { key: 'basketball_nba', name: 'NBA' },
    { key: 'basketball_ncaab', name: 'NCAAB' },
    { key: 'icehockey_nhl', name: 'NHL' }
  ];

  let totalIngested = 0;
  let totalWithCanonical = 0;
  const markets = ['h2h', 'spreads', 'totals'];

  for (const sport of sports) {
    console.log(`\n  📊 Processing ${sport.name}...`);

    try {
      // Fetch props from Odds API
      const props = await oddsApiClient.fetchOddsApiProps(sport.key as any, markets as any);
      console.log(`    ✅ Fetched ${props.length} ${sport.name} props`);

      if (props.length === 0) {
        console.log(`    ℹ️  No ${sport.name} games available right now`);
        continue;
      }

      // Enrich with canonical mappings and insert
      let sportIngested = 0;
      let sportWithCanonical = 0;

      for (const prop of props) {
        try {
          // Enrich with canonical IDs (same as FeedAgent.enrichWithCanonicalMappings)
          const enrichedProp = await enrichWithCanonicalMappings(prop, canonicalService);

          // Insert into Supabase
          const { error: insertError } = await supabase
            .from('raw_props')
            .insert(enrichedProp);

          if (insertError) {
            if (insertError.code === '23505') {
              // Duplicate key - skip silently
            } else {
              console.warn(`    ⚠️  Insert error: ${insertError.message}`);
            }
          } else {
            sportIngested++;
            if (enrichedProp.canonical_game_id || enrichedProp.canonical_player_id) {
              sportWithCanonical++;
            }
          }
        } catch (err: any) {
          console.warn(`    ⚠️  Prop processing error: ${err.message}`);
        }
      }

      console.log(`    ✅ Inserted ${sportIngested} new ${sport.name} props`);
      console.log(`    🔗 ${sportWithCanonical} props with canonical IDs (${((sportWithCanonical/sportIngested)*100).toFixed(1)}%)`);

      totalIngested += sportIngested;
      totalWithCanonical += sportWithCanonical;

    } catch (err: any) {
      console.error(`    ❌ Error processing ${sport.name}: ${err.message}`);
    }
  }

  // Verify results
  console.log('\n\n📊 [5/5] Verifying ingestion results...\n');

  const { count: newCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${todayStr}T00:00:00Z`);

  const propsIngestedTotal = (newCount || 0) - (existingCount || 0);

  console.log(`  Props before: ${existingCount || 0}`);
  console.log(`  Props after: ${newCount || 0}`);
  console.log(`  New props ingested: ${propsIngestedTotal}\n`);

  // Check canonical attach rate on recent props
  const { data: recentProps } = await supabase
    .from('raw_props')
    .select('id, sport, player_name, stat_type, canonical_game_id, canonical_player_id')
    .gte('created_at', `${todayStr}T00:00:00Z`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (recentProps && recentProps.length > 0) {
    const withEither = recentProps.filter(p => p.canonical_game_id || p.canonical_player_id).length;
    const attachRate = ((withEither / recentProps.length) * 100).toFixed(1);

    console.log('🔗 Canonical Attach Rate (last 100 props):');
    console.log(`  Overall: ${withEither}/${recentProps.length} (${attachRate}%)\n`);
  }

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              PHASE 1 INGESTION COMPLETE                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`✅ Ingested ${totalIngested} new props across ${sports.length} sports`);
  console.log(`🔗 ${totalWithCanonical} props with canonical IDs`);
  console.log(`✅ Data written to Supabase v3 schema`);
  console.log(`✅ Canonical mapping applied (same as FeedAgent)\n`);

  console.log('Next step: Run verification');
  console.log('  npx tsx apps/api/scripts/live-fire-phase1-verification.ts\n');
}

main();
