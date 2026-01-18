/**
 * Create Valid CANARY Pick
 *
 * Creates a production-faithful CANARY pick from real, current game data
 *
 * Requirements:
 * - Real game (future or live, not stale)
 * - Real odds from raw_props
 * - Units ≤ 5 (business rule)
 * - Valid bet type
 * - Complete metadata
 *
 * Usage:
 *   npx tsx apps/api/scripts/create-canary-pick.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000001';
const CANARY_CHANNEL_ID = process.env.DISCORD_CANARY_CHANNEL_ID || '1296531122234327100';

interface RawProp {
  id: string;
  player_name: string;
  stat_type: string;
  line: number;
  over_odds: number;
  under_odds: number;
  sport: string;
  game_time: string;
  home_team?: string;
  away_team?: string;
  book?: string;
  created_at: string;
}

async function findValidGameProp(): Promise<RawProp | null> {
  console.log('🔍 Searching for valid game prop...\n');

  const now = new Date().toISOString();

  // Find props for future games (not stale)
  const { data: props, error } = await supabase
    .from('raw_props')
    .select('*')
    .gte('game_time', now)
    .in('sport', ['NFL', 'NBA'])
    .not('player_name', 'is', null)
    .not('stat_type', 'is', null)
    .not('line', 'is', null)
    .not('over_odds', 'is', null)
    .order('game_time', { ascending: true })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching props:', error.message);
    return null;
  }

  if (!props || props.length === 0) {
    console.log('⚠️  No future game props found');
    console.log('   Trying to find any props from last 24 hours...\n');

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentProps, error: recentError } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', yesterday)
      .in('sport', ['NFL', 'NBA'])
      .not('player_name', 'is', null)
      .not('stat_type', 'is', null)
      .not('line', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError || !recentProps || recentProps.length === 0) {
      return null;
    }

    return recentProps[0] as RawProp;
  }

  return props[0] as RawProp;
}

async function createCanaryPick(prop: RawProp): Promise<{ pickId: string; publishId: string }> {
  console.log('📝 Creating CANARY pick from prop...\n');

  // Pick Over or Under randomly
  const isOver = Math.random() > 0.5;
  const selection = isOver ? 'Over' : 'Under';
  const odds = isOver ? prop.over_odds : prop.under_odds;

  // Generate units (1-5, respecting max 5 rule)
  const units = Math.floor(Math.random() * 3) + 1; // 1-3 units for safety

  // Generate confidence (65-85 range for realistic values)
  const confidence = Math.floor(Math.random() * 20) + 65;

  const matchup = prop.home_team && prop.away_team
    ? `${prop.away_team} @ ${prop.home_team}`
    : 'Matchup TBD';

  console.log('Pick Details:');
  console.log(`   Player: ${prop.player_name}`);
  console.log(`   Stat: ${prop.stat_type}`);
  console.log(`   Line: ${prop.line}`);
  console.log(`   Selection: ${selection}`);
  console.log(`   Odds: ${odds}`);
  console.log(`   Units: ${units}`);
  console.log(`   Confidence: ${confidence}%`);
  console.log(`   Matchup: ${matchup}`);
  console.log(`   Game Time: ${new Date(prop.game_time).toLocaleString()}\n`);

  // 1. Create pick in picks table
  const { data: pick, error: pickError } = await supabase
    .from('picks')
    .insert({
      tenant_id: DEFAULT_TENANT_ID,
      user_id: SYSTEM_USER_ID,
      sport: prop.sport,
      league: prop.sport,
      market_type: prop.stat_type,
      selection: `${prop.player_name} ${selection} ${prop.line}`,
      line: prop.line,
      odds: odds,
      stake: units,
      confidence: confidence,
      status: 'pending',
      bet_type: 'player_prop',
      player_name: prop.player_name,
      matchup: matchup,
      game_time: prop.game_time,
      book: prop.book || 'DraftKings',
      metadata: {
        source: 'canary_test',
        raw_prop_id: prop.id,
        stat_type: prop.stat_type,
        over_odds: prop.over_odds,
        under_odds: prop.under_odds,
        created_by: 'create-canary-pick script',
        created_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (pickError) {
    throw new Error(`Failed to create pick: ${pickError.message}`);
  }

  console.log(`✅ Pick created: ${pick.id}\n`);

  // 2. Create pick_publish outbox record for CANARY
  const { data: publishRecord, error: publishError } = await supabase
    .from('pick_publish')
    .insert({
      pick_id: pick.id,
      tenant_id: DEFAULT_TENANT_ID,
      channel: 'CANARY',
      discord_channel_id: CANARY_CHANNEL_ID,
      status: 'pending',
      message_type: 'new_pick',
      metadata: {
        player_name: prop.player_name,
        stat_type: prop.stat_type,
        line: prop.line,
        selection: selection,
        odds: odds,
        units: units,
        confidence: confidence,
        matchup: matchup,
        game_time: prop.game_time,
        source: 'canary_test',
        created_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (publishError) {
    throw new Error(`Failed to create publish record: ${publishError.message}`);
  }

  console.log(`✅ Publish record created: ${publishRecord.id}\n`);

  return {
    pickId: pick.id,
    publishId: publishRecord.id,
  };
}

async function main(): Promise<void> {
  console.log('🚀 CANARY Pick Creator\n');
  console.log('======================================\n');

  try {
    // 1. Find valid prop
    const prop = await findValidGameProp();

    if (!prop) {
      console.error('❌ No valid game props found');
      console.error('\nPossible issues:');
      console.error('   - No games scheduled in near future');
      console.error('   - raw_props table is empty');
      console.error('   - FeedAgent not ingesting data\n');
      console.error('Manual fix: Run FeedAgent to ingest props\n');
      process.exit(1);
    }

    console.log('✅ Found valid game prop:');
    console.log(`   Player: ${prop.player_name}`);
    console.log(`   Sport: ${prop.sport}`);
    console.log(`   Stat: ${prop.stat_type}`);
    console.log(`   Line: ${prop.line}`);
    console.log(`   Game Time: ${new Date(prop.game_time).toLocaleString()}\n`);

    // 2. Create CANARY pick
    const { pickId, publishId } = await createCanaryPick(prop);

    // 3. Verify creation
    console.log('🔍 Verifying creation...\n');

    const { data: verifyPublish, error: verifyError } = await supabase
      .from('pick_publish')
      .select('*')
      .eq('id', publishId)
      .single();

    if (verifyError || !verifyPublish) {
      throw new Error('Failed to verify publish record');
    }

    console.log('✅ Verification successful!\n');
    console.log('======================================\n');
    console.log('📋 CANARY Pick Summary:\n');
    console.log(`   Pick ID: ${pickId}`);
    console.log(`   Publish ID: ${publishId}`);
    console.log(`   Channel: ${verifyPublish.channel}`);
    console.log(`   Discord Channel ID: ${verifyPublish.discord_channel_id}`);
    console.log(`   Status: ${verifyPublish.status}`);
    console.log(`   Created: ${new Date(verifyPublish.created_at).toLocaleString()}\n`);

    console.log('Next Steps:');
    console.log('   1. Run OutboxPublisher to process the pending publish');
    console.log('   2. Check Discord CANARY channel for the message');
    console.log('   3. Verify SQL: SELECT * FROM pick_publish WHERE id = \'%s\';\n', publishId);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating CANARY pick:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
