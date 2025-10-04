#!/usr/bin/env node
/**
 * Start Real-Time Polling for MLB Props
 * Activates 30-60 second polling intervals for automated ingestion
 */

import { RealTimeFeedService } from '../services/RealTimeFeedService';
import { logger } from '../shared/logger';

async function startRealtimePolling() {
  logger.info('🚀 Starting real-time polling service...');

  // Initialize with 60-second poll interval
  const pollInterval = parseInt(process.env.POLL_INTERVAL || '60000'); // 60 seconds default
  const feedService = new RealTimeFeedService(pollInterval);

  try {
    // Start polling for all enabled sports (MLB, NFL, WNBA)
    await feedService.startPolling();

    logger.info('✅ Real-time polling activated', {
      pollInterval: `${pollInterval / 1000}s`,
      sports: ['mlb', 'nfl', 'wnba'],
    });

    // Keep the process alive
    process.on('SIGINT', async () => {
      logger.info('🛑 Stopping real-time polling...');
      await feedService.stopPolling();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑 Stopping real-time polling...');
      await feedService.stopPolling();
      process.exit(0);
    });

    // Log status every 5 minutes
    setInterval(() => {
      const status = feedService.getStatus();
      logger.info('📊 Polling status', status);
    }, 5 * 60 * 1000);

  } catch (error) {
    logger.error('❌ Failed to start real-time polling', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  startRealtimePolling().catch((error) => {
    logger.error('Fatal error starting polling', { error });
    process.exit(1);
  });
}

export { startRealtimePolling };
