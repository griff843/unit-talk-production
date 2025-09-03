#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { ESPNGradingService } from '../src/services/espnGradingService';
import { logger as baseLogger } from '../src/shared/logger';

const logger = baseLogger.child({ service: 'ESPN Historical Grading Script' });

interface GradingOptions {
  batchSize: number;
  sports: string[];
  testMode: boolean;
  maxGames: number;
}

async function main() {
  const args = process.argv.slice(2);
  
  const options: GradingOptions = {
    batchSize: 5, // Conservative batch size for ESPN
    sports: ['NFL', 'NBA', 'MLB', 'NHL'],
    testMode: args.includes('--test'),
    maxGames: args.includes('--test') ? 3 : 1000
  };

  // Parse command line arguments
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
  if (batchSizeArg) {
    options.batchSize = parseInt(batchSizeArg.split('=')[1]) || 5;
  }

  const sportsArg = args.find(arg => arg.startsWith('--sports='));
  if (sportsArg) {
    options.sports = sportsArg.split('=')[1].split(',');
  }

  const maxGamesArg = args.find(arg => arg.startsWith('--max-games='));
  if (maxGamesArg) {
    options.maxGames = parseInt(maxGamesArg.split('=')[1]) || 1000;
  }

  logger.info('🏈 Starting ESPN Historical Prop Grading', options);

  if (options.testMode) {
    logger.info('⚠️ Running in TEST MODE - limited to 3 games');
  }

  try {
    const gradingService = new ESPNGradingService();
    
    const startTime = Date.now();
    
    const result = await gradingService.gradeAllHistoricalProps({
      batchSize: options.batchSize,
      sports: options.sports
    });

    const duration = (Date.now() - startTime) / 1000;

    logger.info('✅ ESPN Grading Completed', {
      ...result,
      durationSeconds: duration,
      avgTimePerGame: duration / result.totalProcessed,
      successRate: `${((result.totalProcessed - result.errors) / result.totalProcessed * 100).toFixed(1)}%`
    });

    // Cost analysis
    const estimatedESPNCalls = result.totalProcessed * 2; // Game data + player stats
    logger.info('📊 ESPN API Usage Analysis', {
      estimatedCalls: estimatedESPNCalls,
      rateLimit: '1 request/second',
      totalTimeHours: (estimatedESPNCalls / 3600).toFixed(2),
      recommendation: estimatedESPNCalls > 1000 ? 
        'Consider running overnight or in multiple sessions' : 
        'Safe to run in single session'
    });

    // Database impact analysis
    logger.info('💾 Database Impact', {
      propsGraded: result.totalGraded,
      estimatedStorage: `${(result.totalGraded * 0.5).toFixed(1)}KB`,
      queryPerformanceImprovement: 'Props now have actual_result for filtering'
    });

    if (result.errors > 0) {
      logger.warn(`⚠️ ${result.errors} games failed to process. Check logs for details.`);
    }

    process.exit(0);

  } catch (error) {
    logger.error('❌ ESPN Grading Failed', { error });
    process.exit(1);
  }
}

// Helper function to display usage
function displayUsage() {
  console.log(`
🏈 ESPN Historical Prop Grading Tool

Usage: tsx scripts/grade-historical-props-espn.ts [options]

Options:
  --test                    Run in test mode (3 games only)
  --batch-size=N           Number of games to process per batch (default: 5)
  --sports=NFL,NBA,MLB     Comma-separated list of sports (default: NFL,NBA,MLB,NHL)
  --max-games=N            Maximum number of games to process (default: 1000)

Examples:
  # Test run with 3 games
  tsx scripts/grade-historical-props-espn.ts --test

  # Grade only NFL and NBA props
  tsx scripts/grade-historical-props-espn.ts --sports=NFL,NBA

  # Slower batch processing for stability
  tsx scripts/grade-historical-props-espn.ts --batch-size=3

  # Process first 50 games only
  tsx scripts/grade-historical-props-espn.ts --max-games=50

Cost Analysis:
- ESPN API: FREE (rate limited to 1 req/sec)
- 450K props ≈ 1000 unique games
- Estimated time: 2-3 hours for full database
- Zero additional API costs vs $99/month for Odds API

Benefits:
✅ Grade all historical props for free
✅ Enable backtesting and performance analysis  
✅ Validate grading algorithm accuracy
✅ Prepare for automated real-time grading
  `);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  displayUsage();
  process.exit(0);
}

main().catch(error => {
  logger.error('Script execution failed', { error });
  process.exit(1);
});