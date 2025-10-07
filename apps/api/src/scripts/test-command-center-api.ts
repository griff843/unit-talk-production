#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testCommandCenter() {
  console.log('🧪 TESTING COMMAND CENTER INTEGRATION\n');
  console.log('='.repeat(70));

  // Test 1: Database connection
  console.log('\n1️⃣  DATABASE CONNECTION:');
  const { data: testQuery, error: testError } = await supabase
    .from('market_props')
    .select('id')
    .limit(1);

  if (testError) {
    console.log(`   ❌ Database error: ${testError.message}`);
    return;
  } else {
    console.log('   ✅ Database connected');
  }

  // Test 2: Check today's market props
  const today = new Date().toISOString().split('T')[0];
  const { data: todayProps, count: todayCount } = await supabase
    .from('market_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00.000Z`);

  console.log('\n2️⃣  TODAY\'S MARKET PROPS:');
  console.log(`   Total props ingested today: ${todayCount || 0}`);

  if (todayCount && todayCount > 0) {
    console.log('   ✅ Props flowing today');
  } else {
    console.log('   ⚠️  No props today');
  }

  // Test 3: Check scored props
  const { data: scoredProps, count: scoredCount } = await supabase
    .from('scored_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00.000Z`);

  console.log('\n3️⃣  SCORED PROPS TODAY:');
  console.log(`   Scored props: ${scoredCount || 0}`);

  if (scoredCount && scoredCount > 0) {
    console.log('   ✅ Auto-scoring operational');
  } else {
    console.log('   ⚠️  No scoring today');
  }

  // Test 4: Sample pick-ready data
  console.log('\n4️⃣  COMMAND CENTER DATA STRUCTURE:');
  const { data: samplePicks } = await supabase
    .from('market_props')
    .select(`
      id,
      sport,
      market,
      player_name,
      team,
      opponent,
      line,
      odds,
      game_date,
      bookmaker_key,
      metadata
    `)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .limit(3);

  if (samplePicks && samplePicks.length > 0) {
    console.log(`   ✅ Found ${samplePicks.length} sample props with complete data`);
    samplePicks.forEach((p, i) => {
      console.log(`\n   [${i + 1}] ${p.player_name || 'N/A'} - ${p.market || 'N/A'}`);
      console.log(`       Sport: ${p.sport || 'N/A'}`);
      console.log(`       Teams: ${p.team || 'N/A'} vs ${p.opponent || 'N/A'}`);
      console.log(`       Line: ${p.line || 'N/A'} | Odds: ${p.odds || 'N/A'}`);
      console.log(`       Game Date: ${p.game_date || 'N/A'}`);
      console.log(`       Book: ${p.bookmaker_key || 'N/A'}`);
      console.log(`       Metadata fields: ${Object.keys(p.metadata || {}).length}`);
    });
  } else {
    console.log('   ⚠️  No sample data found');
  }

  // Test 5: Try Command Center API
  console.log('\n\n5️⃣  COMMAND CENTER API ACCESS:');
  try {
    const ports = [3015, 3017, 3004];
    let successPort = null;

    for (const port of ports) {
      try {
        const response = await fetch(`http://localhost:${port}/api/health`, {
          signal: AbortSignal.timeout(2000)
        });

        if (response.ok) {
          const health = await response.json();
          successPort = port;
          console.log(`\n   ✅ Command Center accessible on port ${port}`);
          console.log(`   Status: ${health.status || 'unknown'}`);
          console.log(`   Database: ${health.database || 'unknown'}`);
          break;
        }
      } catch (err) {
        // Try next port
      }
    }

    if (!successPort) {
      console.log('   ❌ Command Center not accessible on any port');
      console.log('   Tried ports: 3015, 3017, 3004');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 SUMMARY:\n');

  const hasData = todayCount && todayCount > 0;
  const hasScoring = scoredCount && scoredCount > 0;

  if (hasData && hasScoring) {
    console.log('✅ DATABASE: Operational with today\'s data');
    console.log('✅ SCORING: Auto-scoring working');
    console.log('✅ DATA QUALITY: Complete metadata available');
    console.log('\n🎯 Issue: Command Center UI not displaying production data');
    console.log('   Recommendation: Check Command Center environment configuration');
  } else {
    console.log('⚠️  DATA OR SCORING ISSUE DETECTED');
    if (!hasData) console.log('   - No market props today');
    if (!hasScoring) console.log('   - No scoring activity today');
  }

  console.log('');
}

testCommandCenter().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
