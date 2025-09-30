#!/usr/bin/env node
import 'dotenv/config';
import { NativeConnection, Worker } from '@temporalio/worker';
import { createLogger } from './src/utils/logger';

const logger = createLogger('StandaloneWorker');

// Import all activities
import * as activities from './src/activities';

async function startStandaloneWorker() {
  try {
    logger.info('Starting standalone Temporal worker...');

    const connection = await NativeConnection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'temporal:7233',
    });

    const worker = await Worker.create({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
      workflowsPath: require.resolve('./src/workflows'),
      activities,
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'unit-talk-dev',
      bundlerOptions: {
        ignoreModules: ['fs', 'path', 'os', 'crypto', 'http', 'https', 'zlib', 'stream', 'events', 'tty', 'punycode'],
        webpackConfigHook: (config) => {
          config.output = config.output || {};
          config.output.publicPath = '';
          config.output.globalObject = 'this';
          config.target = 'node';
          return config;
        }
      }
    });

    logger.info('✅ Standalone worker started successfully');
    logger.info(`Connected to Temporal at ${process.env.TEMPORAL_ADDRESS || 'temporal:7233'}`);

    await worker.run();

  } catch (error) {
    logger.error('Failed to start standalone worker:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startStandaloneWorker().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}