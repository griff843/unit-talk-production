#!/usr/bin/env tsx

/**
 * Check database status for 8/12/2025 props and games
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/getEnv';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  success: (...args: any[]) => console.log('[✅  ]', ...args),
  error: (...args: any[]) => console.log('[❌  ]', ...args),
  warn: (...args: any[]) => console.log('[⚠️  ]', ...args),
};

async function checkPropsStatus() {
  try {
    const env = getEnv();
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    logger.info('🔍 CHECKING DATABASE STATUS FOR 8/12/2025');
    logger.info('='.repeat(60));

    // Check raw props for today
    const { data: rawProps } = await supabase
      .from('raw_props')
      .select('id, sport, player_name, stat_type, line, over_odds, under_odds, created_at, tier, processed_at')
      .gte('created_at', '2025-08-12T00:00:00Z')
      .order('created_at', { ascending: false })
      .limit(10);

    logger.info('\n📊 RAW PROPS STATUS FOR 8/12:');
    logger.info('-'.repeat(40));
    if (rawProps?.length) {
      logger.success(`Found ${rawProps.length} props for today`);
      rawProps.slice(0, 5).forEach((prop, i) => {
        const processed = prop.processed_at ? '✅ PROCESSED' : '⏳ PENDING';
        logger.info(`${i+1}. ${prop.player_name} ${prop.stat_type} (${prop.sport}) - ${prop.tier} tier - ${processed}`);
        logger.info(`   Line: ${prop.line}, Odds: ${prop.over_odds}/${prop.under_odds}`);
      });
    } else {
      logger.error('No props found for 8/12');
    }

    // Check total counts
    const { count: totalRawProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' })
      .gte('created_at', '2025-08-12T00:00:00Z');

    const { count: processedProps } = await supabase
      .from('raw_props')  
      .select('*', { count: 'exact' })
      .gte('created_at', '2025-08-12T00:00:00Z')
      .not('processed_at', 'is', null);

    const { count: unprocessedProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' }) 
      .gte('created_at', '2025-08-12T00:00:00Z')
      .is('processed_at', null)
      .not('tier', 'is', null);

    logger.info('\n📈 PROCESSING STATISTICS:');
    logger.info(`Total props for 8/12: ${totalRawProps || 0}`);
    logger.info(`Processed: ${processedProps || 0}`);
    logger.info(`Ready for professional grading: ${unprocessedProps || 0}`);

    // Check unified picks
    const { count: unifiedPicks } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact' })
      .gte('created_at', '2025-08-12T00:00:00Z');

    logger.info(`Unified picks created: ${unifiedPicks || 0}`);

    // Check sports coverage
    const { data: sportsCoverage } = await supabase
      .from('raw_props')
      .select('sport')
      .gte('created_at', '2025-08-12T00:00:00Z')
      .not('tier', 'is', null);

    const sportsCount: Record<string, number> = {};
    sportsCoverage?.forEach(prop => {
      sportsCount[prop.sport] = (sportsCount[prop.sport] || 0) + 1;
    });

    logger.info('\n🏈 SPORTS COVERAGE FOR 8/12:');
    Object.entries(sportsCount).forEach(([sport, count]) => {
      logger.info(`${sport}: ${count} props`);
    });

    // Check recent data ingestion
    const { data: recentProps } = await supabase
      .from('raw_props')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentProps?.[0]) {
      const lastIngestion = new Date(recentProps[0].created_at);
      const now = new Date();
      const timeSinceLastProp = Math.floor((now.getTime() - lastIngestion.getTime()) / (1000 * 60)); // minutes
      
      logger.info('\n⏰ DATA FRESHNESS:');
      logger.info(`Last prop ingested: ${timeSinceLastProp} minutes ago`);
      
      if (timeSinceLastProp < 60) {
        logger.success('✅ Data ingestion is active and recent');
      } else if (timeSinceLastProp < 360) {
        logger.warn('⚠️  Data ingestion may be slowing down');
      } else {
        logger.error('❌ Data ingestion appears stalled');
      }
    }

    logger.info('\n🎯 SYSTEM READINESS ASSESSMENT:');
    if (unprocessedProps && unprocessedProps > 0) {
      logger.success('✅ Props available for professional grading');
      logger.success(`🚀 Ready to process ${unprocessedProps} props through elite system`);
    } else if (totalRawProps && totalRawProps > 0) {
      logger.warn('⚠️  Props exist but may need tier assignment first');  
    } else {
      logger.error('❌ No props available - need data ingestion');
    }

    return {
      totalProps: totalRawProps || 0,
      processedProps: processedProps || 0,
      readyForGrading: unprocessedProps || 0,
      sportsCount
    };

  } catch (error) {
    logger.error('❌ Failed to check props status:', error);
    throw error;
  }
}

if (require.main === module) {
  checkPropsStatus()
    .then((stats) => {
      console.log('\n✅ Props status check completed!');
      if (stats.readyForGrading > 0) {
        console.log('\n🚀 NEXT STEP: Run professional grading system');
        console.log('Command: npx tsx src/scripts/test-elite-professional-grading.ts');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Props status check failed:', error);
      process.exit(1);
    });
}

export { checkPropsStatus };