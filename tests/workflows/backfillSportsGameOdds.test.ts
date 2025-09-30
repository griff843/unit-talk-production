import { WorkflowHandle, TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

import { BackfillSportsGameOdds, BackfillSportsGameOddsInput } from '../../apps/worker/src/workflows/backfillSportsGameOdds';
import * as activities from '../../apps/worker/src/activities/backfillSGOActivities';

// Mock environment variables for testing
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';
process.env.SPORTSGAMEODDS_KEY = process.env.SPORTSGAMEODDS_KEY || 'test-sgo-key';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

describe('BackfillSportsGameOdds Workflow', () => {
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;

  beforeAll(async () => {
    // Set up Temporal test environment
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  beforeEach(async () => {
    // Reset test database tables before each test
    await resetTestTables();

    // Create worker with activities
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-backfill-queue',
      workflowsPath: require.resolve('../../apps/worker/src/workflows/backfillSportsGameOdds'),
      activities
    });
  });

  afterEach(async () => {
    await worker?.shutdown();
  });

  describe('Single Day MLB Backfill', () => {
    it('should successfully backfill 1 day of MLB data', async () => {
      // Arrange: 1-day backfill input for MLB
      const input: BackfillSportsGameOddsInput = {
        startDate: '2025-01-01',
        endDate: '2025-01-01',
        sports: ['mlb']
      };

      // Act: Execute workflow
      const handle: WorkflowHandle<typeof BackfillSportsGameOdds> =
        await testEnv.client.workflow.start(BackfillSportsGameOdds, {
          args: [input],
          taskQueue: 'test-backfill-queue',
          workflowId: `test-backfill-${uuidv4()}`
        });

      const result = await handle.result();

      // Assert: Workflow completed successfully
      expect(result).toBeDefined();
      expect(result.length).toBe(1); // Only MLB processed
      expect(result[0].sport).toBe('mlb');
      expect(result[0].errors.length).toBe(0);

      // Assert: Database contains expected data
      await verifyDatabaseState();
    }, 30000); // 30 second timeout

    it('should be idempotent - second run should skip existing data', async () => {
      const input: BackfillSportsGameOddsInput = {
        startDate: '2025-01-01',
        endDate: '2025-01-01',
        sports: ['mlb']
      };

      // First run
      const handle1 = await testEnv.client.workflow.start(BackfillSportsGameOdds, {
        args: [input],
        taskQueue: 'test-backfill-queue',
        workflowId: `test-backfill-first-${uuidv4()}`
      });

      const result1 = await handle1.result();
      const firstRunGames = result1[0].gamesProcessed;
      const firstRunProps = result1[0].propsProcessed;

      // Second run (should be idempotent)
      const handle2 = await testEnv.client.workflow.start(BackfillSportsGameOdds, {
        args: [input],
        taskQueue: 'test-backfill-queue',
        workflowId: `test-backfill-second-${uuidv4()}`
      });

      const result2 = await handle2.result();

      // Second run should process 0 new records (idempotent)
      expect(result2[0].gamesProcessed).toBe(0);
      expect(result2[0].propsProcessed).toBe(0);

      // Database should still have same counts
      const finalCounts = await getDatabaseCounts();
      expect(finalCounts.games).toBeGreaterThanOrEqual(firstRunGames);
      expect(finalCounts.props).toBeGreaterThanOrEqual(firstRunProps);
    }, 45000);

    it('should handle API errors gracefully', async () => {
      // Mock API failure for testing error handling
      const originalFetch = activities.fetchSGOEventsForDay;
      (activities as any).fetchSGOEventsForDay = jest.fn().mockRejectedValue(
        new Error('API Rate Limit Exceeded')
      );

      const input: BackfillSportsGameOddsInput = {
        startDate: '2025-01-01',
        endDate: '2025-01-01',
        sports: ['mlb']
      };

      const handle = await testEnv.client.workflow.start(BackfillSportsGameOdds, {
        args: [input],
        taskQueue: 'test-backfill-queue',
        workflowId: `test-backfill-error-${uuidv4()}`
      });

      const result = await handle.result();

      // Workflow should complete but log errors
      expect(result).toBeDefined();
      expect(result[0].errors.length).toBeGreaterThan(0);
      expect(result[0].errors[0]).toContain('API Rate Limit Exceeded');

      // Restore original function
      (activities as any).fetchSGOEventsForDay = originalFetch;
    }, 20000);
  });

  describe('Multi-Sport Backfill', () => {
    it('should process multiple sports sequentially', async () => {
      const input: BackfillSportsGameOddsInput = {
        startDate: '2025-01-01',
        endDate: '2025-01-01',
        sports: ['mlb', 'nba'] // Test with 2 sports
      };

      const handle = await testEnv.client.workflow.start(BackfillSportsGameOdds, {
        args: [input],
        taskQueue: 'test-backfill-queue',
        workflowId: `test-multi-sport-${uuidv4()}`
      });

      const result = await handle.result();

      // Should process both sports
      expect(result.length).toBe(2);
      expect(result.map(r => r.sport)).toEqual(['mlb', 'nba']);

      // Each sport should have processed independently
      for (const sportResult of result) {
        expect(sportResult.currentDate).toBe('2025-01-01');
        expect(sportResult.gamesProcessed).toBeGreaterThanOrEqual(0);
        expect(sportResult.propsProcessed).toBeGreaterThanOrEqual(0);
      }
    }, 60000);
  });

  /**
   * Reset test database tables before each test
   */
  async function resetTestTables(): Promise<void> {
    try {
      // Clear games table
      await supabase
        .from('games')
        .delete()
        .eq('backfill', true);

      // Clear raw_props table
      await supabase
        .from('raw_props')
        .delete()
        .eq('source', 'sgo')
        .eq('backfill', true);

      console.log('✅ Test tables reset successfully');
    } catch (error) {
      console.error('❌ Error resetting test tables:', error);
      throw error;
    }
  }

  /**
   * Verify that workflow inserted expected data into database
   */
  async function verifyDatabaseState(): Promise<void> {
    // Check games table
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'MLB')
      .eq('game_date', '2025-01-01')
      .eq('backfill', true);

    if (gamesError) {
      throw new Error(`Failed to query games: ${gamesError.message}`);
    }

    // Check raw_props table
    const { data: props, error: propsError } = await supabase
      .from('raw_props')
      .select('*')
      .eq('sport', 'MLB')
      .eq('game_date', '2025-01-01')
      .eq('source', 'sgo')
      .eq('backfill', true);

    if (propsError) {
      throw new Error(`Failed to query props: ${propsError.message}`);
    }

    // Assertions
    expect(games).toBeDefined();
    expect(games!.length).toBeGreaterThanOrEqual(1);
    expect(props).toBeDefined();
    expect(props!.length).toBeGreaterThanOrEqual(1);

    // Verify data structure
    if (games!.length > 0) {
      const game = games![0];
      expect(game.external_game_id).toBeDefined();
      expect(game.sport).toBe('MLB');
      expect(game.game_date).toBe('2025-01-01');
      expect(game.home_team).toBeDefined();
      expect(game.away_team).toBeDefined();
      expect(game.backfill).toBe(true);
    }

    if (props!.length > 0) {
      const prop = props![0];
      expect(prop.external_game_id).toBeDefined();
      expect(prop.sport).toBe('MLB');
      expect(prop.game_date).toBe('2025-01-01');
      expect(prop.source).toBe('sgo');
      expect(prop.backfill).toBe(true);
    }

    console.log(`✅ Database verification passed: ${games!.length} games, ${props!.length} props`);
  }

  /**
   * Get current database counts for verification
   */
  async function getDatabaseCounts(): Promise<{ games: number; props: number }> {
    const { count: gamesCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MLB')
      .eq('game_date', '2025-01-01')
      .eq('backfill', true);

    const { count: propsCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MLB')
      .eq('game_date', '2025-01-01')
      .eq('source', 'sgo')
      .eq('backfill', true);

    return {
      games: gamesCount || 0,
      props: propsCount || 0
    };
  }
});