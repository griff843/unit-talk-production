import 'dotenv/config';
import { Logger } from './utils/logger';
import { getEnv } from './utils/getEnv';

const logger = new Logger('Main');

async function main() {
  try {
    logger.info('Starting Unit Talk Platform...');
    
    // Validate environment variables
    getEnv();
    logger.info('Environment variables loaded successfully');
    
    // Import and start the worker
    const { default: startWorker } = await import('./worker');
    await startWorker();
    
    logger.info('Unit Talk Platform started successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to start Unit Talk Platform:', { error: errorMessage });
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