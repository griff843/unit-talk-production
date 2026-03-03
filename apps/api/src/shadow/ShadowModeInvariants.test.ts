/**
 * Shadow Mode Invariants Tests
 *
 * Critical production safety tests ensuring:
 * 1. Shadow mode NEVER publishes publicly
 * 2. Live mode NEVER bypasses safety checks
 * 3. Database invariants are maintained
 * 4. Proper logging and auditing occurs
 *
 * These tests are MANDATORY before production deployment.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { PublishGuardService } from '../promotion/PublishGuard';
import { supabaseClient } from '../services/supabaseClient';

import { ShadowModeService } from './ShadowMode';

import type { ShadowPick, ShadowAction } from './ShadowMode';
import type { PromotionDecision, PublishOptions } from '../promotion/PublishGuard';

// Mock dependencies
jest.mock('../services/supabaseClient');
jest.mock('discord.js');

describe('Shadow Mode Invariants', () => {
  let shadowService: ShadowModeService;
  let publishGuard: PublishGuardService;
  let mockSupabase: jest.Mocked<typeof supabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment
    delete process.env.SHADOW_MODE;
    delete process.env.SHADOW_PRIVATE_CHANNEL_ID;

    // Mock Supabase client
    mockSupabase = supabaseClient as jest.Mocked<typeof supabaseClient>;
    mockSupabase.from = jest.fn().mockReturnValue({
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      rpc: jest.fn().mockResolvedValue({ data: [{ deleted_picks: 0 }], error: null }),
    });

    shadowService = ShadowModeService.getInstance();
    publishGuard = PublishGuardService.getInstance();
  });

  afterEach(() => {
    // Clean up singletons
    delete process.env.SHADOW_MODE;
    jest.restoreAllMocks();
  });

  describe('INVARIANT 1: Shadow Mode NEVER Publishes Publicly', () => {
    beforeEach(() => {
      process.env.SHADOW_MODE = 'true';
    });

    test('Shadow mode is properly detected', () => {
      expect(shadowService.isShadowMode()).toBe(true);
    });

    test('Shadow mode blocks ALL public actions', () => {
      expect(shadowService.shouldSkipPublicAction('publish')).toBe(true);
      expect(shadowService.shouldSkipPublicAction('alert')).toBe(true);
      expect(shadowService.shouldSkipPublicAction('webhook')).toBe(true);
    });

    test('Shadow pick promotion never marks unified_picks as published', async () => {
      const decision: PromotionDecision = {
        approved: true,
        lane: 'instant',
        reasons: [],
        pick: {
          id: 'test-pick-123',
          player_name: 'Test Player',
          stat_type: 'points',
          sport: 'NBA',
        },
      };

      const options: PublishOptions = {
        embed: { title: 'Test Pick' },
        tier: 'A',
        isInstant: true,
      };

      const result = await publishGuard.handlePromotionDecision(decision, options);

      // Shadow mode should log but not publish
      expect(result.published).toBe(false);
      expect(result.shadowLogged).toBe(true);

      // Verify no update to unified_picks.published
      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_decisions');
      expect(mockSupabase.from).not.toHaveBeenCalledWith('unified_picks');
    });

    test('Shadow mode logs all promotion decisions', async () => {
      const shadowPick: ShadowPick = {
        sport: 'NBA',
        market: 'points',
        player: 'LeBron James',
        tier: 'S',
        confidence: 85,
        professionalScore: 0.92,
      };

      await shadowService.shadowWritePick(shadowPick, 'instant', ['high-confidence']);

      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_decisions');
      const insertCall = mockSupabase.from('shadow_decisions').insert as jest.Mock;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          sport: 'NBA',
          market: 'points',
          player: 'LeBron James',
          decided_action: 'instant',
          reasons: ['high-confidence'],
        })
      );
    });

    test('Shadow previews are sent to private channel only', async () => {
      process.env.SHADOW_PRIVATE_CHANNEL_ID = 'test-private-channel';

      const embed = {
        title: 'Test Pick',
        description: 'Test description',
        player: 'Test Player',
      };

      // Mock Discord client methods
      const mockChannel = {
        send: jest.fn().mockResolvedValue({ id: 'message-id' }),
      };

      const mockDiscordClient = {
        channels: {
          fetch: jest.fn().mockResolvedValue(mockChannel),
        },
      };

      // Inject mocked client
      (shadowService as any).discordClient = mockDiscordClient;

      await shadowService.shadowPublishPreview(embed);

      expect(mockDiscordClient.channels.fetch).toHaveBeenCalledWith('test-private-channel');
      expect(mockChannel.send).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('[SHADOW]'),
              description: expect.stringContaining('SHADOW MODE - NOT PUBLISHED PUBLICLY'),
            }),
          }),
        ],
      });
    });

    test('Shadow mode rejects public Discord posting', async () => {
      const mockDiscordService = {
        postToPublicChannel: jest.fn(),
      };

      // Simulate attempting to post publicly in shadow mode
      const shouldPost = !shadowService.shouldSkipPublicAction('publish');

      if (shouldPost) {
        await mockDiscordService.postToPublicChannel('test-message');
      }

      expect(mockDiscordService.postToPublicChannel).not.toHaveBeenCalled();
    });
  });

  describe('INVARIANT 2: Live Mode NEVER Bypasses Safety Checks', () => {
    beforeEach(() => {
      process.env.SHADOW_MODE = 'false';
    });

    test('Live mode is properly detected', () => {
      expect(shadowService.isShadowMode()).toBe(false);
    });

    test('Live mode allows public actions', () => {
      expect(shadowService.shouldSkipPublicAction('publish')).toBe(false);
      expect(shadowService.shouldSkipPublicAction('alert')).toBe(false);
      expect(shadowService.shouldSkipPublicAction('webhook')).toBe(false);
    });

    test('Live mode still requires approval for publishing', async () => {
      const rejectedDecision: PromotionDecision = {
        approved: false,
        lane: 'rejected',
        reasons: ['low-confidence', 'high-risk'],
        pick: {
          id: 'test-pick-456',
          player_name: 'Test Player 2',
          stat_type: 'assists',
          sport: 'NBA',
        },
      };

      const result = await publishGuard.handlePromotionDecision(rejectedDecision);

      // Even in live mode, rejected picks should not be published
      expect(result.published).toBe(false);
      expect(result.channelsNotified).toHaveLength(0);
    });

    test('Live mode logs both shadow and live decisions', async () => {
      const approvedDecision: PromotionDecision = {
        approved: true,
        lane: 'instant',
        reasons: ['high-confidence', 'positive-ev'],
        pick: {
          id: 'test-pick-789',
          player_name: 'Test Player 3',
          stat_type: 'rebounds',
          sport: 'NBA',
          professional_score: 0.95,
        },
      };

      const result = await publishGuard.handlePromotionDecision(approvedDecision, {
        tier: 'S',
        isInstant: true,
      });

      // Live mode should both log and publish approved picks
      expect(result.shadowLogged).toBe(true);
      expect(result.published).toBe(true);
    });
  });

  describe('INVARIANT 3: Database Consistency', () => {
    test('Shadow decisions table receives all promotion decisions', async () => {
      process.env.SHADOW_MODE = 'true';

      const testCases: Array<{ action: ShadowAction; reasons: string[] }> = [
        { action: 'instant', reasons: ['high-confidence'] },
        { action: 'queued-10am', reasons: ['good-value'] },
        { action: 'rejected-gate', reasons: ['low-confidence'] },
        { action: 'rejected-recheck', reasons: ['odds-moved'] },
      ];

      for (const testCase of testCases) {
        const shadowPick: ShadowPick = {
          sport: 'MLB',
          market: 'hits',
          player: `Player ${testCase.action}`,
          tier: 'B',
        };

        await shadowService.shadowWritePick(shadowPick, testCase.action, testCase.reasons);

        expect(mockSupabase.from).toHaveBeenCalledWith('shadow_decisions');
      }

      // Verify all 4 test cases were logged
      const insertCall = mockSupabase.from('shadow_decisions').insert as jest.Mock;
      expect(insertCall).toHaveBeenCalledTimes(testCases.length);
    });

    test('unified_picks.published field is never set to true in shadow mode', async () => {
      process.env.SHADOW_MODE = 'true';

      // Mock checking if unified_picks would be updated with published=true
      const unifiedPicksUpdate = jest.fn();
      mockSupabase.from = jest.fn().mockImplementation(table => {
        if (table === 'unified_picks') {
          return {
            update: unifiedPicksUpdate.mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return {
          insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const decision: PromotionDecision = {
        approved: true,
        lane: 'instant',
        reasons: ['test'],
        pick: { id: 'test-pick', player_name: 'Test' },
      };

      await publishGuard.handlePromotionDecision(decision);

      // Verify unified_picks was never updated with published=true
      expect(unifiedPicksUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ published: true })
      );
    });

    test('Shadow cleanup preserves data integrity', async () => {
      process.env.SHADOW_MODE = 'true';

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: [
          {
            deleted_picks: 100,
            deleted_metrics: 50,
            deleted_rechecks: 25,
            deleted_alerts: 10,
          },
        ],
        error: null,
      });

      await shadowService.cleanupOldShadow(7);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_old_shadow_data', {
        max_days: 7,
      });
    });
  });

  describe('INVARIANT 4: Proper Audit Logging', () => {
    test('All shadow actions are logged with complete context', async () => {
      process.env.SHADOW_MODE = 'true';

      const shadowPick: ShadowPick = {
        rawPropId: 'raw-123',
        unifiedPickId: 'unified-456',
        sport: 'NFL',
        market: 'rushing-yards',
        player: 'Derrick Henry',
        team: 'TEN',
        book: 'DraftKings',
        oddsOpen: -110,
        oddsNow: -105,
        line: 75.5,
        eventTime: new Date('2025-08-10T17:00:00Z'),
        tier: 'A',
        confidence: 78,
        professionalScore: 0.83,
        deviggedWinProb: 0.55,
        deviggedEdge: 0.042,
        clvPct: 2.3,
        kellyFraction: 0.08,
        risk: 0.15,
        chaosMuted: false,
        steamMuted: false,
        isInstant: true,
        groupKey: 'nfl-sunday-group-1',
      };

      await shadowService.shadowWritePick(shadowPick, 'instant', ['high-ev', 'positive-clv']);

      const insertCall = mockSupabase.from('shadow_decisions').insert as jest.Mock;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          raw_prop_id: 'raw-123',
          unified_pick_id: 'unified-456',
          sport: 'NFL',
          market: 'rushing-yards',
          player: 'Derrick Henry',
          team: 'TEN',
          book: 'DraftKings',
          odds_open: -110,
          odds_now: -105,
          line: 75.5,
          event_time: '2025-08-10T17:00:00.000Z',
          tier: 'A',
          confidence: 78,
          professional_score: 0.83,
          devigged_win_prob: 0.55,
          devigged_edge: 0.042,
          clv_pct: 2.3,
          kelly_fraction: 0.08,
          risk: 0.15,
          chaos_muted: false,
          steam_muted: false,
          is_instant: true,
          group_key: 'nfl-sunday-group-1',
          decided_action: 'instant',
          reasons: ['high-ev', 'positive-clv'],
        })
      );
    });

    test('Shadow metrics are properly tracked', async () => {
      process.env.SHADOW_MODE = 'true';

      const metricsSnapshot = {
        window: '7d' as const,
        sport: 'NBA',
        postedEv: 0.045,
        positiveCLVRate: 0.67,
        avgCLV: 1.8,
        hitRate: 0.58,
        roi: 0.12,
        sharpe: 1.4,
        kellyEfficiency: 0.85,
        maxDrawdown: -0.08,
        picksCount: 150,
        completedPicks: 145,
        winRate: 0.58,
        avgOdds: -108,
        profitFactor: 1.45,
      };

      await shadowService.shadowWriteMetrics(metricsSnapshot);

      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_decisions');
      const insertCall = mockSupabase.from('shadow_decisions').insert as jest.Mock;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          sport: 'NBA',
          market: 'metrics',
          player: 'system',
          decided_action: 'metrics-snapshot',
          decision_type: 'metrics',
          additional_data: expect.objectContaining({
            window: '7d',
            sport: 'NBA',
            posted_ev: 0.045,
            positive_clv_rate: 0.67,
          }),
        })
      );
    });

    test('Shadow recheck results are logged', async () => {
      process.env.SHADOW_MODE = 'true';

      await shadowService.shadowWriteRecheck(
        'shadow-pick-123',
        'pre-game-recheck',
        'validated',
        'approved',
        {
          evAtRecheck: 0.038,
          clvAtRecheck: 1.5,
          oddsMovement: -2,
        }
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_decisions');
      const insertCall = mockSupabase.from('shadow_decisions').insert as jest.Mock;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          unified_pick_id: 'shadow-pick-123',
          sport: 'unknown',
          market: 'recheck',
          player: 'system',
          decided_action: 'rejected-recheck',
          decision_type: 'recheck',
          additional_data: expect.objectContaining({
            shadow_pick_id: 'shadow-pick-123',
            recheck_type: 'pre-game-recheck',
            validation_status: 'validated',
            action: 'approved',
            ev_at_recheck: 0.038,
            clv_at_recheck: 1.5,
            odds_movement: -2,
          }),
        })
      );
    });

    test('Shadow alerts are properly logged', async () => {
      process.env.SHADOW_MODE = 'true';

      await shadowService.shadowWriteAlert(
        'shadow-pick-456',
        'odds-movement',
        'high',
        'Odds moved significantly against us',
        { oldOdds: -110, newOdds: -125, movement: 15 }
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_decisions');
      const insertCall = mockSupabase.from('shadow_decisions').insert as jest.Mock;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          unified_pick_id: 'shadow-pick-456',
          sport: 'unknown',
          market: 'alert',
          player: 'system',
          decided_action: 'odds-movement',
          decision_type: 'alert',
          additional_data: expect.objectContaining({
            shadow_pick_id: 'shadow-pick-456',
            alert_type: 'odds-movement',
            severity: 'high',
            message: 'Odds moved significantly against us',
            data: { oldOdds: -110, newOdds: -125, movement: 15 },
            would_suspend: false,
            would_notify: true,
          }),
        })
      );
    });
  });

  describe('INVARIANT 5: Environment Transition Safety', () => {
    test('Shadow mode can be safely toggled without data loss', async () => {
      // Start in shadow mode
      process.env.SHADOW_MODE = 'true';
      const shadowService1 = ShadowModeService.getInstance();
      expect(shadowService1.isShadowMode()).toBe(true);

      // Record a shadow pick
      const shadowPick: ShadowPick = {
        sport: 'MLB',
        market: 'hits',
        player: 'Ronald Acuna Jr.',
        tier: 'S',
      };
      await shadowService1.shadowWritePick(shadowPick, 'instant', ['test-transition']);

      // Switch to live mode
      process.env.SHADOW_MODE = 'false';

      // Create new instance (simulating restart)
      const shadowService2 = new (ShadowModeService as any)();
      expect(shadowService2.isShadowMode()).toBe(false);

      // Verify data persists and no errors occur
      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_decisions');
    });

    test('Statistics retrieval works in both modes', async () => {
      // Mock shadow statistics data
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: [
                {
                  decided_action: 'instant',
                  sport: 'NBA',
                  tier: 'S',
                  reasons: ['high-confidence'],
                },
                {
                  decided_action: 'queued-10am',
                  sport: 'MLB',
                  tier: 'A',
                  reasons: ['good-value'],
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      // Test in shadow mode
      process.env.SHADOW_MODE = 'true';
      const shadowStats = await shadowService.getShadowStats('7d');

      expect(shadowStats.totalPicks).toBe(2);
      expect(shadowStats.byAction['instant']).toBe(1);
      expect(shadowStats.byAction['queued-10am']).toBe(1);
      expect(shadowStats.bySport['NBA']).toBe(1);
      expect(shadowStats.bySport['MLB']).toBe(1);

      // Test in live mode
      process.env.SHADOW_MODE = 'false';
      const liveStats = await shadowService.getShadowStats('7d');

      // Stats should be accessible in both modes
      expect(liveStats.totalPicks).toBe(2);
    });
  });

  describe('INVARIANT 6: Error Handling & Recovery', () => {
    test('Shadow mode gracefully handles database errors', async () => {
      process.env.SHADOW_MODE = 'true';

      // Mock database error
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database connection failed'),
        }),
      });

      const shadowPick: ShadowPick = {
        sport: 'NHL',
        market: 'goals',
        player: 'Connor McDavid',
      };

      // Should not throw error, should handle gracefully
      await expect(
        shadowService.shadowWritePick(shadowPick, 'instant', ['test-error'])
      ).resolves.not.toThrow();
    });

    test('Live mode continues to work when shadow logging fails', async () => {
      process.env.SHADOW_MODE = 'false';

      // Mock shadow logging failure
      const originalShadowWrite = shadowService.shadowWritePick;
      shadowService.shadowWritePick = jest
        .fn()
        .mockRejectedValue(new Error('Shadow logging failed'));

      const decision: PromotionDecision = {
        approved: true,
        lane: 'instant',
        reasons: ['test'],
        pick: { id: 'test-pick', player_name: 'Test Player' },
      };

      // Should still complete successfully in live mode
      const result = await publishGuard.handlePromotionDecision(decision);

      expect(result.published).toBe(true);
      // Restore original method
      shadowService.shadowWritePick = originalShadowWrite;
    });
  });
});
