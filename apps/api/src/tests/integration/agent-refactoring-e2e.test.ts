/**
 * Agent Refactoring End-to-End Integration Tests
 * Tests all refactored agents working together in the unified_picks architecture
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { FeedAgent } from '../../agents/FeedAgent';
import { ScoringAgent } from '../../agents/ScoringAgent/ScoringAgent';
import { AlertAgent } from '../../agents/AlertAgent';
import { SettlementAgent } from '../../agents/SettlementAgent';
import { CacheFirstUnifiedPicksService } from '../../services/CacheFirstUnifiedPicksService';
import { createSupabaseClient } from '../../services/supabaseClient';
import { ProductionRedisService } from '../../services/productionRedis';

describe('Agent Refactoring E2E Tests', () => {
  let feedAgent: FeedAgent;
  let scoringAgent: ScoringAgent;
  let alertAgent: AlertAgent;
  let settlementAgent: SettlementAgent;
  let cacheFirstService: CacheFirstUnifiedPicksService;
  let supabaseClient: ReturnType<typeof createSupabaseClient>;
  let redisService: ProductionRedisService;

  beforeEach(async () => {
    // Initialize services
    redisService = new ProductionRedisService();
    supabaseClient = createSupabaseClient();
    cacheFirstService = new CacheFirstUnifiedPicksService(
      redisService,
      supabaseClient,
      console
    );

    // Initialize agents with test configuration
    const baseConfig = {
      healthCheckIntervalMs: 10000,
      maxConsecutiveFailures: 3,
      supabase: supabaseClient,
      logger: console
    };

    feedAgent = new FeedAgent(baseConfig);
    scoringAgent = new ScoringAgent({
      ...baseConfig,
      cacheFirstService
    });
    alertAgent = new AlertAgent({
      ...baseConfig,
      cacheFirstService,
      shadowMode: true // Test in shadow mode
    });
    settlementAgent = new SettlementAgent(baseConfig);

    // Clear test data
    await redisService.clear();
    await supabaseClient.from('unified_picks').delete().neq('id', '');
    await supabaseClient.from('cache.book_quotes').delete().neq('id', '');
    await supabaseClient.from('ops.alert_events').delete().neq('id', '');
  });

  afterEach(async () => {
    await feedAgent.stop();
    await scoringAgent.stop();
    await alertAgent.stop();
    await settlementAgent.stop();
    await redisService.disconnect();
  });

  describe('IngestionAgent (FeedAgent) E2E', () => {
    it('should write directly to unified_picks with cache coordination', async () => {
      // Mock provider data
      const mockGameData = {
        gameId: 'nba-game-1',
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        props: [{
          playerId: 'lebron-james',
          playerName: 'LeBron James',
          market: 'points',
          line: 25.5,
          overOdds: -110,
          underOdds: -110
        }]
      };

      jest.spyOn(feedAgent as any, 'fetchGameData')
        .mockResolvedValue(mockGameData);

      // Run ingestion
      await feedAgent.processGameData('nba-game-1');

      // Verify unified_picks entry
      const { data: picks } = await supabaseClient
        .from('unified_picks')
        .select('*')
        .eq('player_name', 'LeBron James');

      expect(picks).toHaveLength(2); // Over and under
      expect(picks?.[0].workflow_stage).toBe('ingested');
      expect(picks?.[0].source).toBe('optimal'); // Provider source

      // Verify cache.book_quotes entry
      const { data: quotes } = await supabaseClient
        .from('cache.book_quotes')
        .select('*')
        .eq('player_name', 'LeBron James');

      expect(quotes).toBeDefined();
      expect(quotes?.length).toBeGreaterThan(0);
    });

    it('should track credit usage and cache hits', async () => {
      const mockGameData = { gameId: 'test-game', props: [] };

      jest.spyOn(feedAgent as any, 'fetchGameData')
        .mockResolvedValue(mockGameData);

      await feedAgent.processGameData('test-game');

      // Verify credit usage tracking
      const { data: creditUsage } = await supabaseClient
        .from('ops.credit_usage')
        .select('*')
        .eq('provider', 'optimal')
        .order('created_at', { ascending: false })
        .limit(1);

      expect(creditUsage).toBeDefined();
      expect(creditUsage?.[0]).toMatchObject({
        provider: 'optimal',
        operation: 'fetch_game_data',
        credits_used: expect.any(Number)
      });
    });
  });

  describe('ScoringAgent E2E', () => {
    it('should perform in-place scoring updates on unified_picks', async () => {
      // Create test pick
      const testPick = {
        id: 'scoring-test-1',
        capper_id: 'test-capper',
        player_name: 'Test Player',
        stat_type: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        workflow_stage: 'ingested'
      };

      await cacheFirstService.createUnifiedPick(testPick);

      // Mock Enhanced45Factor scoring
      jest.spyOn(scoringAgent as any, 'calculateProfessionalScore')
        .mockResolvedValue({
          professionalScore: 0.85,
          featureContributions: {
            marketIntelligence: 0.20,
            playerPerformance: 0.25,
            teamContext: 0.15,
            situational: 0.10,
            advancedAnalytics: 0.15
          },
          kellyFraction: 0.12,
          clvTrackingId: 'clv-test-1'
        });

      // Run scoring
      await scoringAgent.scoreUnifiedPickInPlace('scoring-test-1');

      // Verify in-place updates
      const updated = await cacheFirstService.getUnifiedPick('scoring-test-1');

      expect(updated).toMatchObject({
        professional_score: 0.85,
        kelly_fraction: 0.12,
        clv_tracking_id: 'clv-test-1',
        workflow_stage: 'scored',
        scored_at: expect.any(String)
      });

      expect(updated?.feature_contributions).toMatchObject({
        marketIntelligence: 0.20,
        playerPerformance: 0.25
      });
    });

    it('should process batches with cache warming', async () => {
      // Create multiple test picks
      const testPicks = Array.from({ length: 10 }, (_, i) => ({
        id: `batch-test-${i}`,
        capper_id: 'test-capper',
        player_name: `Player ${i}`,
        stat_type: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        workflow_stage: 'ingested'
      }));

      await Promise.all(
        testPicks.map(pick => cacheFirstService.createUnifiedPick(pick))
      );

      // Mock batch scoring
      jest.spyOn(scoringAgent as any, 'calculateProfessionalScore')
        .mockResolvedValue({
          professionalScore: 0.75,
          featureContributions: {},
          kellyFraction: 0.08,
          clvTrackingId: 'batch-clv'
        });

      // Run batch processing
      const pickIds = testPicks.map(p => p.id);
      await scoringAgent.processBatchedWithCache(pickIds);

      // Verify all picks were scored
      const { data: scoredPicks } = await supabaseClient
        .from('unified_picks')
        .select('id, professional_score, workflow_stage')
        .in('id', pickIds);

      expect(scoredPicks).toHaveLength(10);
      scoredPicks?.forEach(pick => {
        expect(pick.professional_score).toBe(0.75);
        expect(pick.workflow_stage).toBe('scored');
      });
    });
  });

  describe('AlertAgent E2E', () => {
    it('should read only from cache and never call providers', async () => {
      // Create test data in cache
      const testQuote = {
        id: 'cache-quote-1',
        player_name: 'Test Player',
        market: 'points',
        book: 'draftkings',
        odds: -105,
        line: 25.5,
        last_updated: new Date().toISOString()
      };

      await supabaseClient.from('cache.book_quotes').insert(testQuote);

      // Mock provider calls to ensure they're never made
      const providerSpy = jest.fn().mockRejectedValue(new Error('Provider should not be called'));
      jest.spyOn(alertAgent as any, 'callProvider').mockImplementation(providerSpy);

      // Process alert (should use cache only)
      await alertAgent.processAlert({
        type: 'steam_alert',
        playerName: 'Test Player',
        market: 'points'
      });

      // Verify provider was never called
      expect(providerSpy).not.toHaveBeenCalled();

      // Verify alert was processed and stored
      const { data: alerts } = await supabaseClient
        .from('ops.alert_events')
        .select('*')
        .eq('player_name', 'Test Player');

      expect(alerts).toBeDefined();
      expect(alerts?.length).toBeGreaterThan(0);
    });

    it('should respect shadow mode and suppress Discord alerts', async () => {
      const mockDiscordSend = jest.fn().mockResolvedValue(true);
      jest.spyOn(alertAgent as any, 'sendDiscordAlert')
        .mockImplementation(mockDiscordSend);

      // Process alert in shadow mode
      await alertAgent.processAlert({
        type: 'tier_promotion',
        pickId: 'test-pick-1',
        fromTier: 'B',
        toTier: 'A'
      });

      // Verify Discord alert was suppressed
      expect(mockDiscordSend).not.toHaveBeenCalled();

      // Verify alert was still logged for analysis
      const { data: alerts } = await supabaseClient
        .from('ops.alert_events')
        .select('*')
        .eq('alert_type', 'tier_promotion');

      expect(alerts?.[0]).toMatchObject({
        alert_type: 'tier_promotion',
        shadow_mode: true,
        status: 'shadow_suppressed'
      });
    });

    it('should implement comprehensive deduplication', async () => {
      const alertData = {
        type: 'steam_alert',
        pickId: 'dedup-test-1',
        steamScore: 85
      };

      // Send same alert multiple times
      await alertAgent.processAlert(alertData);
      await alertAgent.processAlert(alertData);
      await alertAgent.processAlert(alertData);

      // Verify only one alert was stored
      const { data: alerts } = await supabaseClient
        .from('ops.alert_events')
        .select('*')
        .eq('pick_id', 'dedup-test-1');

      expect(alerts).toHaveLength(1);
      expect(alerts?.[0].deduplication_count).toBe(3);
    });
  });

  describe('Complete E2E Workflow', () => {
    it('should execute complete flow: ingest → score → alert', async () => {
      // 1. Ingestion
      const mockGameData = {
        gameId: 'e2e-game',
        props: [{
          playerId: 'e2e-player',
          playerName: 'E2E Test Player',
          market: 'points',
          line: 28.5,
          overOdds: -110,
          underOdds: -110
        }]
      };

      jest.spyOn(feedAgent as any, 'fetchGameData')
        .mockResolvedValue(mockGameData);

      await feedAgent.processGameData('e2e-game');

      // 2. Scoring
      jest.spyOn(scoringAgent as any, 'calculateProfessionalScore')
        .mockResolvedValue({
          professionalScore: 0.92,
          featureContributions: { total: 0.92 },
          kellyFraction: 0.15,
          clvTrackingId: 'e2e-clv'
        });

      const { data: ingestedPicks } = await supabaseClient
        .from('unified_picks')
        .select('id')
        .eq('player_name', 'E2E Test Player')
        .eq('workflow_stage', 'ingested');

      expect(ingestedPicks).toHaveLength(2);

      for (const pick of ingestedPicks!) {
        await scoringAgent.scoreUnifiedPickInPlace(pick.id);
      }

      // 3. Verify scoring completed
      const { data: scoredPicks } = await supabaseClient
        .from('unified_picks')
        .select('*')
        .eq('player_name', 'E2E Test Player')
        .eq('workflow_stage', 'scored');

      expect(scoredPicks).toHaveLength(2);
      expect(scoredPicks?.[0].professional_score).toBe(0.92);

      // 4. Alert processing (shadow mode - no Discord)
      await alertAgent.processAlert({
        type: 'tier_promotion',
        pickId: scoredPicks![0].id,
        professionalScore: 0.92
      });

      // 5. Verify complete workflow
      const { data: alerts } = await supabaseClient
        .from('ops.alert_events')
        .select('*')
        .eq('pick_id', scoredPicks![0].id);

      expect(alerts).toHaveLength(1);
      expect(alerts?.[0].alert_type).toBe('tier_promotion');
      expect(alerts?.[0].shadow_mode).toBe(true);

      // Verify cache performance throughout
      const cacheMetrics = await cacheFirstService.getCacheMetrics();
      expect(cacheMetrics.hitRate).toBeGreaterThan(0.5); // Reasonable hit rate for E2E test
    });
  });
});