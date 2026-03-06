import 'dotenv/config';
import { Worker, NativeConnection } from '@temporalio/worker';

// Import base activities
import * as healthMonitoringActivities from './activities/healthMonitoring';
import * as mainOperatorActivities from './activities/operator';
import * as workflowLoggingActivities from './activities/workflowLogging';
// Import agent-specific activities
import * as alertActivities from './agents/AlertAgent/activities';
import * as analyticsActivities from './agents/AnalyticsAgent/activities/index';
import * as auditActivities from './agents/AuditAgent/activities';
import * as baseActivities from './agents/BaseAgent/activities';
// SPRINT-REPO-TRUTH-LOCK-002: CampaignAgent/ContestAgent archived to _archived/
import * as feedActivities from './agents/FeedAgent/activities';
import * as gradingActivities from './agents/GradingAgent/activities';
import * as notificationActivities from './agents/NotificationAgent/activities';
import * as operatorActivities from './agents/OperatorAgent/activities';
import * as playerEnrichmentActivities from './agents/PlayerEnrichmentAgent/activities';
import * as recapActivities from './agents/RecapAgent/activities/index';
import { enforceFailClosedBoot } from './lib/enforcement';
import startAllWorkflows from './scripts/start-all-workflows';
import { agentHealthHeartbeat } from './services/agentHealthHeartbeat';
import { ErrorHandler } from './utils/errorHandling';
import { getEnv } from './utils/getEnv';
import { createLogger } from './utils/logger';

const env = getEnv();
const logger = createLogger('Worker');
const errorHandler = new ErrorHandler();

// eslint-disable-next-line max-lines-per-function -- Activity registration requires consolidated listing
export default async function startWorker() {
  try {
    logger.info(`Connecting to Temporal server at: ${env.TEMPORAL_SERVER_URL}`);

    // Create a connection to Temporal server with retry logic
    const connection = await NativeConnection.connect({
      address: env.TEMPORAL_SERVER_URL,
    });

    logger.info('Temporal connection established successfully');

    const worker = await Worker.create({
      connection,
      workflowsPath: require.resolve('./workflows'),
      activities: {
        // Register base activities
        ...baseActivities,
        ...healthMonitoringActivities,
        ...mainOperatorActivities,
        ...workflowLoggingActivities,

        // Register agent-specific activities
        ...analyticsActivities,
        ...notificationActivities,
        ...feedActivities,
        ...auditActivities,
        ...gradingActivities,
        ...alertActivities,
        ...operatorActivities,
        ...playerEnrichmentActivities,
        ...recapActivities,
      },
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      // Add worker-specific configuration for stability
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 10,
    });

    // Start the worker in the background
    const workerPromise = worker.run();

    logger.info('Worker started successfully');

    // Start agent health heartbeats
    await agentHealthHeartbeat.startHeartbeat({ agentName: 'temporal-worker' });
    await agentHealthHeartbeat.startHeartbeat({ agentName: 'bridge-worker' });
    logger.info('Agent health heartbeats started');

    // Auto-start workflows after worker is ready
    logger.info('🚀 Auto-starting Unit Talk workflows...');

    // Give worker a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      await startAllWorkflows({ criticalOnly: false });
      logger.info('✅ All workflows started successfully');
    } catch (error) {
      logger.error('⚠️ Some workflows failed to start, but worker will continue:', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the worker if workflows fail to start - they can be started manually
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down worker...');
      agentHealthHeartbeat.stopAll();
      await worker.shutdown();
      await connection.close();
      process.exit(0);
    });

    // SPRINT-SYNDICATE-CLEANUP-006: Don't block on workerPromise here.
    // The worker runs in the background. If we await here, subsequent
    // startup code in index.ts (BridgeWorker, etc.) never runs.
    // Handle worker errors separately.
    workerPromise.catch(error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Worker encountered error:', { err: errorMessage });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to start worker:', { err: errorMessage });
    await errorHandler.handleError(error instanceof Error ? error : new Error(errorMessage));
    throw error;
  }
}

// If this file is run directly, start the worker
// PHASE_9B: Enforce fail-closed boot before any business logic
if (require.main === module) {
  enforceFailClosedBoot();
  startWorker().catch(async error => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Unhandled error:', { error: errorMessage });
    await errorHandler.handleError(error instanceof Error ? error : new Error(errorMessage));
    process.exit(1);
  });
}
