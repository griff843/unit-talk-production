import 'dotenv/config';
import { BridgeWorker } from './src/workers/BridgeWorker';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from './src/utils/logger';
import { getEnv } from './src/utils/getEnv';

const logger = createLogger('bridge-worker-production');
const env = getEnv();

/**
 * Production BridgeWorker startup script
 *
 * This starts the BridgeWorker with production Supabase credentials to process
 * bridge_outbox events from smart form submissions and route them to Discord.
 */
async function startProductionBridgeWorker(): Promise<void> {
  try {
    logger.info('🚀 Starting Production Bridge Worker...');

    // Create Supabase client with production credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Test Supabase connection
    logger.info('🔗 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('bridge_outbox')
      .select('count')
      .limit(1);

    if (testError) {
      throw new Error(`Supabase connection failed: ${testError.message}`);
    }

    logger.info('✅ Supabase connection verified');

    // Configure Bridge Worker for production
    const bridgeWorkerConfig = {
      agentId: 'bridge-worker-production',
      enabled: true,
      processingInterval: 10000, // 10 seconds
      eventBatchSize: 10,
      maxConcurrentEvents: 5,
      enableBridgeOutbox: true,
      bridgeOutboxBatchSize: 5,
    };

    const bridgeWorkerDeps = {
      supabaseClient: supabase,
      logger,
    };

    // Initialize and start Bridge Worker
    logger.info('🌉 Initializing Production Bridge Worker...');
    const bridgeWorker = new BridgeWorker(bridgeWorkerConfig, bridgeWorkerDeps);

    // Start the worker
    logger.info('🚀 Starting Bridge Worker...');
    await bridgeWorker.start();

    // Check initial health
    const healthStatus = await bridgeWorker.checkHealth();
    logger.info('🏥 Bridge Worker Health Status:', {
      status: healthStatus.status,
      bridgeOutboxEnabled: healthStatus.details?.processing?.bridgeOutboxEnabled,
      healthyServices: healthStatus.details?.checks?.filter(c => c.status === 'healthy').length || 0,
      totalServices: healthStatus.details?.checks?.length || 0,
    });

    if (healthStatus.status === 'unhealthy') {
      logger.warn('⚠️ Bridge Worker is unhealthy but continuing...');
    }

    // Log initial metrics
    const metrics = await bridgeWorker.collectMetrics();
    logger.info('📊 Initial Bridge Worker Metrics:', {
      eventsProcessed: metrics.eventsProcessed,
      bridgeOutboxEventsProcessed: metrics.bridgeOutboxEventsProcessed,
      totalEventsFromBothSources: metrics.totalEventsFromBothSources,
    });

    logger.info('✅ Production Bridge Worker started successfully!');
    logger.info('🔄 Bridge Worker is now processing bridge_outbox events...');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 Received SIGINT, shutting down Bridge Worker...');
      await bridgeWorker.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, shutting down Bridge Worker...');
      await bridgeWorker.stop();
      process.exit(0);
    });

    // Log periodic health checks every 5 minutes
    setInterval(async () => {
      try {
        const currentHealth = await bridgeWorker.checkHealth();
        const currentMetrics = await bridgeWorker.collectMetrics();

        logger.info('🔄 Bridge Worker Status Check:', {
          status: currentHealth.status,
          isProcessing: currentHealth.details?.processing?.isProcessing,
          totalEventsProcessed: currentMetrics.totalEventsFromBothSources,
          bridgeOutboxEvents: currentMetrics.bridgeOutboxEventsProcessed,
          failures: currentMetrics.eventsFailed + currentMetrics.bridgeOutboxEventsFailed,
        });
      } catch (error) {
        logger.error('❌ Health check failed:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Keep the process alive
    logger.info('🔄 Bridge Worker is running. Press Ctrl+C to stop.');

    // Infinite loop to keep process alive
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

  } catch (error) {
    logger.error('❌ Failed to start Production Bridge Worker:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Start the production bridge worker if this file is executed directly
if (require.main === module) {
  startProductionBridgeWorker()
    .catch((error) => {
      logger.error('Production Bridge Worker failed:', error);
      process.exit(1);
    });
}

export { startProductionBridgeWorker };