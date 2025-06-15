import 'dotenv/config';
import { RecapAgent } from '../agents/RecapAgent';
import { createLogger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandling';

async function runRecapTest() {
  try {
    const logger = createLogger('RecapAgentTest');
    logger.info('Starting RecapAgent test...');

    // Create simple agent configuration matching BaseAgentConfig
    const config = {
      name: 'RecapAgent',
      version: '1.0.0',
      enabled: true,
      logLevel: 'info' as const,
      metrics: {
        enabled: true,
        interval: 60,
        endpoint: '/metrics'
      },
      health: {
        enabled: true,
        interval: 30,
        timeout: 5000,
        checkDb: true,
        checkExternal: false,
        endpoint: '/health'
      },
      retry: {
        maxRetries: 3,
        maxAttempts: 3,
        backoffMs: 200,
        backoff: 200,
        maxBackoffMs: 5000,
        exponential: true,
        jitter: true,
        enabled: true
      }
    };

    const deps = {
      logger,
      supabase: null as any, // Will be initialized by the agent
      errorHandler: new ErrorHandler('RecapAgentTest', null as any)
    };

    // Initialize RecapAgent
    const recapAgent = new RecapAgent(config, deps);

    // Get test type from command line args
    const testType = process.argv[2] || 'daily';

    logger.info(`Running ${testType} recap test...`);

    switch (testType) {
      case 'daily':
        await testDailyRecap(recapAgent, logger);
        break;
      case 'weekly':
        await testWeeklyRecap(recapAgent, logger);
        break;
      case 'monthly':
        await testMonthlyRecap(recapAgent, logger);
        break;
      default:
        logger.error(`Unknown test type: ${testType}`);
        return;
    }

    logger.info('RecapAgent test completed successfully');

  } catch (error) {
    // Using console.error here as logger may not be available at this point
    console.error('RecapAgent test failed:', error);
    process.exit(1);
  }
}

async function testDailyRecap(agent: RecapAgent, logger: any) {
  try {
    logger.info('Testing daily recap...');
    
    // Test with yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    await agent.triggerDailyRecap(dateStr);
    logger.info('Daily recap test completed');
    
  } catch (error) {
    logger.error('Daily recap test failed:', error);
    throw error;
  }
}

async function testWeeklyRecap(agent: RecapAgent, logger: any) {
  try {
    logger.info('Testing weekly recap...');
    
    await agent.triggerWeeklyRecap();
    logger.info('Weekly recap test completed');
    
  } catch (error) {
    logger.error('Weekly recap test failed:', error);
    throw error;
  }
}

async function testMonthlyRecap(agent: RecapAgent, logger: any) {
  try {
    logger.info('Testing monthly recap...');
    
    await agent.triggerMonthlyRecap();
    logger.info('Monthly recap test completed');
    
  } catch (error) {
    logger.error('Monthly recap test failed:', error);
    throw error;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runRecapTest().catch(console.error);
}

export { runRecapTest };