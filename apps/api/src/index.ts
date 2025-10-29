import 'dotenv/config';
import { getEnv } from './utils/getEnv';
import { rootLogger as log } from '../../shared/lib/logger';
import { validateEnvironment, logEnvironmentSummary } from './lib/env-validate';
import { initializeTracing } from './telemetry/otel';
import { startPublisherLoop, stopPublisherLoop } from './publish/worker';

const logger = log;

/**
 * Boot-time PostgREST schema reload (Charter-mandated)
 * Ensures canonical tables (picks, pick_publish) are visible via REST API
 *
 * MANDATORY when PICK_DRIVER=canonical
 */
async function handleBootTimeSchemaReload() {
  const pickDriver = process.env.PICK_DRIVER || 'unified';
  const schemaReloadEnabled = process.env.SCHEMA_RELOAD_ON_BOOT === 'true';

  // Make reload mandatory for canonical driver
  const shouldReload = schemaReloadEnabled || pickDriver === 'canonical';

  if (!shouldReload) {
    logger.info('Boot-time schema reload not required (PICK_DRIVER=unified, SCHEMA_RELOAD_ON_BOOT≠true)');
    return;
  }

  if (pickDriver === 'canonical') {
    logger.info('PICK_DRIVER=canonical detected - boot-time reload MANDATORY');
  }
  if (schemaReloadEnabled) {
    logger.info('SCHEMA_RELOAD_ON_BOOT=true - triggering PostgREST reload');
  }

  const { forcePostgrestReload, getPgRestState } = await import('./lib/pgrest-reload');
  const reloadResult = await forcePostgrestReload({ reason: 'boot', maxRetries: 1 });

  if (reloadResult.success) {
    logger.info('PostgREST schema reload successful', {
      attempt: reloadResult.attempt,
      lastReloadAt: reloadResult.lastReloadAt,
      pickDriver,
    });
  } else {
    logger.warn('PostgREST schema reload failed (continuing anyway)', {
      error: reloadResult.error,
      attempt: reloadResult.attempt,
      pickDriver,
    });
  }

  const pgrestState = getPgRestState();
  logger.info('PostgREST state after boot reload', { ...pgrestState, pickDriver });
}

/**
 * Start Temporal worker if configured
 */
async function startTemporalWorker() {
  if (!process.env.TEMPORAL_SERVER_URL) {
    logger.info('Temporal worker disabled (TEMPORAL_SERVER_URL not configured)');
    return;
  }

  try {
    logger.info('Starting Temporal worker...');
    const { default: startWorker } = await import('./worker');
    await startWorker();
    logger.info('Temporal worker started successfully');
  } catch (error) {
    logger.warn('Failed to start Temporal worker (continuing without it):', {
      err: error instanceof Error ? error.message : String(error),
    });
  }
}

async function main() {
  try {
    logger.info({ env: process.env.NODE_ENV }, 'api:start');

    // Initialize OpenTelemetry (optional)
    initializeTracing();

    // Validate environment variables with comprehensive checks
    const envValidation = validateEnvironment();
    logEnvironmentSummary();

    // Log validation results
    logger.info('Environment validation complete', {
      status: envValidation.status,
      missing: envValidation.missing.length,
      issues: envValidation.issues.length,
    });

    // Continue with startup even if degraded (graceful degradation)
    if (envValidation.status === 'degraded') {
      logger.warn('Starting with degraded environment configuration', {
        issues: envValidation.issues,
      });
    } else if (envValidation.status === 'critical') {
      logger.error('Critical environment validation failures detected', {
        missing: envValidation.missing,
        issues: envValidation.issues,
      });
      // In production, this is logged but system continues
      // Health endpoint will report degraded status
    }

    // Legacy validation for backward compatibility
    getEnv();
    logger.info('Environment variables validated');

    // Boot-time schema reload (Charter-mandated)
    await handleBootTimeSchemaReload();

    // Start API server
    logger.info('Starting API server...');

    // Import and start the API server
    const { startServer } = await import('./api-server');
    await startServer();

    logger.info('API server started successfully');

    // Start publisher worker if PUBLISH_MODE=outbox and enabled
    if (process.env.PUBLISH_MODE === 'outbox' && process.env.PUBLISHER_ENABLED !== 'false') {
      logger.info('Starting outbox publisher worker...');
      startPublisherLoop();
    }

    // Start Temporal worker if configured
    await startTemporalWorker();

    logger.info('Unit Talk Platform started successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Failed to start Unit Talk Platform:', { err: errorMessage, stack: errorStack });
    console.error('FATAL ERROR:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  stopPublisherLoop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  stopPublisherLoop();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  const errorStack = reason instanceof Error ? reason.stack : undefined;

  logger.error('Unhandled Promise Rejection', {
    reason: errorMessage,
    stack: errorStack,
    promise: promise.toString(),
  });

  // Log to console for visibility
  console.error('UNHANDLED PROMISE REJECTION:', reason);

  // DO NOT exit process - allow graceful degradation
  // System continues with degraded functionality
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error, origin: string) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    origin,
    name: error.name,
  });

  // Log to console for visibility
  console.error('UNCAUGHT EXCEPTION:', error);

  // DO NOT exit process during validation - allow graceful degradation
  // Only exit if it's a critical runtime error (not validation)
  if (!error.message.includes('validation') && !error.message.includes('environment')) {
    logger.error('Critical runtime error detected - initiating shutdown');
    process.exit(1);
  } else {
    logger.warn('Non-critical error during validation - continuing with degraded functionality');
  }
});

main().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  logger.error('Unhandled error in main:', { error: errorMessage, stack: errorStack });
  console.error('UNHANDLED ERROR:', error);
  process.exit(1);
});