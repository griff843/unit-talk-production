import 'dotenv/config';
import { Worker } from '@temporalio/worker';
import { getEnv } from './utils/getEnv';
import { createClient } from '@supabase/supabase-js';
import { ErrorHandler } from './utils/errorHandling';
import { Logger } from './utils/logger';

// Import base activities
import * as baseActivities from './agents/BaseAgent/activities';

// Import agent-specific activities
import * as analyticsActivities from './agents/AnalyticsAgent/activities';
import * as notificationActivities from './agents/NotificationAgent/activities';
import * as feedActivities from './agents/FeedAgent/activities';
import * as auditActivities from './agents/AuditAgent/activities';
import * as gradingActivities from './agents/GradingAgent/activities';
import * as alertActivities from './agents/AlertAgent/activities';
import * as promoActivities from './agents/PromoAgent/activities';
import * as contestActivities from './agents/ContestAgent/activities';
import * as operatorActivities from './agents/OperatorAgent/activities';

const env = getEnv();
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const logger = new Logger('Worker');
const errorHandler = new ErrorHandler('Worker', supabase);

async function run() {
  try {
    const worker = await Worker.create({
      workflowsPath: require.resolve('./workflows'),
      activities: {
        // Register base activities
        ...baseActivities,

        // Register agent-specific activities
        ...analyticsActivities,
        ...notificationActivities,
        ...feedActivities,
        ...auditActivities,
        ...gradingActivities,
        ...alertActivities,
        ...promoActivities,
        ...contestActivities,
        ...operatorActivities
      },
      taskQueue: env.TEMPORAL_TASK_QUEUE
    });

    await worker.run();

    logger.info('Worker started successfully');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down worker...');
      await worker.shutdown();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start worker:', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

run().catch((error) => {
  logger.error('Unhandled error:', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
