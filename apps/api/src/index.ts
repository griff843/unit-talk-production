import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Set NODE_ENV to development if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

import { getEnv } from './utils/getEnv';
import { createLogger } from './utils/logger';
// Optional telemetry import to avoid blocking local dev if package resolution differs
let telemetry: { initialize: () => void } | null = null;
try {
  // Use dynamic import to support ESM package from CJS transpilation
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  telemetry = require('@unit-talk/telemetry');
} catch (_) {
  telemetry = null;
}


const logger = createLogger('Main');

async function main() {
  try {
    logger.info('Starting Unit Talk Platform...');

    // Validate environment variables
    // Initialize OpenTelemetry (OTLP in prod, console in dev via package defaults)
    if (telemetry && typeof telemetry.initialize === 'function') {
      telemetry.initialize();
    }

    getEnv();
    logger.info('Environment variables loaded successfully');

    // Start API server; start Temporal worker only if explicitly enabled
    const startWorkerEnabled = process.env.START_TEMPORAL_WORKER === 'true';
    logger.info(`Starting API server${startWorkerEnabled ? ' and Temporal worker' : ''}...`);

    const { startServer } = await import('./api-server');
    const serverPromise = startServer();

    let workerPromise: Promise<void> | null = null;
    if (startWorkerEnabled) {
      const { default: startWorker } = await import('./worker');
      workerPromise = startWorker();
    }

    // Wait for services to start
    if (workerPromise) {
      await Promise.all([serverPromise, workerPromise]);
      logger.info('Unit Talk Platform started successfully - API server and Temporal worker running');
    } else {
      await serverPromise;
      logger.info('Unit Talk Platform started successfully - API server running (Temporal worker disabled)');
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

main().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error('Unhandled error in main:', { error: errorMessage });
  process.exit(1);
});