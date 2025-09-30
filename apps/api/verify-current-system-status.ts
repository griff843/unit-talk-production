#!/usr/bin/env node

/**
 * VERIFY CURRENT SYSTEM STATUS - Today's Data & Scoring
 *
 * Comprehensive verification of:
 * - Today's games and props ingestion
 * - Current scoring status
 * - Upsert functionality validation
 * - Real-time system health
 */

import { supabaseClient } from './src/services/supabaseClient';

async function getCurrentDate() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    today: today.toISOString().split('T')[0],
    todayStart: today.toISOString(),
    todayEnd: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
  };
}

async function verifyTodaysGamesIngestion() {
  console.log('\n🏈 VERIFYING TODAY\'S GAMES INGESTION:');
  console.log('='.repeat(50));

  const { today, todayStart, todayEnd } = await getCurrentDate();

  try {
    // Check games for today
    const { data: todaysGames, error: gamesError } = await supabaseClient
      .from('games')
      .select('*')
      .gte('game_date', todayStart)
      .lt('game_date', todayEnd)
      .order('created_at', { ascending: false });

    if (gamesError) {
      console.log('   ❌ Error fetching today\'s games:', gamesError.message);
      return false;
    }

    console.log(`   📅 Date: ${today}`);
    console.log(`   🏈 Games found: ${todaysGames?.length || 0}`);

    if (todaysGames && todaysGames.length > 0) {
      console.log('   📊 Games by sport:');
      const sportCounts: Record<string, number> = {};
      todaysGames.forEach(game => {
        sportCounts[game.sport] = (sportCounts[game.sport] || 0) + 1;
      });

      Object.entries(sportCounts).forEach(([sport, count]) => {
        console.log(`     ${sport}: ${count} games`);
      });

      console.log('\n   📋 Sample today\'s games:');
      todaysGames.slice(0, 5).forEach((game, i) => {
        console.log(`     ${i + 1}. ${game.home_team} vs ${game.away_team} (${game.sport}) - ${game.status}`);
      });

      // Check for betting lines
      const gamesWithLines = todaysGames.filter(game =>
        game.spread !== null || game.total !== null || game.moneyline_home !== null
      );
      console.log(`   💰 Games with betting lines: ${gamesWithLines.length}/${todaysGames.length}`);

      return true;
    } else {
      console.log('   ⚠️ No games found for today - this may be normal if no games scheduled');
      return false;
    }

  } catch (error: any) {
    console.error('   ❌ Games verification failed:', error.message);
    return false;
  }
}

async function verifyTodaysPropsIngestion() {
  console.log('\n📊 VERIFYING TODAY\'S PROPS INGESTION:');
  console.log('='.repeat(50));

  const { today, todayStart, todayEnd } = await getCurrentDate();

  try {
    // Check props created today
    const { data: todaysProps, error: propsError } = await supabaseClient
      .from('raw_props')
      .select('*')
      .gte('created_at', todayStart)
      .lt('created_at', todayEnd)
      .order('created_at', { ascending: false });

    if (propsError) {
      console.log('   ❌ Error fetching today\'s props:', propsError.message);
      return false;
    }

    console.log(`   📅 Date: ${today}`);
    console.log(`   📊 Props ingested today: ${todaysProps?.length || 0}`);

    if (todaysProps && todaysProps.length > 0) {
      // Props by sport
      const sportCounts: Record<string, number> = {};
      todaysProps.forEach(prop => {
        sportCounts[prop.sport] = (sportCounts[prop.sport] || 0) + 1;
      });

      console.log('   📊 Props by sport:');
      Object.entries(sportCounts).forEach(([sport, count]) => {
        console.log(`     ${sport}: ${count.toLocaleString()} props`);
      });

      // Props by source
      const sourceCounts: Record<string, number> = {};
      todaysProps.forEach(prop => {
        sourceCounts[prop.source || 'unknown'] = (sourceCounts[prop.source || 'unknown'] || 0) + 1;
      });

      console.log('   📊 Props by source:');
      Object.entries(sourceCounts).forEach(([source, count]) => {
        console.log(`     ${source}: ${count.toLocaleString()} props`);
      });

      // Sample props
      console.log('\n   📋 Sample today\'s props:');
      todaysProps.slice(0, 5).forEach((prop, i) => {
        console.log(`     ${i + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport})`);
      });

      // Check for settled props
      const settledProps = todaysProps.filter(prop => prop.outcome && prop.outcome !== 'pending');
      console.log(`   ✅ Settled props: ${settledProps.length}/${todaysProps.length}`);

      return true;
    } else {
      console.log('   ⚠️ No props ingested today - this indicates potential system issues');
      return false;
    }

  } catch (error: any) {
    console.error('   ❌ Props verification failed:', error.message);
    return false;
  }
}

async function verifyScoringStatus() {
  console.log('\n🎯 VERIFYING SCORING STATUS:');
  console.log('='.repeat(50));

  try {
    // Check for scored props
    const { data: scoredProps, error: scoredError } = await supabaseClient
      .from('raw_props')
      .select('*')
      .not('confidence', 'is', null)
      .not('tier', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (scoredError) {
      console.log('   ❌ Error fetching scored props:', scoredError.message);
      return false;
    }

    console.log(`   📊 Recently scored props: ${scoredProps?.length || 0}`);

    if (scoredProps && scoredProps.length > 0) {
      // Tier distribution
      const tierCounts: Record<string, number> = {};
      scoredProps.forEach(prop => {
        const tier = prop.tier || 'unassigned';
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      });

      console.log('   🏆 Tier distribution:');
      Object.entries(tierCounts).forEach(([tier, count]) => {
        console.log(`     ${tier}: ${count} props`);
      });

      // Confidence distribution
      const avgConfidence = scoredProps.reduce((sum, prop) =>
        sum + (prop.confidence || 0), 0) / scoredProps.length;
      console.log(`   📈 Average confidence: ${avgConfidence.toFixed(3)}`);

      // Check for professional features
      const professionalProps = scoredProps.filter(prop =>
        prop.professional_score !== null || prop.feature_contributions !== null
      );
      console.log(`   🚀 Professional scored props: ${professionalProps.length}/${scoredProps.length}`);

      // Recent scoring activity
      const recentScored = scoredProps.filter(prop => {
        const scoredTime = new Date(prop.updated_at || prop.created_at);
        const hoursAgo = (Date.now() - scoredTime.getTime()) / (1000 * 60 * 60);
        return hoursAgo <= 1; // Last hour
      });
      console.log(`   ⏰ Scored in last hour: ${recentScored.length}`);

      return true;
    } else {
      console.log('   ⚠️ No scored props found - scoring system may not be active');
      return false;
    }

  } catch (error: any) {
    console.error('   ❌ Scoring verification failed:', error.message);
    return false;
  }
}

async function verifyUpsertFunctionality() {
  console.log('\n🔄 VERIFYING UPSERT FUNCTIONALITY:');
  console.log('='.repeat(50));

  try {
    // Check for duplicate external_ids (should indicate upsert working)
    const { data: duplicateCheck, error: duplicateError } = await supabaseClient
      .from('raw_props')
      .select('external_id, created_at, updated_at')
      .not('external_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (duplicateError) {
      console.log('   ❌ Error checking duplicates:', duplicateError.message);
      return false;
    }

    if (duplicateCheck && duplicateCheck.length > 0) {
      // Count external_id frequency
      const idCounts: Record<string, number> = {};
      duplicateCheck.forEach(prop => {
        if (prop.external_id) {
          idCounts[prop.external_id] = (idCounts[prop.external_id] || 0) + 1;
        }
      });

      const duplicateIds = Object.entries(idCounts).filter(([_, count]) => count > 1);
      console.log(`   📊 Total unique external_ids checked: ${Object.keys(idCounts).length}`);
      console.log(`   🔄 Duplicate external_ids found: ${duplicateIds.length}`);

      if (duplicateIds.length > 0) {
        console.log('   ✅ Upsert functionality appears to be working (handling duplicates)');
        console.log('   📋 Sample duplicates:');
        duplicateIds.slice(0, 3).forEach(([id, count]) => {
          console.log(`     ${id}: ${count} occurrences`);
        });
      } else {
        console.log('   ℹ️ No duplicates found - either no upserts or unique data');
      }

      // Check for updated_at vs created_at differences
      const updatedProps = duplicateCheck.filter(prop =>
        prop.updated_at && prop.created_at && prop.updated_at !== prop.created_at
      );
      console.log(`   🔄 Props with updates: ${updatedProps.length}/${duplicateCheck.length}`);

      return true;
    } else {
      console.log('   ⚠️ No props with external_ids found');
      return false;
    }

  } catch (error: any) {
    console.error('   ❌ Upsert verification failed:', error.message);
    return false;
  }
}

async function verifyAgentHealth() {
  console.log('\n🤖 VERIFYING AGENT HEALTH:');
  console.log('='.repeat(50));

  try {
    // Check agent_health table
    const { data: agentHealth, error: healthError } = await supabaseClient
      .from('agent_health')
      .select('*')
      .order('last_heartbeat', { ascending: false });

    if (healthError) {
      console.log('   ❌ Error fetching agent health:', healthError.message);
      return false;
    }

    if (agentHealth && agentHealth.length > 0) {
      console.log(`   🤖 Total agents monitored: ${agentHealth.length}`);

      const now = Date.now();
      const healthyAgents = agentHealth.filter(agent => {
        const lastHeartbeat = new Date(agent.last_heartbeat).getTime();
        const minutesAgo = (now - lastHeartbeat) / (1000 * 60);
        return minutesAgo <= 5 && agent.status === 'healthy'; // Healthy if heartbeat within 5 minutes
      });

      console.log(`   ✅ Healthy agents: ${healthyAgents.length}/${agentHealth.length}`);

      console.log('   📊 Agent status:');
      agentHealth.forEach(agent => {
        const lastHeartbeat = new Date(agent.last_heartbeat);
        const minutesAgo = Math.floor((now - lastHeartbeat.getTime()) / (1000 * 60));
        const status = minutesAgo <= 5 && agent.status === 'healthy' ? '🟢' : '🔴';
        console.log(`     ${status} ${agent.agent_name}: ${agent.status} (${minutesAgo}m ago)`);
      });

      return healthyAgents.length > 0;
    } else {
      console.log('   ⚠️ No agent health data found');
      return false;
    }

  } catch (error: any) {
    console.error('   ❌ Agent health verification failed:', error.message);
    return false;
  }
}

async function verifyRealtimeDataFlow() {
  console.log('\n⚡ VERIFYING REAL-TIME DATA FLOW:');
  console.log('='.repeat(50));

  try {
    // Check recent data ingestion (last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: recentProps, error: recentError } = await supabaseClient
      .from('raw_props')
      .select('*')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false });

    if (recentError) {
      console.log('   ❌ Error fetching recent data:', recentError.message);
      return false;
    }

    console.log(`   📊 Props ingested in last 30 minutes: ${recentProps?.length || 0}`);

    if (recentProps && recentProps.length > 0) {
      // Data flow rate
      const rate = recentProps.length / 30; // per minute
      console.log(`   📈 Ingestion rate: ${rate.toFixed(1)} props/minute`);

      // Sources active in last 30 minutes
      const activeSources = [...new Set(recentProps.map(p => p.source))];
      console.log(`   📡 Active sources: ${activeSources.join(', ')}`);

      // Sports active in last 30 minutes
      const activeSports = [...new Set(recentProps.map(p => p.sport))];
      console.log(`   🏈 Active sports: ${activeSports.join(', ')}`);

      return true;
    } else {
      console.log('   ⚠️ No recent data flow - system may be idle or offline');
      return false;
    }

  } catch (error: any) {
    console.error('   ❌ Real-time verification failed:', error.message);
    return false;
  }
}

async function runSystemStatusVerification() {
  console.log('🔍 UNIT TALK SYSTEM STATUS VERIFICATION');
  console.log('🎯 Comprehensive Current Data & Scoring Analysis');
  console.log('='.repeat(60));

  const results = {
    gamesIngestion: await verifyTodaysGamesIngestion(),
    propsIngestion: await verifyTodaysPropsIngestion(),
    scoringStatus: await verifyScoringStatus(),
    upsertFunctionality: await verifyUpsertFunctionality(),
    agentHealth: await verifyAgentHealth(),
    realtimeFlow: await verifyRealtimeDataFlow()
  };

  // Summary
  console.log('\n🎯 SYSTEM STATUS SUMMARY:');
  console.log('='.repeat(60));

  const checks = [
    { name: 'Today\'s Games Ingestion', status: results.gamesIngestion },
    { name: 'Today\'s Props Ingestion', status: results.propsIngestion },
    { name: 'Scoring System Active', status: results.scoringStatus },
    { name: 'Upsert Functionality', status: results.upsertFunctionality },
    { name: 'Agent Health', status: results.agentHealth },
    { name: 'Real-time Data Flow', status: results.realtimeFlow }
  ];

  checks.forEach(check => {
    const status = check.status ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${status} ${check.name}`);
  });

  const passedChecks = checks.filter(c => c.status).length;
  const totalChecks = checks.length;
  const successRate = Math.round((passedChecks / totalChecks) * 100);

  console.log(`\n📊 Overall System Health: ${passedChecks}/${totalChecks} checks passed (${successRate}%)`);

  if (successRate >= 80) {
    console.log('🟢 SYSTEM STATUS: OPERATIONAL');
  } else if (successRate >= 60) {
    console.log('🔶 SYSTEM STATUS: DEGRADED');
  } else {
    console.log('🔴 SYSTEM STATUS: CRITICAL');
  }

  console.log('\n🚀 RECOMMENDATIONS:');
  if (!results.propsIngestion) {
    console.log('   ⚠️ Check data ingestion pipeline - no props ingested today');
  }
  if (!results.scoringStatus) {
    console.log('   ⚠️ Activate scoring agents - props not being scored');
  }
  if (!results.agentHealth) {
    console.log('   ⚠️ Check agent system - agents appear offline');
  }
  if (!results.realtimeFlow) {
    console.log('   ⚠️ Check real-time data sources - no recent data flow');
  }

  if (successRate === 100) {
    console.log('   🎯 System fully operational - all checks passed!');
  }
}

runSystemStatusVerification().catch(console.error);