/**
 * Simple FeedAgent Test - Check if we can get NFL props
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testFeedSimple() {
  console.log('🧪 SIMPLE FEEDAGENT TEST');
  console.log('='.repeat(60));

  // Import dataSourceRouter
  const { fetchUnifiedData } = await import('./apps/api/src/agents/FeedAgent/dataSourceRouter');

  console.log('\n1. Testing NFL props fetch...');
  const nflResult = await fetchUnifiedData({
    sport: 'NFL',
    marketType: 'player-props',
    date: new Date().toISOString().split('T')[0]
  });

  console.log(`   Source: ${nflResult.source}`);
  console.log(`   Records: ${nflResult.data.length}`);
  console.log(`   Time: ${nflResult.metadata.responseTime}ms`);

  if (nflResult.data.length > 0) {
    console.log(`\n   Sample prop:`);
    const sample = nflResult.data[0];
    console.log(`   - Player: ${sample.player_name}`);
    console.log(`   - Stat: ${sample.stat_type}`);
    console.log(`   - Line: ${sample.line}`);
    console.log(`   - Odds: ${sample.over_odds} / ${sample.under_odds}`);

    // Try to insert into raw_props
    console.log('\n2. Testing database insert...');
    const { randomUUID } = await import('crypto');

    const testProp = {
      id: randomUUID(),
      sport: sample.sport,
      player_name: sample.player_name,
      prop_type: sample.stat_type,
      line: sample.line,
      over_odds: sample.over_odds,
      under_odds: sample.under_odds,
      provider: 'test',
      game_time: sample.game_time || new Date().toISOString(),
      created_at: new Date().toISOString(),
      external_game_id: sample.external_game_id,
      source: 'feed-test'
    };

    const { data: inserted, error } = await supabase
      .from('raw_props')
      .insert(testProp)
      .select();

    if (error) {
      console.log(`   ❌ Insert failed: ${error.message}`);
      console.log(`   Details: ${JSON.stringify(error, null, 2)}`);
    } else {
      console.log(`   ✅ Successfully inserted to raw_props`);

      // Verify it's there
      const { count } = await supabase
        .from('raw_props')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'feed-test');

      console.log(`   ✅ Verified: ${count} props with source=feed-test`);
    }
  } else {
    console.log('   ⚠️  No props returned - trying NCAAF...');

    const ncaafResult = await fetchUnifiedData({
      sport: 'NCAAF',
      marketType: 'player-props',
      date: new Date().toISOString().split('T')[0]
    });

    console.log(`   NCAAF Source: ${ncaafResult.source}`);
    console.log(`   NCAAF Records: ${ncaafResult.data.length}`);
  }

  console.log('\n✅ TEST COMPLETE');
}

testFeedSimple().catch(console.error);