import { Worker } from '@temporalio/worker';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/errorHandling';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import all agent activities
import * as analyticsActivities from './agents/AnalyticsAgent/activities';
import * as gradingActivities from './agents/GradingAgent/activities';
import * as contestActivities from './agents/ContestAgent/activities';
import * as alertActivities from './agents/AlertAgent/activities';
import * as promoActivities from './agents/PromoAgent/activities';
import * as notificationActivities from './agents/NotificationAgent/activities';
import * as feedActivities from './agents/FeedAgent/activities';
import * as operatorActivities from './agents/OperatorAgent/activities';
import * as auditActivities from './agents/AuditAgent/activities';

// Initialize logger and error handler
const logger = new Logger('TemporalWorker');
const errorHandler = ErrorHandler.getInstance();

async function run() {
  try {
    logger.info('Initializing Temporal worker...');

    const worker = await Worker.create({
      workflowsPath: require.resolve('./workflows'),
      activities: {
        ...analyticsActivities,
        ...gradingActivities,
        ...contestActivities,
        ...alertActivities,
        ...promoActivities,
        ...notificationActivities,
        ...feedActivities,
        ...operatorActivities,
        ...auditActivities,
      },
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'unit-talk-main',
      // Add worker options for better reliability
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 50,
      // Add shutdown grace period
      shutdownGraceTime: '30 seconds',
    });

    // Register shutdown handlers
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT. Shutting down worker...');
      await worker.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM. Shutting down worker...');
      await worker.shutdown();
      process.exit(0);
    });

    // Start the worker
    logger.info('Starting Temporal worker...');
    await worker.run();
    logger.info('Temporal worker started successfully!');
  } catch (error) {
    logger.error('Failed to start worker:', error);
    await errorHandler.handleError(error, {
      context: 'worker_startup',
      severity: 'critical'
    });
    process.exit(1);
  }
}

// Run the worker
run();
