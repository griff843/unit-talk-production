import 'dotenv/config';
import { loadBaseAgentDependencies } from '../agents/BaseAgent/loadDeps';
import { ScoringAgent } from '../agents/ScoringAgent';
import { scoringAgentConfig } from '../config/agentConfig';
import { startMetricsServer } from '../services/metricsServer';
import { logger } from '../utils/logger';
import { agentRunner } from '../services/agentRunner.js';
import { creditLogger } from '../services/creditLogger.js';
import { cacheClient } from '../services/cacheClient.js';

async function main(): Promise<void> {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'production';
  const batch = parseInt(args.find(arg => arg.startsWith('--batch='))?.split('=')[1] || '50', 10);

  // Start agent run tracking
  const runId = agentRunner.beginRun('ScoringAgent', { mode, batch });

  try {
    logger.info(`🚀 Starting ScoringAgent (${mode} mode, batch: ${batch})...`);

    // Initialize credit logger
    creditLogger.beginRun('scoring');

    // Load dependencies
    const deps = await loadBaseAgentDependencies();

    // Start metrics server if enabled
    if (scoringAgentConfig.metrics?.enabled) {
      const port = scoringAgentConfig.metrics.port || 9004;
      startMetricsServer(port);
      logger.info(`🚦 Prometheus metrics server running at http://localhost:${port}/metrics`);
    }

    // Create and run agent with Enhanced45Factor scoring
    logger.info('🎯 Initializing Enhanced45Factor engine (195-factor scoring)...');
    const agent = new ScoringAgent(scoringAgentConfig, deps);

    // Run agent with mode awareness
    if (mode === 'shadow') {
      logger.info('🌒 Running in shadow mode (simulation)...');
    }

    await agent.run();

    // Update agent runner with success
    agentRunner.updateSummary({ processed: batch, noOps: 0 });

    // Flush credits and cache stats
    await creditLogger.flush();
    cacheClient.exportStats();

    // End successful run
    const reportPath = await agentRunner.endRun(true);
    logger.info(`📋 Run report: ${reportPath}`);

    logger.info('✅ ScoringAgent completed successfully');
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Record error in agent runner
    agentRunner.recordError(errorMessage);

    logger.error('❌ ScoringAgent execution failed', {
      err: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    });

    try {
      // Flush credits and generate error report
      await creditLogger.flush();
      const reportPath = await agentRunner.endRun(false);
      logger.info(`📋 Error report: ${reportPath}`);
    } catch (reportError) {
      logger.error('Failed to write error report:', reportError);
    }

    // Exit 0 on no-data conditions for stability
    if (errorMessage.includes('no data') || errorMessage.includes('nothing to score')) {
      logger.info('ℹ️ No picks to score, this is not an error condition');
      process.exit(0);
    }

    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { 
    promise: promise.toString(), 
    reason: reason instanceof Error ? reason.message : String(reason)
  });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the application
main();