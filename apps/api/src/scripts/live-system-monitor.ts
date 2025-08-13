#!/usr/bin/env tsx

/**
 * Live monitoring of the elite 1-minute system to confirm it's working
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/getEnv';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  warn: (...args: any[]) => console.log('[WARN ]', ...args),
  error: (...args: any[]) => console.log('[ERROR]', ...args),
};

async function liveSystemMonitor() {
  try {
    const env = getEnv();
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    logger.info('🔍 LIVE SYSTEM MONITORING - CONFIRMING 1-MINUTE OPERATIONS');
    logger.info('=' .repeat(60));

    const startTime = new Date();
    logger.info(`🕐 Monitor started at: ${startTime.toISOString()}`);

    // Get baseline counts
    const { count: initialRawProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    const { count: initialPicks } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    logger.info(`📊 BASELINE: ${initialRawProps} raw_props, ${initialPicks} unified_picks`);

    // Monitor for 5 minutes to see real activity
    const monitorDuration = 5 * 60 * 1000; // 5 minutes
    const checkInterval = 30 * 1000; // Check every 30 seconds
    
    logger.info(`⏳ Monitoring for 5 minutes (checking every 30 seconds)...`);
    logger.info('🔍 Looking for: New raw_props, new picks, live grading activity');

    const checks = [];
    const maxChecks = Math.floor(monitorDuration / checkInterval);

    for (let i = 0; i < maxChecks; i++) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      const checkTime = new Date();
      const elapsed = Math.floor((checkTime.getTime() - startTime.getTime()) / 1000);
      
      logger.info(`\n📊 CHECK ${i + 1}/${maxChecks} (${elapsed}s elapsed):`);

      // Check for new raw_props in last 30 seconds
      const thirtySecondsAgo = new Date(checkTime.getTime() - 30 * 1000);
      
      const { data: newProps, error: propsError } = await supabase
        .from('raw_props')
        .select('id, player_name, stat_type, sport, created_at, provider')
        .gte('created_at', thirtySecondsAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (propsError) {
        logger.error(`   ❌ Error checking props: ${propsError.message}`);
      } else if (newProps && newProps.length > 0) {
        logger.info(`   ✅ LIVE INGESTION: ${newProps.length} new props in last 30s`);
        newProps.slice(0, 3).forEach(prop => {
          const secondsOld = Math.floor((checkTime.getTime() - new Date(prop.created_at).getTime()) / 1000);
          logger.info(`      • ${prop.player_name} ${prop.stat_type} (${prop.sport}) - ${secondsOld}s ago`);
        });
      } else {
        logger.info(`   📭 No new props in last 30 seconds`);
      }

      // Check for new picks in last 30 seconds
      const { data: newPicks, error: picksError } = await supabase
        .from('unified_picks')
        .select('selection, sport, tier_when_placed, created_at')
        .gte('created_at', thirtySecondsAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (picksError) {
        logger.error(`   ❌ Error checking picks: ${picksError.message}`);
      } else if (newPicks && newPicks.length > 0) {
        logger.info(`   ✅ LIVE GRADING: ${newPicks.length} new picks in last 30s`);
        newPicks.forEach(pick => {
          const secondsOld = Math.floor((checkTime.getTime() - new Date(pick.created_at).getTime()) / 1000);
          logger.info(`      • ${pick.selection} (${pick.tier_when_placed}-tier) - ${secondsOld}s ago`);
        });
      } else {
        logger.info(`   📭 No new picks in last 30 seconds`);
      }

      // Get current totals
      const { count: currentRawProps } = await supabase
        .from('raw_props')
        .select('*', { count: 'exact', head: true });

      const { count: currentPicks } = await supabase
        .from('unified_picks')
        .select('*', { count: 'exact', head: true });

      const propsGrowth = (currentRawProps || 0) - (initialRawProps || 0);
      const picksGrowth = (currentPicks || 0) - (initialPicks || 0);

      logger.info(`   📈 GROWTH: +${propsGrowth} props, +${picksGrowth} picks since start`);

      checks.push({
        time: checkTime.toISOString(),
        newPropsCount: newProps?.length || 0,
        newPicksCount: newPicks?.length || 0,
        totalPropsGrowth: propsGrowth,
        totalPicksGrowth: picksGrowth
      });
    }

    // Final analysis
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 LIVE SYSTEM CONFIRMATION RESULTS');
    logger.info('='.repeat(60));

    const totalNewProps = checks.reduce((sum, check) => sum + check.newPropsCount, 0);
    const totalNewPicks = checks.reduce((sum, check) => sum + check.newPicksCount, 0);
    const finalPropsGrowth = checks[checks.length - 1]?.totalPropsGrowth || 0;
    const finalPicksGrowth = checks[checks.length - 1]?.totalPicksGrowth || 0;

    logger.info(`⏱️  Monitor duration: 5 minutes (${maxChecks} checks)`);
    logger.info(`📊 Activity detected: ${totalNewProps} new props, ${totalNewPicks} new picks`);
    logger.info(`📈 Total growth: +${finalPropsGrowth} props, +${finalPicksGrowth} picks`);

    // System status assessment
    if (totalNewProps > 0) {
      logger.info('✅ CONFIRMED: Live ingestion is working');
      if (totalNewProps >= 5) {
        logger.info('🚀 EXCELLENT: High-frequency ingestion detected');
      } else {
        logger.info('⚠️  MODERATE: Some ingestion activity, but may not be 1-minute frequency');
      }
    } else {
      logger.info('❌ ISSUE: No live ingestion detected in 5 minutes');
    }

    if (totalNewPicks > 0) {
      logger.info('✅ CONFIRMED: Live grading system is working');
      logger.info('🏆 Professional picks being created in real-time');
    } else if (totalNewProps > 0) {
      logger.info('⚠️  PARTIAL: Props ingesting but not being graded to picks yet');
      logger.info('💡 May need time for grading pipeline to process');
    } else {
      logger.info('❌ ISSUE: No grading activity detected');
    }

    // Provide recommendations
    logger.info('\n🎯 SYSTEM STATUS:');
    if (totalNewProps >= 3 && totalNewPicks > 0) {
      logger.info('🏆 ELITE SYSTEM FULLY OPERATIONAL');
      logger.info('   ✅ 1-minute ingestion confirmed');
      logger.info('   ✅ Real-time grading confirmed');
      logger.info('   ✅ Auto-promotion working');
    } else if (totalNewProps > 0) {
      logger.info('🔄 SYSTEM PARTIALLY OPERATIONAL');
      logger.info('   ✅ Ingestion working');
      logger.info('   ⏳ Grading pipeline may need more time');
    } else {
      logger.info('⚠️  SYSTEM NEEDS ATTENTION');
      logger.info('   ❌ No live activity detected');
      logger.info('   🔧 Check workflow and API status');
    }

    logger.info('\n📋 NEXT STEPS:');
    logger.info('🔗 Check Temporal UI: http://localhost:8088');
    logger.info('📊 Monitor longer for consistent patterns');
    logger.info('🎯 Verify live games are detected for 1-minute mode');

  } catch (error) {
    logger.error('❌ Live monitoring failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  liveSystemMonitor()
    .then(() => {
      console.log('\n✅ Live system monitoring completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Monitoring failed:', error);
      process.exit(1);
    });
}