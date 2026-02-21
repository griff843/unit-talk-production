import 'dotenv/config';
import { getEnv } from './utils/getEnv';
import { createLogger } from './utils/logger';

const logger = createLogger('Main');

// eslint-disable-next-line max-lines-per-function, complexity -- Main startup orchestrates multiple services
async function main() {
  try {
    logger.info('Starting Unit Talk Platform...');

    // Validate environment variables
    getEnv();
    logger.info('Environment variables loaded successfully');

    // Start both API server and Temporal worker in parallel
    logger.info('Starting API server and Temporal worker...');

    // Import and start the API server
    const { startServer } = await import('./api-server');
    const serverPromise = startServer();

    // Import and start the Temporal worker
    const { default: startWorker } = await import('./worker');
    const workerPromise = startWorker();

    // Wait for both to start
    await Promise.all([serverPromise, workerPromise]);

    logger.info('Unit Talk Platform started successfully - API server and Temporal worker running');

    // UNIFIED-OPS-002: Optionally initialize Temporal Schedules (ScheduleClient)
    // Fail-closed: disabled by default, requires ENABLE_TEMPORAL_SCHEDULES=true
    if (process.env.ENABLE_TEMPORAL_SCHEDULES === 'true') {
      try {
        const { initializeSyndicateScheduling } = await import('./workflows/schedule-manager');
        await initializeSyndicateScheduling();
        logger.info('Temporal Schedules initialized (ENABLE_TEMPORAL_SCHEDULES=true)');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Temporal Schedules initialization failed (non-fatal):', { err: msg });
      }
    } else {
      logger.info('Temporal Schedules SKIPPED (ENABLE_TEMPORAL_SCHEDULES not set to true)');
    }

    // UNIFIED-OPS-002 Step 3: Optionally start OpsEventConsumer (PICK_SETTLED → RECAP_REQUESTED)
    // Fail-closed: disabled by default, requires ENABLE_OPS_EVENT_CONSUMERS=true
    if (process.env.ENABLE_OPS_EVENT_CONSUMERS === 'true') {
      try {
        const { startOpsEventConsumer } = await import('./consumers/OpsEventConsumer');
        await startOpsEventConsumer();
        logger.info('OpsEventConsumer started (ENABLE_OPS_EVENT_CONSUMERS=true)');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('OpsEventConsumer failed to start (non-fatal):', { err: msg });
      }
    } else {
      logger.info('OpsEventConsumer SKIPPED (ENABLE_OPS_EVENT_CONSUMERS not set to true)');
    }

    // Optionally start SettlementAgent in manual/providerless mode
    if (process.env.SETTLEMENT_AGENT_ENABLED === 'true') {
      try {
        const { SettlementAgent } = await import('./agents/SettlementAgent');
        const { supabase } = await import('./services/supabaseClient');
        const settlementAgent = new SettlementAgent(
          {
            name: 'SettlementAgent',
            enabled: true,
            version: '1.0.0',
            logLevel: 'info',
            metrics: { enabled: true, interval: 60000 },
            retry: {
              maxRetries: 3,
              backoffMs: 1000,
              maxBackoffMs: 30000,
              enabled: true,
              maxAttempts: 3,
              backoff: 1000,
              exponential: true,
              jitter: true,
            },
            health: { enabled: true, interval: 30000, timeout: 5000 },
          },
          { logger, supabase }
        );
        await settlementAgent.start();
        logger.info('SettlementAgent started in manual/providerless mode');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('SettlementAgent failed to start (non-fatal):', { err: msg });
      }
    }

    // SPRINT-DISCORD-WORKER-AUTOSTART-087: Start DiscordTicketWorker
    // Polls ticket_discord_outbox and posts Discord embeds automatically.
    // Fail-closed: disabled by default, requires ENABLE_DISCORD_TICKET_WORKER=true
    if (process.env.ENABLE_DISCORD_TICKET_WORKER === 'true') {
      try {
        const { startDiscordTicketWorker } = await import('./consumers/DiscordTicketWorker');
        await startDiscordTicketWorker();
        logger.info('DiscordTicketWorker started (ENABLE_DISCORD_TICKET_WORKER=true)');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('DiscordTicketWorker failed to start (non-fatal):', { err: msg });
      }
    } else {
      logger.info('DiscordTicketWorker SKIPPED (ENABLE_DISCORD_TICKET_WORKER not set to true)');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to start Unit Talk Platform:', { err: errorMessage });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main().catch(error => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error('Unhandled error in main:', { error: errorMessage });
  process.exit(1);
});
