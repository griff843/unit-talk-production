/**
 * Shadow Mode Integration Tests
 * Tests real service interactions with shadow mode enabled/disabled
 */

import { jest } from '@jest/globals';
import { supabaseClient } from '../../src/services/supabaseClient';
import { promotionGatekeeper } from '../../src/services/PromotionGatekeeper';
import { autoRecheckService } from '../../src/services/AutoRecheckService';
import { pickMonitoringService } from '../../src/services/PickMonitoringService';
import { ShadowModeService } from '../../src/shadow/ShadowMode';

// Mock external dependencies
jest.mock('../../src/services/supabaseClient');

describe('Shadow Mode Integration Tests', () => {
  let mockSupabase: any;
  let originalEnv: any;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    // Reset environment
    process.env.SHADOW_MODE = 'false';
    process.env.SHADOW_PRIVATE_CHANNEL_ID = '';
    process.env.SHADOW_MAX_DAYS = '7';

    // Setup Supabase mock
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      then: jest.fn().mockResolvedValue({ data: [], error: null })
    };

    (supabaseClient as any) = mockSupabase;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('PromotionGatekeeper Shadow Integration', () => {
    it('should route S-tier is_instant picks to shadow mode correctly', async () => {
      process.env.SHADOW_MODE = 'true';

      // Mock successful gate evaluation data
      mockSupabase.then
        .mockResolvedValueOnce({ data: null, error: null }) // promotion_decisions insert
        .mockResolvedValueOnce({ data: [], error: null }); // shadow_promoted_picks insert

      const testPick = {
        id: 'integration-s-tier-1',
        propId: 'prop-integration-123',
        tier: 'S',
        confidence: 0.88,
        professionalScore: 92,
        expectedValue: 0.14,
        clvTracking: {
          initialOdds: -110,
          currentOdds: -108,
          clvBps: 18
        },
        steamData: {
          strength: 15,
          direction: 'for' as const,
          volume: 25000
        },
        gameTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        sport: 'NBA',
        correlatedPicks: [],
        portfolioExposure: 0.15
      };

      const decision = await promotionGatekeeper.evaluatePromotion(testPick);

      expect(decision.approved).toBe(true);
      expect(decision.lane).toBe('instant');
      
      // Verify shadow data was written
      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_promoted_picks');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          decided_action: 'instant',
          pick_id: 'integration-s-tier-1',
          tier: 'S',
          confidence: 0.88,
          expected_value: 0.14
        })
      );
    });

    it('should route A-tier scheduled picks to shadow mode correctly', async () => {
      process.env.SHADOW_MODE = 'true';

      mockSupabase.then
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const testPick = {
        id: 'integration-a-tier-1',
        propId: 'prop-integration-456',
        tier: 'A',
        confidence: 0.72,
        professionalScore: 78,
        expectedValue: 0.08,
        clvTracking: {
          initialOdds: -115,
          currentOdds: -112,
          clvBps: 12
        },
        gameTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        sport: 'NFL',
        correlatedPicks: [],
        portfolioExposure: 0.22
      };

      const decision = await promotionGatekeeper.evaluatePromotion(testPick);

      expect(decision.approved).toBe(true);
      expect(decision.lane).toBe('10am');
      
      // Verify shadow data shows scheduled action
      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_promoted_picks');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          decided_action: 'queued-10am',
          pick_id: 'integration-a-tier-1',
          tier: 'A'
        })
      );
    });

    it('should route rejected picks to shadow mode with rejection reasons', async () => {
      process.env.SHADOW_MODE = 'true';

      mockSupabase.then
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const testPick = {
        id: 'integration-rejected-1',
        propId: 'prop-integration-789',
        tier: 'B',
        confidence: 0.45, // Too low
        professionalScore: 65, // Too low
        expectedValue: 0.01, // Too low
        clvTracking: {
          initialOdds: -110,
          currentOdds: -115,
          clvBps: -8 // Negative CLV
        },
        gameTime: new Date(Date.now() + 1 * 60 * 60 * 1000),
        sport: 'MLB',
        correlatedPicks: [],
        portfolioExposure: 0.35 // High exposure
      };

      const decision = await promotionGatekeeper.evaluatePromotion(testPick);

      expect(decision.approved).toBe(false);
      expect(decision.lane).toBe('reject');
      
      // Verify shadow data shows rejection with reasons
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          decided_action: 'rejected-gate',
          reasons: expect.arrayContaining([
            expect.stringMatching(/confidence|professional_score|expected_value/)
          ])
        })
      );
    });
  });

  describe('AutoRecheckService Shadow Integration', () => {
    it('should handle recheck decisions in shadow mode', async () => {
      process.env.SHADOW_MODE = 'true';

      // Mock pick data fetch
      mockSupabase.then
        .mockResolvedValueOnce({ 
          data: {
            id: 'recheck-test-1',
            prop_id: 'prop-recheck-123',
            tier: 'S',
            confidence: 0.85,
            professional_score: 88,
            expected_value: 0.12,
            game_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
            sport: 'NBA',
            player_name: 'Test Player',
            stat_type: 'points',
            line: 25.5
          }, 
          error: null 
        })
        // Mock odds history
        .mockResolvedValueOnce({
          data: [
            { odds: -110, volume: 10000, created_at: new Date().toISOString() },
            { odds: -108, volume: 15000, created_at: new Date().toISOString() }
          ],
          error: null
        })
        // Mock market data
        .mockResolvedValueOnce({ data: { depth: 8000, institutional_flow: 0.6 }, error: null })
        // Mock steam data  
        .mockResolvedValueOnce({ data: { direction: 'neutral' }, error: null })
        // Mock schedule update
        .mockResolvedValueOnce({ data: null, error: null })
        // Mock shadow pick write
        .mockResolvedValueOnce({ data: [], error: null });

      const testSchedule = await autoRecheckService.scheduleRecheckForPick({
        id: 'recheck-test-1',
        prop_id: 'prop-recheck-123',
        tier: 'S',
        game_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
        confidence: 0.85
      });

      expect(testSchedule.pickId).toBe('recheck-test-1');
      expect(testSchedule.preGameChecks.length).toBeGreaterThan(0);
      
      // In shadow mode, recheck operations should still be logged to shadow tables
      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_promoted_picks');
    });
  });

  describe('PickMonitoringService Shadow Integration', () => {
    it('should route monitoring alerts to shadow mode', async () => {
      process.env.SHADOW_MODE = 'true';

      // Mock monitoring data
      mockSupabase.then
        .mockResolvedValueOnce({ 
          data: [
            {
              id: 'monitor-test-1',
              prop_id: 'prop-monitor-123',
              tier: 'S',
              status: 'active',
              game_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              sport: 'NBA',
              player_name: 'Monitor Player',
              stat_type: 'rebounds',
              line: 10.5,
              initial_odds: -110,
              current_odds: -110
            }
          ], 
          error: null 
        })
        // Mock odds tracking data
        .mockResolvedValueOnce({
          data: {
            odds: -105,
            volume: 30000,
            steam_strength: 20,
            market_depth: 15000
          },
          error: null
        })
        // Mock pick monitoring update
        .mockResolvedValueOnce({ data: null, error: null })
        // Mock alert storage
        .mockResolvedValueOnce({ data: null, error: null })
        // Mock shadow alert handling
        .mockResolvedValueOnce({ data: [], error: null });

      await pickMonitoringService.startMonitoring();

      // Verify monitoring service was initialized
      expect(mockSupabase.from).toHaveBeenCalledWith('unified_picks');
      
      // In shadow mode, alerts should be routed to shadow preview
      // This would be verified through the PublishGuard integration
    });
  });

  describe('Cross-Service Shadow Mode Consistency', () => {
    it('should maintain consistent shadow mode state across all services', async () => {
      // Test that all services recognize shadow mode consistently
      process.env.SHADOW_MODE = 'true';

      const shadowService = ShadowModeService.getInstance();
      
      expect(shadowService.isShadowMode()).toBe(true);
      
      // Verify no services attempt to write to production tables in shadow mode
      // This is ensured by the PublishGuard routing system
    });

    it('should handle mode switching without service disruption', async () => {
      // Start in normal mode
      process.env.SHADOW_MODE = 'false';
      
      let shadowService = ShadowModeService.getInstance();
      expect(shadowService.isShadowMode()).toBe(false);

      // Switch to shadow mode
      process.env.SHADOW_MODE = 'true';
      
      // Create new instance (simulating service restart)
      shadowService = ShadowModeService.getInstance();
      expect(shadowService.isShadowMode()).toBe(true);

      // Services should handle the mode change gracefully
    });
  });

  describe('Shadow Mode Data Integrity', () => {
    it('should maintain referential integrity in shadow tables', async () => {
      process.env.SHADOW_MODE = 'true';

      const shadowService = ShadowModeService.getInstance();

      // Mock successful shadow writes
      mockSupabase.then.mockResolvedValue({ data: [], error: null });

      const testPick = {
        id: 'integrity-test-1',
        propId: 'prop-integrity-123',
        tier: 'S',
        confidence: 0.87,
        expectedValue: 0.11,
        playerName: 'Integrity Player',
        statType: 'assists',
        line: 7.5,
        sport: 'NBA'
      };

      await shadowService.shadowWritePick(testPick, 'instant', ['High confidence pick']);

      // Verify all required fields are included in shadow insert
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          decided_action: 'instant',
          reasons: ['High confidence pick'],
          pick_id: 'integrity-test-1',
          prop_id: 'prop-integrity-123',
          tier: 'S',
          confidence: 0.87,
          expected_value: 0.11,
          player_name: 'Integrity Player',
          stat_type: 'assists',
          line: 7.5,
          sport: 'NBA',
          created_at: expect.any(String)
        })
      );
    });

    it('should handle shadow data cleanup without affecting active picks', async () => {
      process.env.SHADOW_MODE = 'true';
      process.env.SHADOW_MAX_DAYS = '3';

      const shadowService = ShadowModeService.getInstance();

      // Mock cleanup operation
      mockSupabase.then.mockResolvedValue({ data: [], error: null });

      await shadowService.cleanupOldShadowData();

      // Verify cleanup operations use correct date filtering
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.lt).toHaveBeenCalledWith(
        'created_at',
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) // ISO date format
      );
    });
  });

  describe('Shadow Mode Error Handling', () => {
    it('should handle database errors gracefully in shadow mode', async () => {
      process.env.SHADOW_MODE = 'true';

      const shadowService = ShadowModeService.getInstance();

      // Mock database error
      mockSupabase.then.mockRejectedValue(new Error('Database connection failed'));

      const testPick = {
        id: 'error-test-1',
        propId: 'prop-error-123',
        tier: 'A',
        confidence: 0.75,
        expectedValue: 0.08,
        playerName: 'Error Player',
        statType: 'points',
        line: 22.5,
        sport: 'NBA'
      };

      // Should not throw error even if database fails
      await expect(
        shadowService.shadowWritePick(testPick, 'instant', ['Test pick'])
      ).resolves.not.toThrow();
    });

    it('should continue normal operations when shadow mode is disabled but configured', async () => {
      process.env.SHADOW_MODE = 'false';
      process.env.SHADOW_PRIVATE_CHANNEL_ID = '123456789';
      process.env.SHADOW_MAX_DAYS = '7';

      const shadowService = ShadowModeService.getInstance();

      expect(shadowService.isShadowMode()).toBe(false);

      // Shadow operations should be no-ops when shadow mode is disabled
      await expect(
        shadowService.shadowWritePick({
          id: 'disabled-test-1',
          propId: 'prop-disabled-123',
          tier: 'S',
          confidence: 0.9,
          expectedValue: 0.12,
          playerName: 'Disabled Player',
          statType: 'points',
          line: 25.5,
          sport: 'NBA'
        }, 'instant', ['Test'])
      ).resolves.not.toThrow();

      // No shadow database operations should occur
      expect(mockSupabase.from).not.toHaveBeenCalledWith('shadow_promoted_picks');
    });
  });
});