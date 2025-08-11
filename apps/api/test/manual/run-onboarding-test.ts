import { spawn } from 'child_process';

import { logger } from '../../src/utils/logger';

async function runOnboardingTest() {
  logger.info('Starting manual onboarding test...');

  const testProcess = spawn('ts-node', ['test/manual/onboarding-test.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug'
    }
  });

  return new Promise((resolve, reject) => {
    testProcess.on('close', (code) => {
      if (code === 0) {
        logger.info('Manual onboarding test completed successfully');
        resolve(true);
      } else {
        logger.error(`Manual onboarding test failed with code ${code}`);
        reject(new Error(`Test failed with code ${code}`));
      }
    });

    testProcess.on('error', (error) => {
      logger.error('Error running manual onboarding test:', error);
      reject(error);
    });
  });
}

// Run the test runner
if (require.main === module) {
  runOnboardingTest()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 