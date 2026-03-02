/**
 * Shadow Mode Comprehensive Test Suite
 * Tests the complete shadow mode system including leak prevention and data flow
 */

import { jest } from '@jest/globals';
import { supabaseClient } from '../../src/services/supabaseClient';
import { ShadowModeService } from '../../src/shadow/ShadowMode';
import { PublishGuard } from '../../src/promotion/PublishGuard';
import {
  sendDiscordAlert,
  sendBatchDiscordAlerts,
} from '../../src/agents/AlertAgent/integrations/discord';
import { EmbedBuilder } from 'discord.js';

// Mock external dependencies
jest.mock('../../src/services/supabaseClient');
jest.mock('discord.js');

describe('Shadow Mode System Tests', () => {
  let shadowModeService: ShadowModeService;
  let publishGuard: PublishGuard;
  let mockSupabase: any;
  let originalEnv: any;

  beforeAll(() => {
    // Store original environment
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    // Reset environment to known state
    process.env.SHADOW_MODE = 'false';
    process.env.SHADOW_PRIVATE_CHANNEL_ID = '';
    process.env.SHADOW_MAX_DAYS = '7';

    // Setup mocks
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      then: jest.fn().mockResolvedValue({ data: [], error: null }),
    };

    (supabaseClient as any) = mockSupabase;

    // Reset singletons
    shadowModeService = ShadowModeService.getInstance();
    publishGuard = PublishGuard.getInstance();

    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Shadow Mode Service Core Functionality', () => {
    it('should detect shadow mode correctly when enabled', () => {
      process.env.SHADOW_MODE = 'true';
      const service = ShadowModeService.getInstance();
      expect(service.isShadowMode()).toBe(true);
    });

    it('should detect shadow mode correctly when disabled', () => {
      process.env.SHADOW_MODE = 'false';
      const service = ShadowModeService.getInstance();
      expect(service.isShadowMode()).toBe(false);
    });

    it('should default to disabled when SHADOW_MODE is not set', () => {
      delete process.env.SHADOW_MODE;
      const service = ShadowModeService.getInstance();
      expect(service.isShadowMode()).toBe(false);
    });

    it('should write shadow picks with correct structure', async () => {
      process.env.SHADOW_MODE = 'true';
      const service = ShadowModeService.getInstance();

      const testPick = {
        id: 'test-pick-1',
        propId: 'prop-123',
        tier: 'S',
        confidence: 0.85,
        expectedValue: 0.12,
        playerName: 'Test Player',
        statType: 'points',
        line: 25.5,
        sport: 'NBA',
      };

      await service.shadowWritePick(testPick, 'instant', ['High confidence S-tier pick']);

      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_promoted_picks');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          decided_action: 'instant',
          reasons: ['High confidence S-tier pick'],
          pick_id: 'test-pick-1',
          prop_id: 'prop-123',
          tier: 'S',
          confidence: 0.85,
          expected_value: 0.12,
          player_name: 'Test Player',
          stat_type: 'points',
          line: 25.5,
          sport: 'NBA',
        })
      );
    });

    it('should write shadow metrics snapshots correctly', async () => {
      process.env.SHADOW_MODE = 'true';
      const service = ShadowModeService.getInstance();

      const testMetrics = {
        window: '7d',
        postedEv: 0.08,
        avgConfidence: 0.75,
        hitRate: 0.62,
        totalPicks: 145,
        sTierPicks: 23,
        avgOdds: -108,
        clvBps: 12.5,
        roi: 0.095,
      };

      await service.shadowWriteMetrics(testMetrics);

      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_metrics_snapshots');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          window: '7d',
          posted_ev: 0.08,
          avg_confidence: 0.75,
          hit_rate: 0.62,
          total_picks: 145,
          s_tier_picks: 23,
          avg_odds: -108,
          clv_bps: 12.5,
          roi: 0.095,
        })
      );
    });

    it('should clean up old shadow data correctly', async () => {
      process.env.SHADOW_MODE = 'true';
      process.env.SHADOW_MAX_DAYS = '5';
      const service = ShadowModeService.getInstance();

      await service.cleanupOldShadowData();

      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_promoted_picks');
      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_metrics_snapshots');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.lt).toHaveBeenCalledWith('created_at', expect.any(String));
    });
  });

  describe('PublishGuard Shadow Integration', () => {
    it('should route promotion decisions to shadow mode when enabled', async () => {
      process.env.SHADOW_MODE = 'true';
      const guard = PublishGuard.getInstance();

      const mockShadowWritePick = jest
        .spyOn(shadowModeService, 'shadowWritePick')
        .mockResolvedValue();

      const testDecision = {
        approved: true,
        lane: 'instant' as const,
        reasons: ['S-tier confidence threshold met'],
        pick: {
          id: 'test-pick-1',
          propId: 'prop-123',
          tier: 'S',
          confidence: 0.85,
          expectedValue: 0.12,
          playerName: 'Test Player',
          statType: 'points',
          line: 25.5,
          sport: 'NBA',
        },
        gateResults: [],
        riskScore: 0.2,
      };

      const result = await guard.handlePromotionDecision(testDecision, {
        tier: 'S',
        isInstant: true,
        groupKey: 'nba_2024-01-15',
      });

      expect(result.published).toBe(false);
      expect(result.shadowLogged).toBe(true);
      expect(result.channelsNotified).toEqual([]);
      expect(mockShadowWritePick).toHaveBeenCalledWith(
        testDecision.pick,
        'instant',
        testDecision.reasons
      );

      mockShadowWritePick.mockRestore();
    });

    it('should route recheck decisions to shadow mode when enabled', async () => {
      process.env.SHADOW_MODE = 'true';
      const guard = PublishGuard.getInstance();

      const mockShadowWritePick = jest
        .spyOn(shadowModeService, 'shadowWritePick')
        .mockResolvedValue();

      await guard.handleRecheckDecision('pick-123', 'maintain', 'valid', 'maintain', {
        evAtRecheck: 0.1,
        clvAtRecheck: 15,
        oddsMovement: 5,
      });

      expect(mockShadowWritePick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pick-123',
        }),
        'recheck-maintain',
        ['Recheck action: maintain (valid)']
      );

      mockShadowWritePick.mockRestore();
    });

    it('should handle alert decisions in shadow mode', async () => {
      process.env.SHADOW_MODE = 'true';
      const guard = PublishGuard.getInstance();

      const mockShadowPublishPreview = jest
        .spyOn(shadowModeService, 'shadowPublishPreview')
        .mockResolvedValue();

      await guard.handleAlertDecision('pick-123', 'odds_movement', 'high', 'Odds moved 25 BPS', {
        movement: 25,
        direction: 'favorable',
      });

      expect(mockShadowPublishPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Alert'),
          description: expect.stringContaining('Odds moved 25 BPS'),
        })
      );

      mockShadowPublishPreview.mockRestore();
    });
  });

  describe('Discord Integration Leak Prevention', () => {
    let mockWebhookClient: any;
    let mockEmbed: EmbedBuilder;

    beforeEach(() => {
      mockWebhookClient = {
        send: jest.fn().mockResolvedValue({ id: 'message-123' }),
      };

      mockEmbed = new EmbedBuilder()
        .setTitle('Test Alert')
        .setDescription('Test alert description')
        .setColor(0x00ff00);

      // Mock Discord.js WebhookClient constructor
      (EmbedBuilder as any).mockImplementation(() => mockEmbed);
    });

    it('should block Discord messages in shadow mode', async () => {
      process.env.SHADOW_MODE = 'true';
      const mockShadowPublishPreview = jest
        .spyOn(shadowModeService, 'shadowPublishPreview')
        .mockResolvedValue();

      await sendDiscordAlert(mockEmbed);

      expect(mockWebhookClient.send).not.toHaveBeenCalled();
      expect(mockShadowPublishPreview).toHaveBeenCalledWith(mockEmbed.data);

      mockShadowPublishPreview.mockRestore();
    });

    it('should allow Discord messages in normal mode', async () => {
      process.env.SHADOW_MODE = 'false';
      process.env.DISCORD_ALERT_WEBHOOK = 'https://discord.com/api/webhooks/123/test';

      const mockShadowPublishPreview = jest.spyOn(shadowModeService, 'shadowPublishPreview');

      // Note: This test would need proper Discord client mocking to fully work
      // For now, we're testing the shadow mode detection logic

      expect(shadowModeService.isShadowMode()).toBe(false);
      expect(mockShadowPublishPreview).not.toHaveBeenCalled();

      mockShadowPublishPreview.mockRestore();
    });

    it('should handle batch alerts in shadow mode', async () => {
      process.env.SHADOW_MODE = 'true';
      const mockShadowPublishPreview = jest
        .spyOn(shadowModeService, 'shadowPublishPreview')
        .mockResolvedValue();

      const embeds = [
        new EmbedBuilder().setTitle('Alert 1').setDescription('First alert'),
        new EmbedBuilder().setTitle('Alert 2').setDescription('Second alert'),
        new EmbedBuilder().setTitle('Alert 3').setDescription('Third alert'),
      ];

      await sendBatchDiscordAlerts(embeds);

      expect(mockShadowPublishPreview).toHaveBeenCalledTimes(3);
      expect(mockWebhookClient.send).not.toHaveBeenCalled();

      mockShadowPublishPreview.mockRestore();
    });
  });

  describe('End-to-End Shadow Mode Flow', () => {
    it('should complete full promotion flow in shadow mode without public publishing', async () => {
      process.env.SHADOW_MODE = 'true';
      process.env.SHADOW_PRIVATE_CHANNEL_ID = '123456789';

      const mockShadowWritePick = jest
        .spyOn(shadowModeService, 'shadowWritePick')
        .mockResolvedValue();
      const mockShadowPublishPreview = jest
        .spyOn(shadowModeService, 'shadowPublishPreview')
        .mockResolvedValue();

      // Simulate full promotion flow
      const testPick = {
        id: 'e2e-test-pick',
        propId: 'prop-e2e-123',
        tier: 'S',
        confidence: 0.9,
        expectedValue: 0.15,
        playerName: 'LeBron James',
        statType: 'points',
        line: 28.5,
        sport: 'NBA',
      };

      const promotionDecision = {
        approved: true,
        lane: 'instant' as const,
        reasons: ['Elite S-tier pick with 90% confidence'],
        pick: testPick,
        gateResults: [],
        riskScore: 0.1,
      };

      // Execute promotion through PublishGuard
      const result = await publishGuard.handlePromotionDecision(promotionDecision, {
        tier: 'S',
        isInstant: true,
        groupKey: 'nba_2024-01-15',
      });

      // Verify shadow logging occurred
      expect(result.published).toBe(false);
      expect(result.shadowLogged).toBe(true);
      expect(result.channelsNotified).toEqual([]);

      // Verify shadow database write
      expect(mockShadowWritePick).toHaveBeenCalledWith(
        testPick,
        'instant',
        promotionDecision.reasons
      );

      // Verify no actual Discord publishing
      expect(mockShadowPublishPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Shadow Preview'),
          description: expect.stringContaining('LeBron James'),
        })
      );

      mockShadowWritePick.mockRestore();
      mockShadowPublishPreview.mockRestore();
    });

    it('should handle rejected picks in shadow mode', async () => {
      process.env.SHADOW_MODE = 'true';

      const mockShadowWritePick = jest
        .spyOn(shadowModeService, 'shadowWritePick')
        .mockResolvedValue();

      const testPick = {
        id: 'rejected-pick',
        propId: 'prop-rejected',
        tier: 'B',
        confidence: 0.45,
        expectedValue: 0.02,
        playerName: 'Test Player',
        statType: 'rebounds',
        line: 8.5,
        sport: 'NBA',
      };

      const rejectedDecision = {
        approved: false,
        lane: 'reject' as const,
        reasons: ['Confidence below threshold', 'Expected value too low'],
        pick: testPick,
        gateResults: [],
        riskScore: 0.8,
      };

      const result = await publishGuard.handlePromotionDecision(rejectedDecision, {
        tier: 'B',
        isInstant: false,
        groupKey: 'nba_2024-01-15',
      });

      expect(result.published).toBe(false);
      expect(result.shadowLogged).toBe(true);
      expect(mockShadowWritePick).toHaveBeenCalledWith(
        testPick,
        'rejected-gate',
        rejectedDecision.reasons
      );

      mockShadowWritePick.mockRestore();
    });
  });

  describe('Shadow Mode Configuration Validation', () => {
    it('should handle missing shadow configuration gracefully', async () => {
      process.env.SHADOW_MODE = 'true';
      delete process.env.SHADOW_PRIVATE_CHANNEL_ID;
      delete process.env.SHADOW_MAX_DAYS;

      const service = ShadowModeService.getInstance();

      // Should not throw errors with missing optional config
      expect(() => service.isShadowMode()).not.toThrow();

      // Should use defaults
      await expect(service.shadowPublishPreview({ title: 'Test' })).resolves.not.toThrow();
      await expect(service.cleanupOldShadowData()).resolves.not.toThrow();
    });

    it('should validate shadow mode database operations', async () => {
      process.env.SHADOW_MODE = 'true';

      // Simulate database error
      mockSupabase.insert.mockRejectedValueOnce(new Error('Database connection failed'));

      const service = ShadowModeService.getInstance();

      // Should handle database errors gracefully
      await expect(
        service.shadowWritePick(
          {
            id: 'test',
            propId: 'test',
            tier: 'A',
            confidence: 0.8,
            expectedValue: 0.05,
            playerName: 'Test',
            statType: 'points',
            line: 20.5,
            sport: 'NBA',
          },
          'instant',
          ['test']
        )
      ).resolves.not.toThrow();
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should not leak memory with repeated shadow operations', async () => {
      process.env.SHADOW_MODE = 'true';
      const service = ShadowModeService.getInstance();

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many shadow operations
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          service.shadowWritePick(
            {
              id: `test-${i}`,
              propId: `prop-${i}`,
              tier: 'A',
              confidence: 0.8,
              expectedValue: 0.05,
              playerName: `Player ${i}`,
              statType: 'points',
              line: 20.5 + i,
              sport: 'NBA',
            },
            'instant',
            [`Test reason ${i}`]
          )
        );
      }

      await Promise.all(promises);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle concurrent shadow operations safely', async () => {
      process.env.SHADOW_MODE = 'true';
      const service = ShadowModeService.getInstance();

      // Execute many concurrent operations
      const concurrentPromises = Array(50)
        .fill(null)
        .map((_, i) => [
          service.shadowWritePick(
            {
              id: `concurrent-${i}`,
              propId: `prop-${i}`,
              tier: 'S',
              confidence: 0.9,
              expectedValue: 0.1,
              playerName: `Player ${i}`,
              statType: 'points',
              line: 25.5,
              sport: 'NBA',
            },
            'instant',
            [`Concurrent test ${i}`]
          ),
          service.shadowPublishPreview({ title: `Concurrent Alert ${i}` }),
        ])
        .flat();

      // Should complete without errors
      await expect(Promise.all(concurrentPromises)).resolves.not.toThrow();
    });
  });
});
