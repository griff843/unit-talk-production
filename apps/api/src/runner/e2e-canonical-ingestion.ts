/**
 * E2E Canonical Ingestion Runner
 *
 * Fetch a small batch of live props from the unified data router
 * and insert them into the raw_props table for downstream
 * professional grading and canonical pick generation.
 *
 * This script is intentionally conservative with volume and
 * credits to keep the real-world E2E pipeline fast and cheap.
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

import { fetchUnifiedData } from '../agents/FeedAgent/dataSourceRouter';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'WNBA'];

  let collected: any[] = [];
  let usedSource = 'unknown';

  console.log('🚀 [E2E] Starting real-world prop ingestion into raw_props');

  for (const sport of sports) {
    if (collected.length >= 75) break;

    console.log(`\n📡 [E2E] Fetching live props for ${sport}...`);

    try {
      const result = await fetchUnifiedData({
        sport,
        marketType: 'player-props',
        date: today
      });

      if (!result.data.length) {
        console.log(`⚠️ [E2E] No props returned for ${sport} (${result.source})`);
        continue;
      }

      const withOdds = result.data.filter((prop: any) =>
        prop.over_odds &&
        prop.under_odds &&
        prop.over_odds !== 0 &&
        prop.under_odds !== 0
      );

      console.log(
        `   [E2E] ${withOdds.length}/${result.data.length} props have usable odds from ${result.source}`
      );

      if (!withOdds.length) continue;

      collected = collected.concat(withOdds);
      usedSource = result.source;

      if (collected.length >= 75) break;
    } catch (error: any) {
      console.error(
        `❌ [E2E] Failed to fetch props for ${sport}:`,
        error?.message || error
      );
    }
  }

  if (!collected.length) {
    console.error('❌ [E2E] No valid props fetched from any sport – aborting');
    process.exit(1);
  }

  const maxProps = 75;
  const propsToUse = collected.slice(0, maxProps);
  const nowIso = new Date().toISOString();

  console.log(
    `\n💾 [E2E] Inserting ${propsToUse.length} props from source=${usedSource} into raw_props...`
  );

  const rows = propsToUse.map((prop: any) => ({
    id: randomUUID(),
    external_game_id: prop.external_game_id ?? null,
    game_id: null,
    player_name: prop.player_name ?? null,
    team: prop.team ?? null,
    stat_type: prop.stat_type ?? null,
    line: prop.line ?? 0,
    over_odds: prop.over_odds ?? null,
    under_odds: prop.under_odds ?? null,
    provider: 'E2E-Production-Pipeline',
    game_time: prop.game_time || nowIso,
    scraped_at: nowIso,
    created_at: nowIso,
    game_date: prop.game_date || today,
    sport: prop.sport || null,
    sport_key: prop.sport_key || null,
    matchup: prop.matchup || null,
    opponent: prop.opponent || null,
    source: 'e2e-production-pipeline',

    // Scoring / promotion defaults – these will be filled in by
    // the ProfessionalPropProcessor + Grading system
    outcome: null,
    odds: 0,
    trend_confidence: 0,
    matchup_quality: 0,
    line_value_score: 0,
    role_stability: 0,
    confidence_score: 0,
    edge_score: 0,
    tier_tag: null,
    auto_approved: false,
    context_flag: false,
    promoted_to_picks: false,
    promoted_at: null,
    promoted: false,
    is_promoted: false
  }));

  const { data, error } = await supabase
    .from('raw_props')
    .insert(rows)
    .select('id');

  if (error) {
    console.error('❌ [E2E] Failed to insert props into raw_props:', error.message);
    process.exit(1);
  }

  console.log(
    `✅ [E2E] Inserted ${data?.length ?? 0} props into raw_props for ${today}`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ [E2E] Unexpected error during ingestion:', error);
  process.exit(1);
});

