#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fullSystemAnalysis() {
  console.log('🔍 COMPREHENSIVE TIER 1 SYSTEM ANALYSIS\n');
  console.log('='.repeat(70));

  // 1. Check FeedAgent activity
  console.log('\n1️⃣  FEEDAGENT STATUS:');
  const { data: feedLogs } = await supabase
    .from('agent_logs')
    .select('*')
    .eq('agent', 'FeedAgent')
    .order('created_at', { ascending: false })
    .limit(5);

  if (feedLogs && feedLogs.length > 0) {
    const latest = new Date(feedLogs[0].created_at);
    const minutesAgo = Math.floor((Date.now() - latest.getTime()) / 60000);
    console.log(`   Last activity: ${minutesAgo} minutes ago`);
    console.log(`   Status: ${minutesAgo < 5 ? '✅ ACTIVE' : '⚠️ STALE (' + minutesAgo + 'm)'}`);
    console.log(`   Recent operations: ${feedLogs.length}`);

    // Show what FeedAgent is doing
    feedLogs.slice(0, 3).forEach((log, i) => {
      const time = new Date(log.created_at).toLocaleTimeString();
      console.log(`   [${i + 1}] ${time}: ${log.message || log.level}`);
    });
  } else {
    console.log('   ❌ NO FEEDAGENT LOGS FOUND');
  }

  // 2. Check raw_props ingestion (last hour)
  console.log('\n2️⃣  RAW PROPS INGESTION (Last Hour):');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: rawCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);

  console.log(`   Props ingested (last hour): ${rawCount || 0}`);
  console.log(`   Status: ${rawCount && rawCount > 0 ? '✅ FLOWING' : '❌ NO INGESTION'}`);

  // 3. Check what sports we have TODAY
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n3️⃣  SPORTS DATA FOR TODAY (${today}):`);

  const sports = ['NFL', 'MLB', 'NBA', 'NHL'];
  for (const sport of sports) {
    const { data: props, count } = await supabase
      .from('market_props')
      .select('game_date, created_at', { count: 'exact' })
      .eq('sport', sport)
      .gte('game_date', today)
      .limit(1);

    if (count && count > 0 && props) {
      const createdToday = new Date(props[0].created_at).toDateString() === new Date().toDateString();
      console.log(`   ${sport}: ${count} props for today's games ${createdToday ? '✅ FRESH' : '⚠️ OLD'}`);
    } else {
      console.log(`   ${sport}: 0 props (no games or not ingested) ❌`);
    }
  }

  // 4. Check NFL specifically - what game dates do we have?
  console.log('\n4️⃣  NFL GAME DATES AVAILABLE:');
  const { data: nflDates } = await supabase
    .from('market_props')
    .select('game_date')
    .eq('sport', 'NFL')
    .order('game_date', { ascending: false })
    .limit(10);

  if (nflDates && nflDates.length > 0) {
    const uniqueDates = [...new Set(nflDates.map(d => d.game_date))];
    uniqueDates.slice(0, 5).forEach(date => {
      const gameDate = new Date(date);
      const dayOfWeek = gameDate.toLocaleDateString('en-US', { weekday: 'long' });
      console.log(`   ${date} (${dayOfWeek})`);
    });
  }

  // 5. Check ML training status
  console.log('\n5️⃣  ML TRAINING STATUS:');
  const { data: mlWeights } = await supabase
    .from('ml_factor_weights')
    .select('sport, last_trained, total_samples')
    .order('last_trained', { ascending: false });

  if (mlWeights && mlWeights.length > 0) {
    mlWeights.forEach(w => {
      const trained = new Date(w.last_trained);
      const daysAgo = Math.floor((Date.now() - trained.getTime()) / (24 * 60 * 60 * 1000));
      console.log(`   ${w.sport}: ${w.total_samples} samples, trained ${daysAgo}d ago`);
    });
  } else {
    console.log('   ❌ NO ML WEIGHTS FOUND - Using hardcoded weights');
  }

  // 6. Check auto-scoring loop
  console.log('\n6️⃣  AUTO-SCORING LOOP:');
  const fifteenMin = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count: scoredRecent } = await supabase
    .from('scored_props')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', fifteenMin);

  console.log(`   Props scored (last 15min): ${scoredRecent || 0}`);
  console.log(`   Status: ${scoredRecent && scoredRecent > 0 ? '✅ RUNNING' : '❌ NOT SCORING'}`);

  // 7. Check normalization pipeline
  console.log('\n7️⃣  NORMALIZATION PIPELINE:');
  const { data: recentMarket } = await supabase
    .from('market_props')
    .select('created_at')
    .gte('created_at', oneHourAgo)
    .limit(1);

  const marketFlowing = recentMarket && recentMarket.length > 0;
  console.log(`   Status: ${marketFlowing ? '✅ RUNNING' : '❌ NOT RUNNING'}`);

  // 8. Check what's in agent_health
  console.log('\n8️⃣  AGENT HEALTH MONITORING:');
  const { data: agentHealth } = await supabase
    .from('agent_health')
    .select('agent, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (agentHealth && agentHealth.length > 0) {
    const agents = [...new Set(agentHealth.map(a => a.agent))];
    console.log(`   Tracked agents: ${agents.join(', ')}`);
    agents.forEach(agent => {
      const latest = agentHealth.find(a => a.agent === agent);
      if (latest) {
        const minutesAgo = Math.floor((Date.now() - new Date(latest.created_at).getTime()) / 60000);
        console.log(`   ${agent}: ${latest.status} (${minutesAgo}m ago)`);
      }
    });
  } else {
    console.log('   ⚠️  No agent health records');
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 TIER 1 DIAGNOSIS:\n');

  const feedActive = feedLogs && feedLogs.length > 0 &&
    Math.floor((Date.now() - new Date(feedLogs[0].created_at).getTime()) / 60000) < 5;
  const rawFlowing = rawCount && rawCount > 0;
  const scoringActive = scoredRecent && scoredRecent > 0;

  console.log('CRITICAL SYSTEMS:');
  console.log(`   FeedAgent Active: ${feedActive ? '✅' : '❌'}`);
  console.log(`   Raw Ingestion: ${rawFlowing ? '✅' : '❌'}`);
  console.log(`   Normalization: ${marketFlowing ? '✅' : '❌'}`);
  console.log(`   Auto-Scoring: ${scoringActive ? '✅' : '❌'}`);

  console.log('\nDATA QUALITY:');
  if (!feedActive) console.log('   ❌ CRITICAL: FeedAgent not actively pulling data');
  if (!rawFlowing) console.log('   ❌ CRITICAL: No raw props ingested in last hour');
  if (!marketFlowing) console.log('   ❌ CRITICAL: Normalization pipeline stalled');
  if (!scoringActive) console.log('   ⚠️  WARNING: Auto-scoring may be stalled');

  console.log('\nREALITY CHECK:');
  console.log('   📅 Today is Monday, October 6, 2025');
  console.log('   🏈 NFL typically plays on:');
  console.log('      - Thursday Night Football');
  console.log('      - Sunday (main slate)');
  console.log('      - Monday Night Football (ONE game)');
  console.log('   ⚠️  If no MNF game today, having 0 NFL props is CORRECT');

  if (feedActive && rawFlowing && scoringActive) {
    console.log('\n✅ VERDICT: TIER 1 STATUS CONFIRMED');
    console.log('   All automation workflows operational');
    console.log('   Lack of NFL data likely due to game schedule, not system failure');
  } else {
    console.log('\n❌ VERDICT: NOT TIER 1');
    console.log('   Critical workflows not running');
  }

  console.log('');
}

fullSystemAnalysis().catch(error => {
  console.error('❌ Analysis failed:', error.message);
  process.exit(1);
});
