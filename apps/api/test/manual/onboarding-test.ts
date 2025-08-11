// Import test environment setup first
import '../setup/test-env';

import { OnboardingService } from '../../src/services/onboardingService';
import { logger } from '../../src/utils/logger';

console.log('Test script imported');

async function testOnboarding() {
  console.log('Starting test function');
  try {
    logger.info('Starting onboarding test suite');

    // Initialize onboarding service
    const onboardingService = new OnboardingService();
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for logger to initialize
    logger.info('OnboardingService initialized');

    // Test user tiers
    const tiers = ['free', 'vip', 'vip_plus', 'capper', 'staff', 'admin'] as const;
    logger.info(`Testing ${tiers.length} user tiers: ${tiers.join(', ')}`);

    // Test results storage
    const testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [] as string[],
      messages: [] as string[]
    };

    // Test each tier
    for (const tier of tiers) {
      logger.info(`\n=== Testing onboarding for ${tier} tier ===`);
      testResults.total++;

      try {
        // Create mock user
        const mockUser = {
          id: `test_${tier}_id`,
          username: `test_${tier}_user`,
          tier,
          createDM: async () => ({
            send: async (message: any) => {
              const messageStr = JSON.stringify(message, null, 2);
              logger.info(`\nMessage sent to ${tier} user:`, { message: messageStr });
              testResults.messages.push(`${tier}: ${messageStr}`);
              return true;
            }
          })
        };

        logger.info(`Created mock user for tier: ${tier}`, { userId: mockUser.id, username: mockUser.username });

        // Test onboarding sequence
        await onboardingService.handleUserOnboarding(mockUser as any, tier, true);
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for logs to flush

        logger.info(`✅ Completed onboarding test for ${tier} tier`);
        testResults.passed++;

      } catch (error: any) {
        logger.error(`❌ Failed onboarding test for ${tier} tier:`, error);
        testResults.failed++;
        testResults.errors.push(`${tier}: ${error?.message || 'Unknown error'}`);
      }

      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Wait for all logs to flush
    await new Promise(resolve => setTimeout(resolve, 500));

    // Print test summary
    logger.info('\n=== Test Summary ===');
    logger.info('Test Results:', {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: `${((testResults.passed / testResults.total) * 100).toFixed(2)}%`
    });
    
    if (testResults.errors.length > 0) {
      logger.info('\nErrors:', { errors: testResults.errors });
    }

    logger.info('\nMessage Summary:', {
      totalMessages: testResults.messages.length,
      messagesByTier: tiers.reduce((acc, tier) => ({
        ...acc,
        [tier]: testResults.messages.filter(m => m.startsWith(tier)).length
      }), {})
    });

    if (testResults.failed > 0) {
      throw new Error(`${testResults.failed} tests failed`);
    }

    logger.info('\n✅ All onboarding tests completed successfully');

    // Wait for final logs to flush
    await new Promise(resolve => setTimeout(resolve, 500));

  } catch (error: any) {
    logger.error('\n❌ Error during onboarding test:', error);
    // Wait for error log to flush
    await new Promise(resolve => setTimeout(resolve, 500));
    process.exit(1);
  }
}

console.log('Running test...');
// Run the test
testOnboarding()
  .then(() => {
    console.log('Test completed successfully');
    // Wait for any remaining logs to flush
    setTimeout(() => process.exit(0), 500);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    logger.error('Test failed:', error);
    // Wait for error log to flush
    setTimeout(() => process.exit(1), 500);
  }); 