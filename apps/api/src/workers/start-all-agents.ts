import 'dotenv/config';
import { Worker } from '@temporalio/worker';

import * as alertActivities from '../agents/AlertAgent/activities';
import * as analyticsActivities from '../agents/AnalyticsAgent/activities';
import * as auditActivities from '../agents/AuditAgent/activities';
import * as baseActivities from '../agents/BaseAgent/activities';
import * as feedActivities from '../agents/FeedAgent/activities';
import * as gradingActivities from '../agents/GradingAgent/activities';
import * as notificationActivities from '../agents/NotificationAgent/activities';
import * as operatorActivities from '../agents/OperatorAgent/activities';
import * as playerEnrichmentActivities from '../agents/PlayerEnrichmentAgent/activities';
// SPRINT-REPO-TRUTH-LOCK-002: Archived experimental agents moved to _archived/
import { enforceFailClosedBoot } from '../lib/enforcement';
import { ErrorHandler } from '../utils/errorHandling';
import { createLogger } from '../utils/logger';

// Import additional agent activities (mock imports for agents without activities yet)
// These agents will need activity implementations for full Temporal integration
// import * as dataActivities from '../agents/DataAgent/activities';
// FinalizerAgent removed - obsolete v2.0 tables
// import * as ingestionActivities from '../agents/IngestionAgent/activities';
// import * as marketingActivities from '../agents/MarketingAgent/activities';
// import * as recapActivities from '../agents/RecapAgent/activities';
// import * as scoringActivities from '../agents/ScoringAgent/activities';

// const env = getEnv();
const logger = createLogger('MasterWorker');
const errorHandler = new ErrorHandler();

// eslint-disable-next-line max-lines-per-function -- Worker requires consolidated activity registration
export default async function startAllAgents() {
  try {
    logger.info('Starting master Temporal worker with all agents...');

    // SPRINT-REPO-TRUTH-LOCK-002: Production agents only (experimental archived)
    logger.info('Loading production agent system:', {
      businessAgents: ['GradingAgent', 'AnalyticsAgent', 'AlertAgent', 'FeedAgent', 'RecapAgent'],
      operationalAgents: [
        'NotificationAgent',
        'PlayerEnrichmentAgent',
        'AuditAgent',
        'OperatorAgent',
      ],
    });

    const worker = await Worker.create({
      workflowsPath: require.resolve('../workflows'),
      activities: {
        // Register base activities
        ...baseActivities,

        // Register all agent-specific activities
        ...alertActivities,
        ...analyticsActivities,
        ...auditActivities,
        ...feedActivities,
        ...gradingActivities,
        ...notificationActivities,
        ...operatorActivities,
        ...playerEnrichmentActivities,
      },
      taskQueue: 'unit-talk-main',

      // Enhanced configuration for production use
      maxConcurrentActivityTaskExecutions: 100,
      maxConcurrentWorkflowTaskExecutions: 100,
      maxConcurrentLocalActivityExecutions: 100,
      maxTaskQueueActivitiesPerSecond: 200,
      maxActivitiesPerSecond: 200,
    });

    logger.info('Master worker created successfully, starting to process tasks...');

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      try {
        await worker.shutdown();
        logger.info('Worker shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during worker shutdown:', { error });
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async error => {
      logger.error('Uncaught exception:', { error: error.message, stack: error.stack });
      await errorHandler.handleError(error);
      await worker.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled rejection at:', { promise, reason });
      const error = reason instanceof Error ? reason : new Error(String(reason));
      await errorHandler.handleError(error);
      await worker.shutdown();
      process.exit(1);
    });

    // Start the worker
    await worker.run();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to start master worker:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    await errorHandler.handleError(error instanceof Error ? error : new Error(errorMessage));

    // Attempt graceful shutdown
    process.exit(1);
  }
}

// If this file is run directly, start the worker
// PHASE_9B: Enforce fail-closed boot before any business logic
if (require.main === module) {
  enforceFailClosedBoot();
  logger.info('Starting Unit Talk Master Worker...');
  logger.info('Task Queue: unit-talk-main');
  logger.info('Environment:', {
    nodeEnv: process.env.NODE_ENV,
    temporalAddress: process.env.TEMPORAL_ADDRESS,
    logLevel: process.env.LOG_LEVEL,
  });

  startAllAgents().catch(async error => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Unhandled error in master worker:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    await errorHandler.handleError(error instanceof Error ? error : new Error(errorMessage));
    process.exit(1);
  });
}
