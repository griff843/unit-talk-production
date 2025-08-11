import 'dotenv/config';
import { getEnv } from './utils/getEnv';
import { createLogger } from './utils/logger';

const logger = createLogger('Main');

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