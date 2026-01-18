/**
 * CANARY E2E Smoke Test
 *
 * This script performs a complete end-to-end test of the CANARY publishing pipeline:
 * 1. Selects a recent raw_props candidate (indexed queries, avoids SQL timeouts)
 * 2. Creates an approved pick via proper API/RPC path
 * 3. Promotes to CANARY via ops endpoint
 * 4. Polls pick_publish until sent or timeout
 * 5. Prints final PASS/FAIL with IDs + DB fields
 *
 * Usage: npx tsx scripts/canary_e2e_smoke.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';
import { Pool } from 'pg';

// Load environment
config({ path: resolve(__dirname, '../.env.shared') });
config({ path: resolve(__dirname, '../.env'), override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unit_talk_dev';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3010';

const POLL_INTERVAL_MS = 2000;  // Poll every 2 seconds
const MAX_POLL_ATTEMPTS = 30;   // Timeout after 60 seconds

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Supabase client for picks and pick_publish (cloud)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Postgres client for raw_props (local database)
const pgPool = new Pool({ connectionString: DATABASE_URL });

interface RawProp {
  id: string;
  sport: string;
  league: string;
  home_team: string | null;
  away_team: string | null;
  selection: string | null;
  player_name: string | null;
  team: string | null;
  market: string | null;
  bet_type: string | null;
  stat_type: string | null;
  line: number | null;
  over_odds: number | null;
  under_odds: number | null;
  external_game_id: string | null;
  event_time: string | null;
  game_time: string | null;
  start_time: string | null;
  game_date: string | null;
  matchup: string | null;
  metadata: any | null; // JSONB field containing tier, scores, canonical IDs, etc.
}

async function selectRawPropsCandidate(): Promise<RawProp> {
  console.log('📊 PHASE C: Selecting raw_props candidate (UPCOMING GAMES ONLY)...\n');

  // Calculate time window for UPCOMING/LIVE games (production-faithful)
  // event_ts = event_time (timestamptz)
  // Filter: event_time >= now() AND event_time <= now() + 48 hours
  const now = new Date();
  const fortyEightHoursAhead = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  console.log(`   Time window (UPCOMING ONLY):`);
  console.log(`   - Start: ${now.toISOString()} (now)`);
  console.log(`   - End:   ${fortyEightHoursAhead.toISOString()} (48 hours ahead)\n`);
  console.log(`   Querying LOCAL POSTGRES for raw_props...\n`);

  // Query local postgres for UPCOMING games
  const result = await pgPool.query(`
    SELECT
      id, sport, league, home_team, away_team, selection, player_name, team,
      market, bet_type, stat_type, line, over_odds, under_odds,
      external_game_id, event_time, game_time, start_time, game_date,
      matchup, metadata
    FROM raw_props
    WHERE event_time IS NOT NULL
      AND event_time >= NOW()
      AND event_time <= NOW() + INTERVAL '48 hours'
    ORDER BY event_time ASC
    LIMIT 500
  `);

  const data = result.rows;

  console.log(`   Query returned ${data?.length || 0} rows total`);

  if (!data || data.length === 0) {
    console.error('❌ No upcoming raw_props found in local postgres');
    throw new Error('No raw_props available');
  }

  // SQL query already filtered for upcoming events, now apply production filters
  console.log(`   Found ${data.length} upcoming props in next 48h`);
  console.log(`   Applying production filters...\n`);

  // Filter for PRODUCTION-FAITHFUL test data (strict requirements)
  const afterRule1 = data.filter((row: any) => {
    const hasValidOdds =
      (row.over_odds && row.over_odds !== 0 && Math.abs(row.over_odds) >= 100 && Math.abs(row.over_odds) <= 10000) ||
      (row.under_odds && row.under_odds !== 0 && Math.abs(row.under_odds) >= 100 && Math.abs(row.under_odds) <= 10000);
    return hasValidOdds;
  });
  console.log(`   After RULE 1 (valid odds): ${afterRule1.length} candidates`);

  const afterRule2 = afterRule1.filter((row: any) => row.player_name);
  console.log(`   After RULE 2 (player_name): ${afterRule2.length} candidates`);

  const afterRule3 = afterRule2.filter((row: any) => row.stat_type);
  console.log(`   After RULE 3 (stat_type): ${afterRule3.length} candidates`);

  const candidates = afterRule3
    .filter((row: any) => {
      // RULE 4: Confidence >= 7 (if present in metadata, on 0-10 or 0-100 scale)
      let confidence = row.metadata?.confidence_score || row.metadata?.confidence;
      if (!confidence) return true;
      // Convert to 0-10 scale if needed
      if (confidence > 10) confidence = Math.round(confidence / 10);
      else confidence = Math.round(confidence);
      return confidence >= 7;
    })
    .sort((a: any, b: any) => {
      // Sort by event time ascending (soonest games first)
      const aTime = new Date(a.event_time || a.start_time || 0).getTime();
      const bTime = new Date(b.event_time || b.start_time || 0).getTime();
      return aTime - bTime;
    });

  console.log(`   After RULE 4 (confidence >= 65): ${candidates.length} candidates\n`);

  if (candidates.length === 0) {
    console.error('❌ No suitable raw_props found after production filtering');
    console.error(`   Checked ${data.length} upcoming props`);
    console.error(`   Filters applied: valid odds, complete matchup, selection info, confidence >=65, event time validation`);
    console.error(`\n   Possible reasons:`);
    console.error(`   - No upcoming games in the next 48 hours`);
    console.error(`   - Games lack complete metadata (matchup, player_name, etc.)`);
    console.error(`   - Confidence scores below 65 threshold`);
    throw new Error('No suitable raw_props candidates available - ensure FeedAgent is running and populating upcoming games');
  }

  const candidate = candidates[0] as RawProp;
  const eventTime = candidate.event_time || candidate.game_time || candidate.start_time;

  console.log('✅ Selected raw_props candidate:');
  console.log(`   ID: ${candidate.id}`);
  console.log(`   Sport/League: ${candidate.sport} / ${candidate.league}`);
  console.log(`   Matchup: ${candidate.matchup || `${candidate.away_team} @ ${candidate.home_team}`}`);
  console.log(`   Game Date: ${candidate.game_date}`);
  console.log(`   Event Time: ${eventTime}`);
  console.log(`   Selection: ${candidate.selection || candidate.player_name || candidate.team}`);
  console.log(`   Bet Type: ${candidate.bet_type || candidate.stat_type}`);
  console.log(`   Line: ${candidate.line}`);
  console.log(`   Over Odds: ${candidate.over_odds || 'N/A'}, Under Odds: ${candidate.under_odds || 'N/A'}`);
  console.log(`   Book: ${candidate.metadata?.book || candidate.metadata?.bookmaker || 'N/A'}`);
  console.log(`   Tier: ${candidate.metadata?.tier || 'N/A'}`);
  console.log(`   Professional Score: ${candidate.metadata?.professional_score ?? 'N/A'}`);
  console.log(`   Edge Score: ${candidate.metadata?.edge_score ?? 'N/A'}`);
  console.log(`   Confidence Score: ${(candidate.metadata?.confidence_score || candidate.metadata?.confidence) ?? 'N/A'}`);
  console.log(`   Canonical Game ID: ${candidate.metadata?.canonical_game_id || candidate.external_game_id}`);
  console.log();

  return candidate;
}

async function createApprovedPick(rawProp: RawProp): Promise<string> {
  console.log('📝 PHASE C: Creating approved pick...\n');

  // Get a valid user/tenant from existing picks
  const { data: existingPick } = await supabase
    .from('picks')
    .select('user_id, tenant_id')
    .eq('workflow_stage', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const userId = existingPick?.user_id || '012602a5-52e8-457e-838e-45f0f43edfc3';
  const tenantId = existingPick?.tenant_id || '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';

  const correlationId = `canary-e2e-${Date.now()}`;

  // Derive selection from raw_prop data
  const selection = rawProp.selection || rawProp.player_name || rawProp.team || rawProp.away_team || 'Unknown';

  // Determine odds from over_odds/under_odds based on stat_type and selection
  let finalOdds: number;
  const statType = (rawProp.stat_type || '').toLowerCase();
  const selectionLower = selection.toLowerCase();

  // Logic: For moneyline/spread, prefer under_odds unless explicitly "over"
  // For totals, use over_odds if selection is "Over", under_odds if selection is "Under"
  if (selectionLower.includes('over') || statType === 'total' && selectionLower === 'over') {
    finalOdds = rawProp.over_odds || rawProp.under_odds || -110;
  } else {
    finalOdds = rawProp.under_odds || rawProp.over_odds || -110;
  }

  // Cap stake to max 5 units (business rule - MANDATORY)
  const professionalScore = rawProp.metadata?.professional_score;
  const stake = Math.min(5, professionalScore ? Math.ceil(professionalScore / 20) : 3);

  // Derive confidence (0-10 scale, INTEGER) from confidence_score in metadata
  // ENFORCE MINIMUM: confidence >= 7 (70% on 0-100 scale)
  let confidence = rawProp.metadata?.confidence_score || rawProp.metadata?.confidence || 8;

  // If confidence is on 0-100 scale, convert to 0-10
  if (confidence > 10) {
    confidence = Math.round(confidence / 10);
  } else {
    confidence = Math.round(confidence);
  }

  if (confidence < 7) {
    console.log(`   ⚠️  Confidence ${confidence} below minimum 7, using 7 instead`);
    confidence = 7;
  }

  // Ensure confidence is within 0-10 range for database constraint (integer)
  confidence = Math.max(0, Math.min(10, Math.round(confidence)));

  // Build metadata with tier/scores if present
  const metadata: any = {
    raw_prop_id: rawProp.id,
    sport: rawProp.sport,
    league: rawProp.league,
    home_team: rawProp.home_team || 'Unknown',
    away_team: rawProp.away_team || 'Unknown',
    game: rawProp.matchup || `${rawProp.away_team || 'Unknown'} @ ${rawProp.home_team || 'Unknown'}`,
    matchup: rawProp.matchup || `${rawProp.away_team || 'Unknown'} @ ${rawProp.home_team || 'Unknown'}`,
    market: rawProp.market || 'Unknown',
    bet_type: rawProp.bet_type || rawProp.stat_type || 'moneyline',
    line: rawProp.line ?? 0,
    book: rawProp.metadata?.book || rawProp.metadata?.bookmaker || 'Unknown',
    canonical_game_id: rawProp.metadata?.canonical_game_id,
    canonical_player_id: rawProp.metadata?.canonical_player_id,
    external_game_id: rawProp.external_game_id,
    game_date: rawProp.game_date,
    event_time: rawProp.event_time || rawProp.game_time || rawProp.start_time,
    source: 'CANARY_E2E_SMOKE_TEST',
    correlation_id: correlationId,
    test_timestamp: new Date().toISOString()
  };

  // Include tier + scores if present in metadata (do NOT fabricate)
  if (rawProp.metadata?.tier) {
    metadata.tier = rawProp.metadata.tier;
  }
  if (rawProp.metadata?.professional_score !== null && rawProp.metadata?.professional_score !== undefined) {
    metadata.professional_score = rawProp.metadata.professional_score;
  }
  if (rawProp.metadata?.edge_score !== null && rawProp.metadata?.edge_score !== undefined) {
    metadata.edge_score = rawProp.metadata.edge_score;
  }
  if (rawProp.metadata?.confidence_score !== null && rawProp.metadata?.confidence_score !== undefined) {
    metadata.confidence_score = rawProp.metadata.confidence_score;
  }
  if (rawProp.metadata?.line_score !== null && rawProp.metadata?.line_score !== undefined) {
    metadata.line_score = rawProp.metadata.line_score;
  }

  const pickRecord = {
    tenant_id: tenantId,
    user_id: userId,
    prop_id: null,  // raw_props.id !== props.id
    selection,
    odds: finalOdds,
    stake,
    confidence,
    workflow_stage: 'approved',
    status: 'pending',
    idempotency_key: correlationId,
    metadata
  };

  console.log('   Creating pick with:');
  console.log(`   - Selection: ${selection}`);
  console.log(`   - Odds: ${finalOdds}`);
  console.log(`   - Stake: ${stake} units (capped at 5 max)`);
  console.log(`   - Confidence: ${confidence}/10`);
  console.log(`   - Tier: ${metadata.tier || 'N/A'}`);
  console.log(`   - Professional Score: ${metadata.professional_score ?? 'N/A'}`);
  console.log(`   - Edge Score: ${metadata.edge_score ?? 'N/A'}`);
  console.log(`   - Book: ${metadata.book}`);
  console.log();

  const { data: newPick, error } = await supabase
    .from('picks')
    .insert(pickRecord)
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to create pick:', error);
    throw error;
  }

  console.log('✅ Pick created successfully:');
  console.log(`   Pick ID: ${newPick.id}`);
  console.log(`   Selection: ${newPick.selection}`);
  console.log(`   Odds: ${newPick.odds}`);
  console.log(`   Stake: ${newPick.stake} units`);
  console.log(`   Confidence: ${newPick.confidence}/10`);
  console.log(`   Workflow Stage: ${newPick.workflow_stage}`);
  console.log();

  return newPick.id;
}

async function promoteToCanary(pickId: string): Promise<string> {
  console.log('🚀 PHASE D: Promoting pick to CANARY...\n');

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/ops/picks/${pickId}/promote`,
      { channel: 'CANARY' },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-e2e-test': 'true'  // Bypass auth for E2E tests
        }
      }
    );

    if (response.status !== 200) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const result = response.data;
    console.log('✅ Promotion API response:');
    console.log(JSON.stringify(result, null, 2));
    console.log();

    if (!result.publishId) {
      throw new Error('API response missing publishId');
    }

    return result.publishId;
  } catch (error: any) {
    console.error('❌ Promotion failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
    throw error;
  }
}

async function pollUntilSent(publishId: string): Promise<any> {
  console.log('⏳ PHASE E: Polling pick_publish until sent...\n');
  console.log(`   Publish ID: ${publishId}`);
  console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`   Max attempts: ${MAX_POLL_ATTEMPTS}\n`);

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from('pick_publish')
      .select('*')
      .eq('id', publishId)
      .single();

    if (error) {
      console.error(`❌ Error fetching pick_publish on attempt ${attempt}:`, error);
      throw error;
    }

    console.log(`[Attempt ${attempt}/${MAX_POLL_ATTEMPTS}] Status: ${data.status}, Attempts: ${data.attempts}, External ID: ${data.external_message_id || 'null'}`);

    if (data.status === 'sent') {
      console.log('\n✅ Pick successfully sent!');
      return data;
    }

    if (data.status === 'failed') {
      console.error('\n❌ Pick failed to send');
      console.error('   Last error:', data.last_error);
      throw new Error(`Publishing failed: ${data.last_error}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timeout: pick_publish status did not reach 'sent' after ${MAX_POLL_ATTEMPTS} attempts`);
}

async function main(): Promise<void> {
  console.log('═'.repeat(80));
  console.log('🧪 CANARY E2E SMOKE TEST');
  console.log('═'.repeat(80));
  console.log();

  const startTime = Date.now();
  let pickId: string | null = null;
  let publishId: string | null = null;
  let finalRecord: any = null;

  try {
    // Phase A: Fail-fast health check
    console.log('🏥 PHASE A: Checking API health...\n');
    try {
      const healthResponse = await axios.get(`${API_BASE_URL}/api/health`);
      const health = healthResponse.data;

      console.log(`   API Status: ${health.status || 'unknown'}`);
      console.log(`   Publisher Enabled: ${health.publisher?.enabled}`);
      console.log(`   Publisher Running: ${health.publisher?.running}`);
      console.log(`   Publisher Mode: ${health.publisher?.mode}`);
      console.log();

      if (health.publisher?.running !== true) {
        throw new Error(
          'HARD FAIL: publisher.running=false\n' +
          '   This indicates the outbox publisher loop is not active.\n' +
          '   The API cannot process pick_publish jobs in this state.\n' +
          '   Fix: Restart API with proper publisher initialization.\n' +
          '   See: apps/api/src/api-server.ts startPublisherLoop() call'
        );
      }

      console.log('✅ Publisher health check passed\n');
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`API not running at ${API_BASE_URL}`);
      }
      throw error;
    }

    // Phase C: Select raw_props and create pick
    const rawProp = await selectRawPropsCandidate();
    pickId = await createApprovedPick(rawProp);

    // Phase D: Promote to CANARY
    publishId = await promoteToCanary(pickId);

    // Phase E: Poll until sent
    finalRecord = await pollUntilSent(publishId);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log();
    console.log('═'.repeat(80));
    console.log('✅ TEST RESULT: PASS');
    console.log('═'.repeat(80));
    console.log();
    console.log('📊 Summary:');
    console.log(`   Pick ID: ${pickId}`);
    console.log(`   Publish ID: ${publishId}`);
    console.log(`   Channel: ${finalRecord.channel}`);
    console.log(`   Discord Channel ID: ${finalRecord.discord_channel_id}`);
    console.log(`   External Message ID: ${finalRecord.external_message_id}`);
    console.log(`   Status: ${finalRecord.status}`);
    console.log(`   Attempts: ${finalRecord.attempts}`);
    console.log(`   Duration: ${duration}s`);
    console.log();
    console.log('🎯 Discord Message Details:');
    console.log(`   Channel: ${finalRecord.discord_channel_id} (CANARY)`);
    console.log(`   Message ID: ${finalRecord.external_message_id}`);
    console.log();

    await pgPool.end();
    process.exit(0);
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log();
    console.log('═'.repeat(80));
    console.log('❌ TEST RESULT: FAIL');
    console.log('═'.repeat(80));
    console.log();
    console.log('📊 Summary:');
    console.log(`   Pick ID: ${pickId || 'N/A'}`);
    console.log(`   Publish ID: ${publishId || 'N/A'}`);
    console.log(`   Error: ${error.message}`);
    console.log(`   Duration: ${duration}s`);
    console.log();
    console.error('Stack trace:', error.stack);

    await pgPool.end();
    process.exit(1);
  }
}

main();
