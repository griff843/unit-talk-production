import { TestHarness, createTestData, waitForCondition } from '../../../test/testHarness.config';
import { GradingAgent } from '../index';
import { Pick } from '../types';
import { ErrorHandler } from '../../../shared/errors/index';

describe('GradingAgent Integration Tests', () => {
  let testHarness: TestHarness;
  let gradingAgent: GradingAgent;

  beforeAll(async () => {
    testHarness = new TestHarness({
      name: 'GradingAgent',
      timeout: 10000,
      setupHooks: {
        before: async () => {
          // Any global setup
        },
        after: async () => {
          // Any global cleanup
        }
      }
    });

    const context = await testHarness.setup();

    // Create ErrorHandler for the agent
    const errorHandler = new ErrorHandler({
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 5000,
      shouldRetry: (error: Error) => {
        // Retry on network errors, timeouts, etc.
        return error.message.includes('network') ||
               error.message.includes('timeout') ||
               error.message.includes('ECONNRESET');
      }
    });

    gradingAgent = new GradingAgent({
      name: 'Test Grading Agent',
      version: '1.0.0',
      enabled: true,
      logLevel: 'info',
      metrics: {
        enabled: true,
        interval: 1000
      },
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 5000
      }
    }, {
      supabase: context.supabase,
      logger: context.logger,
      errorHandler: errorHandler
    });
  });

  afterAll(async () => {
    // Cleanup is handled internally
  });

  it('should grade a single pick successfully', async () => {
    const testPick: Pick = {
      id: 'test-pick-1',
      player_name: 'Test Player',
      bet_type: 'single',
      is_parlay: false,
      is_teaser: false,
      is_rr: false,
      promoted_to_final: false,
      is_valid: true,
      created_at: new Date().toISOString(),
      legs: [{
        player_name: 'Player 1',
        line_value: 1.5,
        market_type: 'points',
        odds: -110
      }]
    };

    await testHarness.runTest(gradingAgent, async (context) => {
      // Insert test pick
      await context.supabase
        .from('picks')
        .insert(testPick);

      // Start agent
      await gradingAgent.start();

      // Wait for grading to complete
      await waitForCondition(async () => {
        const { data } = await context.supabase
          .from('grading_results')
          .select('*')
          .eq('pick_id', testPick.id)
          .single();

        return !!data;
      });

      // Verify results
      const { data: result } = await context.supabase
        .from('grading_results')
        .select('*')
        .eq('pick_id', testPick.id)
        .single();

      expect(result).toBeDefined();
      expect(result.tier).toMatch(/[SABCD]/);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  it('should handle multiple picks concurrently', async () => {
    const testPicks = createTestData<Pick>(
      {
        player_name: 'Test Player',
        bet_type: 'single',
        is_parlay: false,
        is_teaser: false,
        is_rr: false,
        promoted_to_final: false,
        is_valid: true,
        created_at: new Date().toISOString(),
        legs: [{
          player_name: 'Player 1',
          line_value: 1.5,
          market_type: 'points',
          odds: -110
        }]
      } as Pick,
      5
    );

    await testHarness.runTest(gradingAgent, async (context) => {
      // Insert test picks
      await context.supabase
        .from('picks')
        .insert(testPicks);

      // Start agent
      await gradingAgent.start();

      // Wait for all gradings to complete
      await waitForCondition(async () => {
        const { data } = await context.supabase
          .from('grading_results')
          .select('count')
          .eq('test_id', context.testId)
          .single();

        return data?.count === testPicks.length;
      });

      // Verify results
      const { data: results } = await context.supabase
        .from('grading_results')
        .select('*')
        .eq('test_id', context.testId);

      expect(results).toHaveLength(testPicks.length);
      results?.forEach(result => {
        expect(result.tier).toMatch(/[SABCD]/);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });
  });

  it('should handle errors and retry failed operations', async () => {
    const testPick: Pick = {
      id: 'test-pick-error',
      player_name: 'Test Player',
      bet_type: 'single',
      is_parlay: false,
      is_teaser: false,
      is_rr: false,
      promoted_to_final: false,
      is_valid: true,
      created_at: new Date().toISOString(),
      legs: [{
        player_name: 'Player 1',
        line_value: -999, // Invalid value to trigger error
        market_type: 'points',
        odds: -110
      }]
    };

    await testHarness.runTest(gradingAgent, async (context) => {
      // Insert test pick
      await context.supabase
        .from('picks')
        .insert(testPick);

      // Start agent
      await gradingAgent.start();

      // Wait for error to be recorded
      await waitForCondition(async () => {
        const { data } = await context.supabase
          .from('agent_errors')
          .select('count')
          .eq('pick_id', testPick.id)
          .single();

        return data?.count !== undefined && data.count > 0;
      });

      // Verify error handling
      const { data: errors } = await context.supabase
        .from('agent_errors')
        .select('*')
        .eq('pick_id', testPick.id);

      expect(errors).toBeDefined();
      expect(errors?.[0].retry_count).toBeGreaterThan(0);
    });
  });
}); 