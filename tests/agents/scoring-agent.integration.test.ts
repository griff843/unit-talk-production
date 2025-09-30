import { ScoringAgent } from '../../apps/api/src/agents/ScoringAgent';
import { supabase } from '../../apps/api/src/services/supabaseClient';
import { Database } from '../../apps/api/src/db/types/supabase';
import { jest } from '@jest/globals';

/**
 * Integration tests for ScoringAgent E2E workflow
 * Tests: in-place scoring updates with feature_contributions
 */
describe('ScoringAgent Integration Tests', () => {
  let scoringAgent: ScoringAgent;
  const testPropId = 'scoring_test_prop_mahomes';
  const testGameId = 'scoring_test_game_001';

  beforeAll(async () => {
    scoringAgent = new ScoringAgent({
      name: 'test-scoring-agent',
      enabled: true,
      interval: 60000,
      healthCheckInterval: 30000,
      maxRetries: 3
    }, {
      supabase,
      logger: console
    });

    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Professional Grading E2E', () => {
    test('processes pick through complete professional pipeline', async () => {
      const startTime = Date.now();
      
      const result = await scoringAgent.scorePick(testPropId);
      
      expect(result.success).toBe(true);
      expect(result.professional_score).toBeGreaterThan(0);
      expect(result.professional_score).toBeLessThanOrEqual(1);
      expect(result.feature_contributions).toBeDefined();
      expect(result.processing_time).toBeGreaterThan(0);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(2000); // < 2 second target
    });

    test('updates unified_picks with professional grading data', async () => {
      await scoringAgent.scorePick(testPropId);

      const { data: pick, error } = await supabase
        .from('unified_picks')
        .select('*')
        .eq('external_prop_id', testPropId)
        .single();

      expect(error).toBeNull();
      expect(pick).toBeDefined();

      // Professional grading fields populated
      expect(pick.professional_score).toBeGreaterThan(0);
      expect(pick.feature_contributions).toBeDefined();
      expect(pick.devigged_edge).toBeDefined();
      expect(pick.kelly_fraction).toBeGreaterThan(0);
      expect(pick.clv_tracking_id).toBeDefined();
      expect(pick.processing_time).toBeGreaterThan(0);

      // Verify feature contributions structure
      const features = pick.feature_contributions as any;
      expect(typeof features).toBe('object');
      expect(features.steam_detection).toBeDefined();
      expect(features.line_movement).toBeDefined();
      expect(features.market_consensus).toBeDefined();
      expect(features.player_performance).toBeDefined();
      expect(features.matchup_analysis).toBeDefined();
    });

    test('calculates devigged edge correctly', async () => {
      await scoringAgent.scorePick(testPropId);

      const { data: pick } = await supabase
        .from('unified_picks')
        .select('devigged_edge, odds_over, odds_under')
        .eq('external_prop_id', testPropId)
        .single();

      expect(pick!.devigged_edge).toBeDefined();
      expect(pick!.devigged_edge).toBeGreaterThan(-1);
      expect(pick!.devigged_edge).toBeLessThan(1);

      // Verify devigging removes vig from odds
      const originalImpliedProb = 1 / (Math.abs(pick!.odds_over) / 100 + 1) + 
                                  1 / (Math.abs(pick!.odds_under) / 100 + 1);
      expect(originalImpliedProb).toBeGreaterThan(1); // Should have vig
      expect(Math.abs(pick!.devigged_edge)).toBeLessThan(0.5); // Reasonable edge
    });

    test('calculates Kelly fraction based on edge and confidence', async () => {
      await scoringAgent.scorePick(testPropId);

      const { data: pick } = await supabase
        .from('unified_picks')
        .select('kelly_fraction, devigged_edge, professional_score')
        .eq('external_prop_id', testPropId)
        .single();

      expect(pick!.kelly_fraction).toBeGreaterThan(0);
      expect(pick!.kelly_fraction).toBeLessThanOrEqual(0.25); // Max 25% Kelly

      // Kelly should correlate with edge and confidence
      const expectedKelly = (pick!.devigged_edge * pick!.professional_score) / 
                           Math.abs(pick!.devigged_edge);
      expect(Math.abs(pick!.kelly_fraction - Math.abs(expectedKelly))).toBeLessThan(0.1);
    });
  });

  describe('195-Factor Enhanced Scoring', () => {
    test('calculates all 195 factor categories', async () => {
      await scoringAgent.scorePick(testPropId);

      const { data: pick } = await supabase
        .from('unified_picks')
        .select('feature_contributions')
        .eq('external_prop_id', testPropId)
        .single();

      const features = pick!.feature_contributions as any;

      // Market Intelligence (25 factors)
      expect(features.market_intelligence).toBeDefined();
      expect(features.market_intelligence.steam_detection).toBeDefined();
      expect(features.market_intelligence.sharp_money).toBeDefined();
      expect(features.market_intelligence.line_movement).toBeDefined();
      expect(features.market_intelligence.volume_spikes).toBeDefined();
      expect(features.market_intelligence.consensus_deviation).toBeDefined();

      // Player Performance (40 factors)
      expect(features.player_performance).toBeDefined();
      expect(features.player_performance.rolling_averages).toBeDefined();
      expect(features.player_performance.matchup_history).toBeDefined();
      expect(features.player_performance.injury_impact).toBeDefined();
      expect(features.player_performance.usage_trends).toBeDefined();

      // Team Context (30 factors)
      expect(features.team_context).toBeDefined();
      expect(features.team_context.game_script).toBeDefined();
      expect(features.team_context.pace_factors).toBeDefined();
      expect(features.team_context.coaching_tendencies).toBeDefined();

      // Situational (25 factors)
      expect(features.situational).toBeDefined();
      expect(features.situational.playoff_implications).toBeDefined();
      expect(features.situational.rivalry_factors).toBeDefined();
      expect(features.situational.primetime_effects).toBeDefined();

      // Advanced Analytics (25 factors)
      expect(features.advanced_analytics).toBeDefined();
      expect(features.advanced_analytics.xgboost_predictions).toBeDefined();
      expect(features.advanced_analytics.neural_networks).toBeDefined();
      expect(features.advanced_analytics.ensemble_models).toBeDefined();

      // Risk Management (25 factors)
      expect(features.risk_management).toBeDefined();
      expect(features.risk_management.kelly_sizing).toBeDefined();
      expect(features.risk_management.portfolio_correlation).toBeDefined();
      expect(features.risk_management.variance_estimation).toBeDefined();

      // ML-Derived (25 factors)
      expect(features.ml_derived).toBeDefined();
      expect(features.ml_derived.feature_importance).toBeDefined();
      expect(features.ml_derived.prediction_intervals).toBeDefined();
      expect(features.ml_derived.model_uncertainty).toBeDefined();
    });

    test('assigns appropriate tier based on professional score', async () => {
      await scoringAgent.scorePick(testPropId);

      const { data: pick } = await supabase
        .from('unified_picks')
        .select('professional_score, tier')
        .eq('external_prop_id', testPropId)
        .single();

      expect(pick!.tier).toBeDefined();
      
      // Verify tier assignment logic
      if (pick!.professional_score >= 0.85) {
        expect(pick!.tier).toBe('S');
      } else if (pick!.professional_score >= 0.75) {
        expect(pick!.tier).toBe('A');
      } else if (pick!.professional_score >= 0.65) {
        expect(pick!.tier).toBe('B');
      } else if (pick!.professional_score >= 0.55) {
        expect(pick!.tier).toBe('C');
      } else {
        expect(pick!.tier).toBe('D');
      }
    });
  });

  describe('Batch Processing Performance', () => {
    test('processes multiple picks efficiently', async () => {
      const testPropIds = [
        'batch_test_prop_1',
        'batch_test_prop_2',
        'batch_test_prop_3',
        'batch_test_prop_4',
        'batch_test_prop_5'
      ];

      // Insert test picks
      for (const propId of testPropIds) {
        await supabase.from('unified_picks').insert({
          external_prop_id: propId,
          external_game_id: `batch_test_game`,
          source: 'optimal',
          sport: 'nfl',
          market: 'passing_yards',
          player_name: `Test Player ${propId}`,
          line: 275.5,
          odds_over: -110,
          odds_under: -110,
          team: 'Team A',
          opponent: 'Team B',
          game_date: '2024-01-21'
        });
      }

      const startTime = Date.now();
      const results = await scoringAgent.batchScorePicks(testPropIds);
      const processingTime = Date.now() - startTime;

      expect(results.success).toBe(true);
      expect(results.picksProcessed).toBe(5);
      expect(processingTime).toBeLessThan(5000); // < 5 seconds for 5 picks
      expect(processingTime / 5).toBeLessThan(1000); // < 1 second per pick average

      // Verify all picks were scored
      const { data: scoredPicks } = await supabase
        .from('unified_picks')
        .select('professional_score')
        .in('external_prop_id', testPropIds)
        .not('professional_score', 'is', null);

      expect(scoredPicks!.length).toBe(5);

      // Cleanup
      await supabase
        .from('unified_picks')
        .delete()
        .in('external_prop_id', testPropIds);
    });
  });

  describe('Error Handling', () => {
    test('handles missing pick data gracefully', async () => {
      const result = await scoringAgent.scorePick('nonexistent_prop');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Pick not found');
    });

    test('handles incomplete pick data', async () => {
      // Insert incomplete pick
      await supabase.from('unified_picks').insert({
        external_prop_id: 'incomplete_prop',
        external_game_id: 'incomplete_game',
        source: 'optimal',
        sport: 'nfl',
        // Missing required fields like market, player_name, etc.
        line: 275.5,
        odds_over: -110,
        odds_under: -110
      });

      const result = await scoringAgent.scorePick('incomplete_prop');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Cleanup
      await supabase
        .from('unified_picks')
        .delete()
        .eq('external_prop_id', 'incomplete_prop');
    });
  });

  describe('CLV Tracking Integration', () => {
    test('initiates CLV tracking for all scored picks', async () => {
      await scoringAgent.scorePick(testPropId);

      const { data: pick } = await supabase
        .from('unified_picks')
        .select('clv_tracking_id')
        .eq('external_prop_id', testPropId)
        .single();

      expect(pick!.clv_tracking_id).toBeDefined();
      expect(pick!.clv_tracking_id.length).toBeGreaterThan(0);

      // Verify CLV tracking entry was created
      const { data: clvEntry } = await supabase
        .from('clv_tracking')
        .select('*')
        .eq('id', pick!.clv_tracking_id)
        .single();

      expect(clvEntry).toBeDefined();
      expect(clvEntry!.external_prop_id).toBe(testPropId);
      expect(clvEntry!.initial_odds_over).toBe(-110);
      expect(clvEntry!.initial_odds_under).toBe(-110);
    });
  });

  // Helper functions
  async function setupTestData() {
    await supabase.from('unified_picks').insert({
      external_prop_id: testPropId,
      external_game_id: testGameId,
      source: 'optimal',
      sport: 'nfl',
      market: 'passing_yards',
      player_name: 'Patrick Mahomes',
      line: 275.5,
      odds_over: -110,
      odds_under: -110,
      team: 'Kansas City Chiefs',
      opponent: 'Buffalo Bills',
      game_date: '2024-01-21'
    });
  }

  async function cleanupTestData() {
    await supabase
      .from('unified_picks')
      .delete()
      .in('external_prop_id', [testPropId, 'incomplete_prop']);
      
    await supabase
      .from('clv_tracking')
      .delete()
      .eq('external_prop_id', testPropId);
  }
});
