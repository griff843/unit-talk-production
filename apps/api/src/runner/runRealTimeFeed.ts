/**
 * Real-Time Feed Polling Runner
 *
 * Starts the real-time feed service with 30-second polling
 * for NFL, MLB, and WNBA markets
 *
 * Usage:
 *   npx tsx src/runner/runRealTimeFeed.ts
 *   npx tsx src/runner/runRealTimeFeed.ts --interval=60
 */

import { realTimeFeedService } from '../services/RealTimeFeedService';
import { logger } from '../shared/logger';

interface RunnerOptions {
  interval?: number; // Poll interval in seconds
  sports?: string[]; // Specific sports to enable
}

function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  const options: RunnerOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--interval=')) {
      options.interval = parseInt(arg.split('=')[1]) * 1000; // Convert to ms
    } else if (arg.startsWith('--sports=')) {
      options.sports = arg.split('=')[1].split(',');
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  logger.info('='.repeat(60));
  logger.info('🚀 Real-Time Feed Service');
  logger.info('='.repeat(60));
  logger.info('Configuration:', {
    pollInterval: options.interval ? `${options.interval / 1000}s` : '30s (default)',
    sports: options.sports || ['nfl', 'mlb', 'wnba'],
    creditsAvailable: '5,000,000/month',
    plan: '$119/month Odds API',
  });
  logger.info('='.repeat(60));

  // Configure specific sports if requested
  if (options.sports) {
    const allSports = ['nfl', 'mlb', 'wnba'];
    for (const sport of allSports) {
      const enabled = options.sports.includes(sport);
      realTimeFeedService.setSportEnabled(sport, enabled);
    }
  }

  // Start polling
  await realTimeFeedService.startPolling();

  // Log status every 60 seconds
  setInterval(() => {
    const status = realTimeFeedService.getStatus();
    logger.info('📊 Polling Status:', {
      activeSports: status.activeSports,
      summaries: status.summaries.map(s => ({
        sport: s.sport,
        lastPoll: s.lastPoll.toISOString(),
        propsProcessed: s.propsProcessed,
        gamesUpdated: s.gamesUpdated,
        errors: s.errors.length,
      })),
    });
  }, 60 * 1000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\n⚠️  Received SIGINT, shutting down gracefully...');
    realTimeFeedService.stopPolling();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('\n⚠️  Received SIGTERM, shutting down gracefully...');
    realTimeFeedService.stopPolling();
    process.exit(0);
  });

  logger.info('✅ Real-Time Feed Service started. Press Ctrl+C to stop.');
  logger.info('📊 Status updates every 60 seconds');
}

main().catch(error => {
  logger.error('Fatal error in Real-Time Feed Service:', error);
  process.exit(1);
});