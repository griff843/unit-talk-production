import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from '../agents/BaseAgent';
import { Logger } from '../utils/logger';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export interface TestContext {
  supabase: SupabaseClient;
  logger: Logger;
  testId: string;
  cleanup: () => Promise<void>;
}

export interface TestConfig {
  name: string;
  timeout?: number;
  setupHooks?: {
    before?: () => Promise<void>;
    after?: () => Promise<void>;
    beforeEach?: () => Promise<void>;
    afterEach?: () => Promise<void>;
  };
}

export class TestHarness {
  private readonly logger: Logger;
  private testContext?: TestContext;

  constructor(private readonly config: TestConfig) {
    this.logger = new Logger(`TestHarness:${config.name}`);
  }

  public async setup(): Promise<TestContext> {
    // Create test-specific Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const testId = uuidv4();
    
    this.testContext = {
      supabase,
      logger: new Logger(`Test:${testId}`),
      testId,
      cleanup: async () => {
        await this.cleanup();
      }
    };

    return this.testContext;
  }

  public async runTest<T extends BaseAgent>(
    agent: T,
    testFn: (context: TestContext) => Promise<void>
  ): Promise<void> {
    if (!this.testContext) {
      throw new Error('Test context not initialized. Call setup() first.');
    }

    const timeout = this.config.timeout || 5000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout')), timeout);
    });

    try {
      // Run setup hooks
      if (this.config.setupHooks?.before) {
        await this.config.setupHooks.before();
      }

      // Initialize agent
      await agent.initialize();

      // Run test with timeout
      await Promise.race([
        testFn(this.testContext),
        timeoutPromise
      ]);

      // Cleanup
      await agent.stop();
      
      if (this.config.setupHooks?.after) {
        await this.config.setupHooks.after();
      }
    } catch (error) {
      this.logger.error('Test failed:', error);
      throw error;
    }
  }

  public async runIntegrationTest(
    agents: BaseAgent[],
    testFn: (context: TestContext) => Promise<void>
  ): Promise<void> {
    if (!this.testContext) {
      throw new Error('Test context not initialized. Call setup() first.');
    }

    try {
      // Initialize all agents
      await Promise.all(agents.map(agent => agent.initialize()));

      // Run test
      await testFn(this.testContext);

      // Stop all agents
      await Promise.all(agents.map(agent => agent.stop()));
    } catch (error) {
      this.logger.error('Integration test failed:', error);
      throw error;
    }
  }

  public async runLoadTest(
    agent: BaseAgent,
    loadFn: (context: TestContext) => Promise<void>,
    options: {
      duration: number;
      concurrency: number;
      rampUp?: number;
    }
  ): Promise<void> {
    if (!this.testContext) {
      throw new Error('Test context not initialized. Call setup() first.');
    }

    const startTime = Date.now();
    const workers: Promise<void>[] = [];

    try {
      await agent.initialize();

      for (let i = 0; i < options.concurrency; i++) {
        if (options.rampUp) {
          await new Promise(resolve => 
            setTimeout(resolve, (options.rampUp / options.concurrency) * i)
          );
        }

        workers.push(
          (async () => {
            while (Date.now() - startTime < options.duration) {
              await loadFn(this.testContext);
            }
          })()
        );
      }

      await Promise.all(workers);
      await agent.stop();
    } catch (error) {
      this.logger.error('Load test failed:', error);
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    if (!this.testContext) return;

    try {
      // Clean up test data from Supabase
      const tables = [
        'agent_health',
        'agent_metrics',
        'agent_errors',
        'dead_letter_queue',
        'picks',
        'contests',
        'grading_results'
      ];

      for (const table of tables) {
        await this.testContext.supabase
          .from(table)
          .delete()
          .eq('test_id', this.testContext.testId);
      }

      // Close Supabase connection
      await this.testContext.supabase.auth.signOut();
    } catch (error) {
      this.logger.error('Cleanup failed:', error);
      throw error;
    }
  }
}

// Helper function to create test data
export function createTestData<T>(
  template: T,
  count: number,
  modifier?: (data: T, index: number) => T
): T[] {
  return Array.from({ length: count }, (_, i) => {
    const data = { ...template, id: uuidv4() };
    return modifier ? modifier(data, i) : data;
  });
}

// Helper function to wait for condition
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Condition not met within timeout');
} 