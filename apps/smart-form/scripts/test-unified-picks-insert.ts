/**
 * Test script to diagnose unified_picks insert failure
 * Run with: npx tsx scripts/test-unified-picks-insert.ts
 */
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

async function testInsert() {
  console.log('=== Testing unified_picks insert ===\n');
  console.log('Supabase URL:', process.env.SUPABASE_URL ? 'configured' : 'missing');

  // First, get a valid capper_id
  const { data: capper, error: capperError } = await supabase
    .from('users')
    .select('id, username, tier, capper_tier')
    .eq('username', 'Griff843')
    .single();

  if (capperError || !capper) {
    console.error('Failed to find capper Griff843:', capperError?.message);
    return;
  }

  console.log('Found capper:', capper.username, 'ID:', capper.id);
  console.log('Raw capper tier:', capper.capper_tier, '| tier:', capper.tier);

  // TIER-FIX-002: Map capper tier names to valid unified_picks tier codes
  const mapToTierCode = (tierName: string | null | undefined): string => {
    if (!tierName) return 'C';
    const normalized = tierName.toLowerCase().trim();
    const tierMap: Record<string, string> = {
      'platinum': 'S', 's': 'S', 'elite': 'S', 'diamond': 'S',
      'gold': 'A', 'a': 'A', 'premium': 'A',
      'silver': 'B', 'b': 'B', 'pro': 'B',
      'bronze': 'C', 'c': 'C', 'standard': 'C',
      'basic': 'D', 'd': 'D', 'free': 'D',
    };
    return tierMap[normalized] || 'C';
  };

  const rawTier = capper.capper_tier || capper.tier || 'C';
  const mappedTier = mapToTierCode(rawTier);
  console.log('Mapped tier:', rawTier, '→', mappedTier);

  // Test data matching what the frontend sends
  const betSlipId = uuidv4();
  const pickData = {
    bet_slip_id: betSlipId,
    user_id: capper.id,
    // capper_id: capper.id, // DISABLED: FK references deprecated table
    sport: 'NBA',
    stat_type: 'spread',
    line: -3.5,
    odds: -110,
    selection: 'Los Angeles Lakers -3.5',
    confidence: 7,
    tier: mappedTier,
    workflow_stage: 'approved',
    bet_line: -3.5,
    bet_odds: -110,
    bet_timestamp: new Date().toISOString(),
    source: 'manual',
    is_live: false,
    meta: {
      pick_origin: 'capper',
      capper: capper.username,
      capper_name: capper.username,
      capper_username: capper.username,
      capper_tier: capper.capper_tier || capper.tier || 'C',
      team_slug: 'team_nba_los_angeles_lakers',
    },
    manual_matchup_home: 'Los Angeles Lakers',
    manual_matchup_away: 'Boston Celtics',
    manual_game_date: '2026-02-11',
    manual_fields_blob: {
      entered_at: new Date().toISOString(),
      matchup: 'Boston Celtics @ Los Angeles Lakers',
    },
  };

  console.log('\nAttempting insert with data:');
  console.log(JSON.stringify(pickData, null, 2));

  const { data: inserted, error: insertError } = await supabase
    .from('unified_picks')
    .insert(pickData)
    .select()
    .single();

  if (insertError) {
    console.error('\n❌ INSERT FAILED:');
    console.error('Error code:', insertError.code);
    console.error('Error message:', insertError.message);
    console.error('Error details:', insertError.details);
    console.error('Error hint:', insertError.hint);

    // Try to identify which column is causing the issue
    console.log('\n=== Checking table schema ===');
    const { data: columns } = await supabase.rpc('get_table_columns', { table_name: 'unified_picks' }).catch(() => ({ data: null }));
    if (columns) {
      console.log('Columns:', columns);
    }
  } else {
    console.log('\n✅ INSERT SUCCEEDED:');
    console.log('Pick ID:', inserted.id);

    // Clean up test data
    await supabase.from('unified_picks').delete().eq('id', inserted.id);
    console.log('Test pick cleaned up');
  }
}

testInsert().catch(console.error);
