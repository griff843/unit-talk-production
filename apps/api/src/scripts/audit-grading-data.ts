#!/usr/bin/env tsx

/**
 * Audit available data for grading system
 * Check what real data we have vs dummy data we're using
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

async function auditGradingData() {
  try {
    const env = getEnv();
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    logger.info('🔍 AUDITING DATA AVAILABILITY FOR GRADING SYSTEM');
    logger.info('='.repeat(70));

    // Check database schema - what tables exist
    logger.info('\n📋 CHECKING DATABASE SCHEMA:');
    logger.info('-'.repeat(50));
    
    const tablesOfInterest = [
      'raw_props', 'games', 'player_stats', 'team_stats', 'injuries', 
      'matchups', 'weather', 'vegas_lines', 'public_betting', 'sharp_money',
      'line_movements', 'steam_moves', 'player_game_logs', 'dvp_rankings'
    ];

    for (const tableName of tablesOfInterest) {
      try {
        const { count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (count !== null) {
          logger.success(`✅ ${tableName}: ${count} records`);
        } else {
          logger.error(`❌ ${tableName}: No data or access issues`);
        }
      } catch (error) {
        logger.error(`❌ ${tableName}: Table doesn't exist`);
      }
    }

    // Deep dive into available data structures
    logger.info('\n🔍 DETAILED DATA ANALYSIS:');
    logger.info('-'.repeat(50));

    // Check raw_props structure 
    const { data: rawPropsSample } = await supabase
      .from('raw_props')
      .select('*')
      .limit(1);

    if (rawPropsSample?.[0]) {
      logger.info('📊 RAW_PROPS TABLE STRUCTURE:');
      Object.keys(rawPropsSample[0]).forEach(key => {
        const value = rawPropsSample[0][key];
        logger.info(`  ${key}: ${typeof value} ${value === null ? '(NULL)' : ''}`);
      });
    }

    // Check if we have actual games data
    try {
      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .gte('game_date', '2025-08-10')
        .limit(3);

      if (gamesData?.length) {
        logger.success('\n✅ GAMES DATA AVAILABLE:');
        gamesData.forEach((game, i) => {
          logger.info(`Game ${i+1}: ${JSON.stringify(game, null, 2)}`);
        });
      }
    } catch (error) {
      logger.error('\n❌ GAMES DATA: Not available');
    }

    // Check for player performance data
    try {
      const { data: playerData } = await supabase
        .from('player_stats')
        .select('*')
        .limit(3);

      if (playerData?.length) {
        logger.success('\n✅ PLAYER STATS DATA AVAILABLE:');
        logger.info('Sample player stats structure:');
        logger.info(JSON.stringify(playerData[0], null, 2));
      }
    } catch (error) {
      logger.error('\n❌ PLAYER STATS: Not available');
    }

    // Analysis of what we're missing for grading
    logger.info('\n🎯 GRADING SYSTEM DATA GAP ANALYSIS:');
    logger.info('='.repeat(70));

    const gradingRequirements = {
      'Player Form (L3/L5/L10)': 'Need recent player performance data',
      'DVP Analysis': 'Need defense vs position rankings',  
      'Matchup Ratings': 'Need team vs team historical data',
      'Line Movement': 'Need historical line tracking',
      'Steam Detection': 'Need real-time line monitoring',
      'Sharp Money': 'Need betting volume/money tracking',
      'Public Betting': 'Need public betting percentages',
      'Injury Impact': 'Need injury reports and impact analysis',
      'Weather Impact': 'Need weather data for outdoor games',
      'Venue Advantage': 'Need home/away performance splits'
    };

    Object.entries(gradingRequirements).forEach(([requirement, description]) => {
      logger.warn(`⚠️  MISSING: ${requirement}`);
      logger.info(`   Required: ${description}`);
    });

    logger.info('\n🚨 CURRENT GRADING SYSTEM ISSUE:');
    logger.error('❌ Using dummy/hardcoded values instead of real data analysis');
    logger.error('❌ This makes the sophisticated 52+ point system meaningless');
    logger.error('❌ All grades are essentially random without proper data inputs');

    logger.info('\n🎯 RECOMMENDED FIXES:');
    logger.success('1. Build player form calculation from historical props');
    logger.success('2. Create DVP analysis from team defensive stats');
    logger.success('3. Implement real matchup rating calculations');
    logger.success('4. Add line movement tracking to raw_props');
    logger.success('5. Replace all dummy values with calculated analytics');

  } catch (error) {
    logger.error('❌ Data audit failed:', error);
    throw error;
  }
}

if (require.main === module) {
  auditGradingData()
    .then(() => {
      console.log('\n✅ Data audit completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Data audit failed:', error);
      process.exit(1);
    });
}

export { auditGradingData };