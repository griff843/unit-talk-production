import 'dotenv/config';
import { logger } from '../utils/logger';
import ScoringAgent from '../agents/ScoringAgent';
import { scoringAgentConfig } from '../config/agentConfig';
import { loadBaseAgentDependencies } from '../agents/BaseAgent/loadDeps';
import { startMetricsServer } from '../services/metricsServer';

async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting ScoringAgent...');

    // Load dependencies
    const deps = await loadBaseAgentDependencies();
    
    // Start metrics server if enabled
    if (scoringAgentConfig.metrics?.enabled) {
      const port = scoringAgentConfig.metrics.port || 9004;
      startMetricsServer(port);
      logger.info(`🚦 Prometheus metrics server running at http://localhost:${port}/metrics`);
    }

    // Create and run agent
    const agent = new ScoringAgent(scoringAgentConfig, deps);
    await agent.run();
    
    logger.info('✅ ScoringAgent completed successfully');
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('❌ ScoringAgent execution failed', { 
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    });
    
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