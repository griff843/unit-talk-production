/**
 * Phase B: Select Raw Prop Candidate
 *
 * Finds a suitable raw_prop for CANARY pick creation test
 * Avoids SQL Editor timeouts by using indexed queries with limits
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment from repo root
config({ path: resolve(__dirname, '../.env.shared') });
config({ path: resolve(__dirname, '../.env'), override: true });
config({ path: resolve(__dirname, '../.env.canary'), override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RawPropCandidate {
  id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  selection: string;
  market: string;
  bet_type: string;
  line: number | null;
  odds: number | null;
  canonical_game_id: string | null;
  canonical_player_id: string | null;
  external_game_id: string | null;
  created_at: string;
  event_time: string | null;
}

async function selectCandidate(): Promise<void> {
  console.log('🔍 Searching for raw_prop candidate...\n');

  // Strategy 1: Best candidate with all canonical IDs
  console.log('Strategy 1: Canonical game + player IDs present');
  const thirtySevenHoursAgo = new Date(Date.now() - 37 * 60 * 60 * 1000).toISOString();

  let { data, error } = await supabase
    .from('raw_props')
    .select('id, sport, league, home_team, away_team, selection, market, bet_type, line, odds, canonical_game_id, canonical_player_id, external_game_id, created_at, event_time')
    .gte('created_at', thirtySevenHoursAgo)
    .not('canonical_game_id', 'is', null)
    .or('odds.not.is.null,line.not.is.null')
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) {
    console.error('❌ Query error:', error);
    process.exit(1);
  }

  if (data && data.length > 0) {
    console.log(`✅ Found ${data.length} candidates with canonical_game_id\n`);
    printBestCandidate(data as RawPropCandidate[], 'OPTIMAL');
    return;
  }

  // Strategy 2: Relax canonical_game_id but require external_game_id
  console.log('Strategy 2: External game ID present (canonical optional)');
  ({ data, error } = await supabase
    .from('raw_props')
    .select('id, sport, league, home_team, away_team, selection, market, bet_type, line, odds, canonical_game_id, canonical_player_id, external_game_id, created_at, event_time')
    .gte('created_at', thirtySevenHoursAgo)
    .not('external_game_id', 'is', null)
    .or('odds.not.is.null,line.not.is.null')
    .order('created_at', { ascending: false })
    .limit(25));

  if (error) {
    console.error('❌ Query error:', error);
    process.exit(1);
  }

  if (data && data.length > 0) {
    console.log(`✅ Found ${data.length} candidates with external_game_id\n`);
    printBestCandidate(data as RawPropCandidate[], 'GOOD');
    return;
  }

  // Strategy 3: Expand window to 7 days
  console.log('Strategy 3: Expanding time window to 7 days');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  ({ data, error } = await supabase
    .from('raw_props')
    .select('id, sport, league, home_team, away_team, selection, market, bet_type, line, odds, canonical_game_id, canonical_player_id, external_game_id, created_at, event_time')
    .gte('created_at', sevenDaysAgo)
    .or('odds.not.is.null,line.not.is.null')
    .order('created_at', { ascending: false })
    .limit(25));

  if (error) {
    console.error('❌ Query error:', error);
    process.exit(1);
  }

  if (data && data.length > 0) {
    console.log(`✅ Found ${data.length} candidates in 7-day window\n`);
    printBestCandidate(data as RawPropCandidate[], 'ACCEPTABLE');
    return;
  }

  // Strategy 4: Fallback to newest row regardless
  console.log('Strategy 4: Fallback to newest row');
  ({ data, error } = await supabase
    .from('raw_props')
    .select('id, sport, league, home_team, away_team, selection, market, bet_type, line, odds, canonical_game_id, canonical_player_id, external_game_id, created_at, event_time')
    .order('created_at', { ascending: false })
    .limit(1));

  if (error) {
    console.error('❌ Query error:', error);
    process.exit(1);
  }

  if (data && data.length > 0) {
    console.log('⚠️  Using newest row as degraded candidate\n');
    printBestCandidate(data as RawPropCandidate[], 'DEGRADED');
    return;
  }

  console.error('❌ No raw_props found in database');
  process.exit(1);
}

function printBestCandidate(candidates: RawPropCandidate[], quality: string): void {
  // Select best candidate: prefer those with both canonical IDs
  const best = candidates.find(c => c.canonical_game_id && c.canonical_player_id) || candidates[0];

  console.log('═'.repeat(80));
  console.log('🎯 SELECTED CANDIDATE');
  console.log('═'.repeat(80));
  console.log(`Quality: ${quality}`);
  console.log('');

  // Print sanitized but complete JSON
  const candidateInfo = {
    raw_prop_id: best.id,
    sport: best.sport,
    league: best.league,
    home_team: best.home_team,
    away_team: best.away_team,
    selection: best.selection,
    market: best.market,
    bet_type: best.bet_type,
    line: best.line,
    odds: best.odds,
    canonical_game_id: best.canonical_game_id,
    canonical_player_id: best.canonical_player_id,
    external_game_id: best.external_game_id,
    created_at: best.created_at,
    event_time: best.event_time,
    quality_score: quality
  };

  console.log('JSON OUTPUT:');
  console.log(JSON.stringify(candidateInfo, null, 2));
  console.log('');
  console.log('═'.repeat(80));

  // Print summary
  console.log('\n📊 CANDIDATE SUMMARY:');
  console.log(`  Sport/League: ${best.sport}/${best.league}`);
  console.log(`  Game: ${best.away_team} @ ${best.home_team}`);
  console.log(`  Market: ${best.market || best.bet_type}`);
  console.log(`  Selection: ${best.selection}`);
  console.log(`  Line/Odds: ${best.line || 'N/A'} @ ${best.odds || 'N/A'}`);
  console.log(`  Created: ${new Date(best.created_at).toLocaleString()}`);
  console.log(`  Canonical Game ID: ${best.canonical_game_id || '❌ NULL'}`);
  console.log(`  Canonical Player ID: ${best.canonical_player_id || '❌ NULL'}`);
  console.log(`  External Game ID: ${best.external_game_id || '❌ NULL'}`);
  console.log('');

  // Quality assessment
  const hasCanonicalGame = !!best.canonical_game_id;
  const hasCanonicalPlayer = !!best.canonical_player_id;
  const hasOdds = !!best.odds;
  const hasLine = !!best.line;
  const age = (Date.now() - new Date(best.created_at).getTime()) / (1000 * 60 * 60);

  console.log('✅ QUALITY CHECKLIST:');
  console.log(`  ${hasCanonicalGame ? '✅' : '❌'} Canonical Game ID`);
  console.log(`  ${hasCanonicalPlayer ? '✅' : '❌'} Canonical Player ID`);
  console.log(`  ${hasOdds ? '✅' : '❌'} Odds Available`);
  console.log(`  ${hasLine ? '✅' : '❌'} Line Available`);
  console.log(`  ${age < 36 ? '✅' : '⚠️'} Fresh (${age.toFixed(1)}h old)`);
  console.log('');

  if (quality === 'OPTIMAL') {
    console.log('✅ This candidate is OPTIMAL for pick creation');
  } else if (quality === 'GOOD') {
    console.log('⚠️  This candidate is GOOD but may need additional processing');
  } else if (quality === 'ACCEPTABLE') {
    console.log('⚠️  This candidate is ACCEPTABLE but may be stale');
  } else {
    console.log('⚠️  This candidate is DEGRADED - use with caution');
  }
}

// Run the selection
selectCandidate().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
