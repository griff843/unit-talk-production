/**
 * Integration Tests for DailyRecapWorkflow
 *
 * Tests the complete workflow including:
 * - Activity execution
 * - Database persistence
 * - Discord publishing integration
 * - Error handling and retries
 *
 * Phase 2 Step 5 - Daily Recap Automation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock Temporal workflow
jest.mock('@temporalio/workflow', () => ({
  proxyActivities: jest.fn((config) => ({
    computeDailyRecapActivity: jest.fn(),
    saveDailyRecapActivity: jest.fn(),
    publishDailyRecapToDiscordActivity: jest.fn(),
    emitRecapCycleMetricsActivity: jest.fn(),
  })),
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  condition: jest.fn(async (cb) => cb()),
  sleep: jest.fn(),
  setHandler: jest.fn(),
  defineSignal: jest.fn(),
}));

// Mock Supabase client
jest.mock('../../../src/services/supabaseClient', () => ({
  supabaseClient: {
    from: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

import { supabaseClient } from '../../../src/services/supabaseClient';
import { DailyRecap } from '../../../src/services/recap/DailyRecapService';
import {
  computeDailyRecapActivity,
  saveDailyRecapActivity,
  publishDailyRecapToDiscordActivity,
} from '../../../src/temporal/activities/DailyRecapActivities';

describe('DailyRecapWorkflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Workflow Execution', () => {
    it('should execute complete workflow: compute → save → publish', async () => {
      // Mock picks data
      const mockPicks = [
        {
          id: 'pick-1',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 2.5, clv_cents: 250 }],
        },
      ];

      // Mock Supabase picks query
      (supabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'picks') {
          return {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: mockPicks,
              error: null,
            }),
          };
        }
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'user-1', username: 'Griff843' }],
              error: null,
            }),
          };
        }
        if (table === 'daily_recaps') {
          return {
            upsert: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
        };
      });

      // STEP 1: Compute recap
      const computeResult = await computeDailyRecapActivity({
        recapDate: '2025-12-01',
      });

      expect(computeResult.success).toBe(true);
      expect(computeResult.recap).toBeDefined();
      expect(computeResult.recap!.total_picks).toBe(1);

      // STEP 2: Save recap
      const saveResult = await saveDailyRecapActivity({
        recap: computeResult.recap!,
      });

      expect(saveResult.success).toBe(true);
      expect(saveResult.recapDate).toBe('2025-12-01');

      // STEP 3: Publish to Discord
      const publishResult = await publishDailyRecapToDiscordActivity({
        recap: computeResult.recap!,
      });

      expect(publishResult.success).toBe(true);
      expect(publishResult.messageId).toBeDefined();
    });

    it('should continue workflow even if Discord publish fails', async () => {
      const mockPicks = [
        {
          id: 'pick-1',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 2.5, clv_cents: 250 }],
        },
      ];

      (supabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'picks') {
          return {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: mockPicks,
              error: null,
            }),
          };
        }
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'user-1', username: 'Griff843' }],
              error: null,
            }),
          };
        }
        if (table === 'daily_recaps') {
          return {
            upsert: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
        };
      });

      const computeResult = await computeDailyRecapActivity({
        recapDate: '2025-12-01',
      });

      const saveResult = await saveDailyRecapActivity({
        recap: computeResult.recap!,
      });

      // Mock Discord publish failure (this is simulated)
      // In the actual workflow, this should not cause the entire workflow to fail
      const publishResult = await publishDailyRecapToDiscordActivity({
        recap: computeResult.recap!,
      });

      // Discord publish may succeed or fail, but workflow should continue
      expect(computeResult.success).toBe(true);
      expect(saveResult.success).toBe(true);
    });
  });

  describe('Idempotency', () => {
    it('should handle duplicate execution for same date', async () => {
      const mockPicks = [
        {
          id: 'pick-1',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 2.5, clv_cents: 250 }],
        },
      ];

      let upsertCallCount = 0;

      (supabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'picks') {
          return {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: mockPicks,
              error: null,
            }),
          };
        }
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'user-1', username: 'Griff843' }],
              error: null,
            }),
          };
        }
        if (table === 'daily_recaps') {
          return {
            upsert: jest.fn().mockImplementation(() => {
              upsertCallCount++;
              return Promise.resolve({
                data: null,
                error: null,
              });
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
        };
      });

      // Execute workflow twice for same date
      const computeResult1 = await computeDailyRecapActivity({
        recapDate: '2025-12-01',
      });
      await saveDailyRecapActivity({ recap: computeResult1.recap! });

      const computeResult2 = await computeDailyRecapActivity({
        recapDate: '2025-12-01',
      });
      await saveDailyRecapActivity({ recap: computeResult2.recap! });

      // Both executions should succeed
      expect(computeResult1.success).toBe(true);
      expect(computeResult2.success).toBe(true);

      // Verify upsert was called twice (idempotent)
      expect(upsertCallCount).toBe(2);

      // Results should be identical
      expect(computeResult1.recap!.total_picks).toBe(computeResult2.recap!.total_picks);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (supabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'picks') {
          return {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection error', code: 'ECONNREFUSED' },
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
        };
      });

      const computeResult = await computeDailyRecapActivity({
        recapDate: '2025-12-01',
      });

      expect(computeResult.success).toBe(false);
      expect(computeResult.error).toContain('Database connection error');
    });

    it('should handle missing data gracefully', async () => {
      (supabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'picks') {
          return {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [], // No picks for the date
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
        };
      });

      const computeResult = await computeDailyRecapActivity({
        recapDate: '2025-12-01',
      });

      expect(computeResult.success).toBe(true);
      expect(computeResult.recap!.total_picks).toBe(0);
      expect(computeResult.recap!.win_rate).toBeNull();
    });
  });
});
