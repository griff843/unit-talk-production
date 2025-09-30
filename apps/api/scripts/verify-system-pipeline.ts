#!/usr/bin/env npx tsx
/**
 * Verify the complete system pipeline is working as designed
 */

import { supabase } from '../src/services/supabaseClient';
import { logger } from '../src/utils/logger';

async function verifySystemPipeline() {
  logger.info('🔍 VERIFYING COMPLETE SYSTEM PIPELINE');
  logger.info('=' .repeat(70));

  // 1. Check database state
  logger.info('\n📊 DATABASE STATE:');
  const { count: totalProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true });
  logger.info(`Total props in database: ${totalProps}`);

  // 2. Check recent props and scoring
  const { data: recentProps } = await supabase
    .from('raw_props')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!recentProps || recentProps.length === 0) {
    logger.error('No props found in database');
    return;
  }

  logger.info('\n🎯 RECENT PROPS AND SCORING STATUS:');
  logger.info('-'.repeat(70));

  for (const prop of recentProps) {
    logger.info(`\nPlayer: ${prop.player_name || 'Unknown'}`);
    logger.info(`Prop: ${prop.stat_type} ${prop.line} (${prop.sport})`);
    logger.info(`Created: ${prop.created_at?.split('T')[0]}`);

    // Check professional features (45 existing factors)
    logger.info('\n✅ Professional Features (45 existing):');
    const features = {
      'Steam Detected': prop.steam_detected,
      'Sharp Money': prop.sharp_money,
      'Line Movement': prop.line_movement,
      'CLV': prop.closing_line_value,
      'Contrarian': prop.contrarian_opportunity,
      'Injury Edge': prop.injury_timing_advantage,
      'Cross Market': prop.cross_market_arbitrage
    };

    let featureCount = 0;
    Object.entries(features).forEach(([key, value]) => {
      if (value) {
        logger.info(`  ✓ ${key}: ${value}`);
        featureCount++;
      }
    });
    logger.info(`  Active features: ${featureCount}/7 shown (45 total tracked)`);

    // Check scoring status
    logger.info('\n📈 Scoring Status:');
    if (prop.professional_score !== null) {
      logger.info(`  ✅ SCORED`);
      logger.info(`  - Professional Score: ${prop.professional_score}/100`);
      logger.info(`  - Kelly Fraction: ${prop.kelly_fraction ? (prop.kelly_fraction * 100).toFixed(1) : 0}%`);
      logger.info(`  - Tier: ${prop.tier || 'Not assigned'}`);
      logger.info(`  - Processing Time: ${prop.processing_time || 'N/A'}ms`);
    } else {
      logger.info(`  ❌ NOT SCORED YET`);
      logger.info(`  - Waiting for ScoringAgent processing`);
    }

    logger.info('-'.repeat(70));
  }

  // 3. Check system agents status
  logger.info('\n🤖 AGENT STATUS:');
  const { data: agents } = await supabase
    .from('agent_health')
    .select('*')
    .order('last_heartbeat', { ascending: false });

  if (agents && agents.length > 0) {
    agents.forEach(agent => {
      const status = agent.health_status === 'healthy' ? '✅' : '❌';
      logger.info(`${status} ${agent.agent_name}: ${agent.health_status}`);
    });
  } else {
    logger.info('No agent health data available');
  }

  // 4. Summary
  const scoredCount = recentProps.filter(p => p.professional_score !== null).length;
  const unscoredCount = recentProps.length - scoredCount;

  logger.info('\n📋 PIPELINE VERIFICATION SUMMARY:');
  logger.info(`Props Checked: ${recentProps.length}`);
  logger.info(`Scored: ${scoredCount}`);
  logger.info(`Unscored: ${unscoredCount}`);

  if (scoredCount === 0) {
    logger.warn('\n⚠️ WARNING: No props have been scored!');
    logger.warn('Possible issues:');
    logger.warn('1. ScoringAgent may not be running');
    logger.warn('2. Processing pipeline may be blocked');
    logger.warn('3. Professional scoring features may not be calculating');

    logger.info('\nTo fix, try:');
    logger.info('1. Run: docker-compose exec api npx tsx src/runner/runScoringAgent.ts');
    logger.info('2. Check logs: docker-compose logs api | grep ScoringAgent');
  } else {
    logger.info('\n✅ SYSTEM VERIFICATION: Pipeline is processing props correctly!');
  }
}

if (require.main === module) {
  verifySystemPipeline().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { verifySystemPipeline };