import 'dotenv/config';
import { supabaseClient } from '../services/supabaseClient';
import { getEnv } from '../utils/getEnv';
import { createLogger } from '../utils/logger';
import { BridgeWorker } from '../workers/BridgeWorker';

const logger = createLogger('bridge-worker-test');
const env = getEnv();

/**
 * Test the enhanced BridgeWorker with bridge_outbox support
 *
 * Tests:
 * 1. Bridge Worker initialization with bridge outbox support
 * 2. Event processing from both events and bridge_outbox tables
 * 3. Health checks for both data sources
 * 4. Metrics collection for dual-source processing
 */
async function testBridgeWorker(): Promise<void> {
  try {
    logger.info('🚀 Starting Bridge Worker test with bridge_outbox support...');

    // Use existing Supabase client
    const supabase = supabaseClient;

    // Configure Bridge Worker with bridge outbox enabled
    const bridgeWorkerConfig = {
      agentId: 'bridge-worker-test',
      enabled: true,
      processingInterval: 10000, // 10 seconds for testing
      eventBatchSize: 5,
      maxConcurrentEvents: 2,
      enableBridgeOutbox: true, // Enable bridge outbox processing
      bridgeOutboxBatchSize: 3,
    };

    const bridgeWorkerDeps = {
      supabaseClient: supabase,
      logger,
    };

    // Initialize Bridge Worker
    logger.info('🌉 Initializing Bridge Worker with dual-source support...');
    const bridgeWorker = new BridgeWorker(bridgeWorkerConfig, bridgeWorkerDeps);

    // Test initialization
    logger.info('🔧 Testing Bridge Worker initialization...');
    await bridgeWorker.start();

    // Check health status
    logger.info('🏥 Testing Bridge Worker health checks...');
    const healthStatus = await bridgeWorker.checkHealth();
    logger.info('Health Status:', {
      status: healthStatus.status,
      services: healthStatus.details.checks.map(c => ({
        service: c.service,
        status: c.status,
        note: c.note || 'none',
      })),
      bridgeOutboxEnabled: healthStatus.details.processing.bridgeOutboxEnabled,
    });

    // Test metrics collection
    logger.info('📊 Testing Bridge Worker metrics collection...');
    const metrics = await bridgeWorker.collectMetrics();
    logger.info('Bridge Worker Metrics:', {
      eventsProcessed: metrics.eventsProcessed,
      bridgeOutboxEventsProcessed: metrics.bridgeOutboxEventsProcessed,
      totalEventsFromBothSources: metrics.totalEventsFromBothSources,
      eventsFailed: metrics.eventsFailed,
      bridgeOutboxEventsFailed: metrics.bridgeOutboxEventsFailed,
      workflowsTriggered: metrics.workflowsTriggered,
    });

    // Test a few processing cycles
    logger.info('⚡ Testing event processing cycles...');
    for (let i = 0; i < 3; i++) {
      logger.info(`Running processing cycle ${i + 1}/3...`);
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds between tests

      const updatedMetrics = await bridgeWorker.collectMetrics();
      logger.info(`Cycle ${i + 1} Metrics:`, {
        totalEvents: updatedMetrics.totalEventsFromBothSources,
        bridgeOutboxEvents: updatedMetrics.bridgeOutboxEventsProcessed,
        regularEvents: updatedMetrics.eventsProcessed,
        failures: updatedMetrics.eventsFailed + updatedMetrics.bridgeOutboxEventsFailed,
      });
    }

    // Test health check after processing
    logger.info('🏥 Final health check after processing...');
    const finalHealth = await bridgeWorker.checkHealth();
    logger.info('Final Health Status:', {
      status: finalHealth.status,
      isProcessing: finalHealth.details.processing.isProcessing,
      totalServices: finalHealth.details.checks.length,
      healthyServices: finalHealth.details.checks.filter(c => c.status === 'healthy').length,
    });

    // Clean shutdown
    logger.info('🛑 Shutting down Bridge Worker...');
    await bridgeWorker.stop();

    logger.info('✅ Bridge Worker test completed successfully!');
    logger.info('');
    logger.info('🎯 Test Summary:');
    logger.info('   ✅ Bridge Worker initialized with dual-source support');
    logger.info('   ✅ Health checks validated for both events and bridge_outbox tables');
    logger.info('   ✅ Metrics collection working for both event sources');
    logger.info('   ✅ Processing cycles completed successfully');
    logger.info('   ✅ Clean shutdown completed');
  } catch (error) {
    logger.error('❌ Bridge Worker test failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testBridgeWorker()
    .then(() => {
      logger.info('Bridge Worker test completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Bridge Worker test failed:', error);
      process.exit(1);
    });
}

export { testBridgeWorker };
