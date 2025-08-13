#!/usr/bin/env tsx

/**
 * Test the grading system to understand why props aren't being processed
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/getEnv';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  warn: (...args: any[]) => console.log('[WARN ]', ...args),
  error: (...args: any[]) => console.log('[ERROR]', ...args),
};

async function testGradingSystem() {
  try {
    const env = getEnv();
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    logger.info('🔍 Testing Grading System Configuration...');

    // Check environment variables
    const USE_PRO_SCORER = process.env.USE_PRO_SCORER === 'true';
    const SCORING_DEBUG = process.env.SCORING_DEBUG === 'true';
    
    logger.info(`🎯 USE_PRO_SCORER: ${USE_PRO_SCORER}`);
    logger.info(`📊 SCORING_DEBUG: ${SCORING_DEBUG}`);

    // Count total raw_props
    const { count: totalRawProps, error: totalError } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      logger.error('Error counting total raw_props:', totalError);
      return;
    }

    logger.info(`📊 Total raw_props: ${totalRawProps}`);

    // Test Professional path criteria
    const { data: unprocessedProps, error: unprocessedError } = await supabase
      .from('raw_props')
      .select('id, player_name, stat_type, sport, created_at, processed_at, tier, promoted_to_picks')
      .is('processed_at', null)
      .limit(10);

    if (unprocessedError) {
      logger.error('Error getting unprocessed props:', unprocessedError);
    } else {
      logger.info(`🎯 Professional path (processed_at IS NULL): ${unprocessedProps?.length || 0} props found`);
      if (unprocessedProps && unprocessedProps.length > 0) {
        console.table(unprocessedProps.slice(0, 5));
      }
    }

    // Test Legacy path criteria  
    const { data: untierredProps, error: untierredError } = await supabase
      .from('raw_props')
      .select('id, player_name, stat_type, sport, created_at, processed_at, tier, promoted_to_picks')
      .is('tier', null)
      .or('promoted_to_picks.is.null,promoted_to_picks.eq.false')
      .limit(10);

    if (untierredError) {
      logger.error('Error getting untiered props:', untierredError);
    } else {
      logger.info(`🔄 Legacy path (tier IS NULL): ${untierredProps?.length || 0} props found`);
      if (untierredProps && untierredProps.length > 0) {
        console.table(untierredProps.slice(0, 5));
      }
    }

    // Check what columns exist in raw_props
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'raw_props')
      .order('ordinal_position');

    if (columnsError) {
      logger.error('Error getting raw_props columns:', columnsError);
    } else {
      logger.info(`\n📋 raw_props table structure (${columns?.length} columns):`);
      console.table(columns);
    }

    // Check unified_picks count
    const { count: totalUnifiedPicks, error: unifiedError } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    if (unifiedError) {
      logger.warn('unified_picks table not accessible or doesn\'t exist');
    } else {
      logger.info(`📈 Total unified_picks: ${totalUnifiedPicks}`);
    }

  } catch (error) {
    logger.error('Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testGradingSystem()
    .then(() => {
      console.log('\n✅ Grading system test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Grading system test failed:', error);
      process.exit(1);
    });
}