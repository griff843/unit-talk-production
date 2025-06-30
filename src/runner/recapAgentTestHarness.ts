import 'dotenv/config';
import { RecapAgent } from '../agents/RecapAgent';
import { createLogger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandling';
import { RecapService } from '../agents/RecapAgent/recapService';
import { RecapFormatter } from '../agents/RecapAgent/recapFormatter';
import { RecapStateManager } from '../agents/RecapAgent/recapStateManager';

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

    // Create mock dependencies
    // const recapConfig = {
    //   // Add necessary configuration for RecapConfig
    // };
    const recapService = new RecapService();
    const recapFormatter = new RecapFormatter();
    const stateManager = new RecapStateManager(deps.supabase!, logger);

    // Initialize RecapAgent
    const recapAgent = new RecapAgent(
      config,
      deps,
      recapService,
      recapFormatter,
      stateManager
    );

    // Get test type from command line args
    const testType = process.argv[2] || 'daily';
    const dateStr = process.argv[3];

    if (testType === 'daily') {
      if (dateStr) {
        await testDailyRecap(recapAgent, logger, dateStr);
      } else {
        console.log('Usage: npm run test:recap daily <YYYY-MM-DD>');
        process.exit(1);
      }
    } else if (testType === 'weekly') {
      await testWeeklyRecap(recapAgent, logger);
    } else {
      console.log('Usage: npm run test:recap [daily|weekly] [date]');
      process.exit(1);
    }

    logger.info('RecapAgent test completed successfully');

  } catch (error) {
    // Using console.error here as logger may not be available at this point
    console.error('RecapAgent test failed:', error);
    process.exit(1);
  }
}

async function testDailyRecap(agent: RecapAgent, logger: any, dateStr: string) {
  try {
    logger.info('Testing daily recap...');
    
    // Ensure dateStr is a valid date string
    const validDateStr = dateStr || new Date().toISOString().split('T')[0];
    
    await agent.triggerDailyRecap(validDateStr);
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

  // Future test function for monthly recap functionality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-ignore - Function reserved for future use
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