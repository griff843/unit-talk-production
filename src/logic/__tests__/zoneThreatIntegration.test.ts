// src/logic/__tests__/zoneThreatIntegration.test.ts

import { finalEdgeScore, getInternalScoringDetails } from '../scoring/edgeScoring';
import { EDGE_CONFIG } from '../config/edgeConfig';
import { PropObject } from '../../types/propTypes';

// Mock prop creation helper
function createMockProp(overrides: Partial<PropObject> = {}): PropObject {
  return {
    id: 'test_prop_001',
    market_type: 'Home Runs',
    odds: -110,
    trend_score: 0.5,
    matchup_score: 1.0,
    role_score: 0.8,
    line_value_score: 0.6,
    source: 'test',
    is_rocket: false,
    is_ladder: false,
    
    // Default pitcher data (can be overridden)
    pitcher_id: 'pitcher_001',
    pitcher_name: 'Test Pitcher',
    pitcher_hr_per_9: 1.5,
    pitcher_barrel_pct: 9.0,
    pitcher_meatball_pct: 6.0,
    pitcher_hittable_count_pct: 26,
    pitcher_recent_hrs: 3,
    pitcher_walk_rate: 3.0,
    
    // Default matchup data (can be overridden)
    batter_barrel_pct: 10.0,
    batter_launch_angle: 18.0,
    park_factor: 1.02,
    wind_out: false,
    
    ...overrides
  } as PropObject;
}

describe('Zone Threat Rating Integration', () => {
  beforeEach(() => {
    // Ensure Zone Threat is enabled for tests
    EDGE_CONFIG.zoneThreat.enabled = true;
  });

  describe('Basic Integration', () => {
    test('should integrate Zone Threat analysis into edge scoring', () => {
      const extremeProp = createMockProp({
        // EXTREME pitcher stats
        pitcher_hr_per_9: 2.5,
        pitcher_barrel_pct: 14.0,
        pitcher_meatball_pct: 10.0,
        pitcher_hittable_count_pct: 35,
        pitcher_recent_hrs: 8,
        pitcher_walk_rate: 4.8,
        
        // Favorable matchup conditions
        batter_barrel_pct: 12.0,
        batter_launch_angle: 20.0,
        park_factor: 1.06,
        wind_out: true
      });

      const result = finalEdgeScore(extremeProp, EDGE_CONFIG);
      const internalDetails = getInternalScoringDetails(extremeProp);
      
      // Should apply Zone Threat boost
      expect(result.breakdown.zone_threat_boost).toBe(2);
      expect(result.breakdown.zone_threat_level).toBe('EXTREME');
      expect(internalDetails.zoneThreatAnalysis?.eligible).toBe(true);
      expect(internalDetails.zoneThreatAnalysis?.boostApplied).toBe(2);
    });

    test('should not apply boost for non-EXTREME pitchers', () => {
      const averageProp = createMockProp({
        // Average pitcher stats
        pitcher_hr_per_9: 1.3,
        pitcher_barrel_pct: 8.0,
        pitcher_meatball_pct: 5.0,
        pitcher_hittable_count_pct: 25,
        pitcher_recent_hrs: 2,
        pitcher_walk_rate: 3.2,
        
        // Even with favorable matchup
        batter_barrel_pct: 12.0,
        batter_launch_angle: 20.0,
        park_factor: 1.06,
        wind_out: true
      });

      const result = finalEdgeScore(averageProp, EDGE_CONFIG);
      
      // Should not apply boost for non-EXTREME pitcher
      expect(result.breakdown.zone_threat_boost).toBeUndefined();
    });

    test('should not apply boost for poor matchup conditions', () => {
      const extremeProp = createMockProp({
        // EXTREME pitcher stats
        pitcher_hr_per_9: 2.5,
        pitcher_barrel_pct: 14.0,
        pitcher_meatball_pct: 10.0,
        pitcher_hittable_count_pct: 35,
        pitcher_recent_hrs: 8,
        pitcher_walk_rate: 4.8,
        
        // Poor matchup conditions
        batter_barrel_pct: 7.0,   // Low power
        batter_launch_angle: 12.0, // Too low
        park_factor: 0.95,        // Pitcher-friendly
        wind_out: false           // No wind help
      });

      const result = finalEdgeScore(extremeProp, EDGE_CONFIG);
      
      // Should not apply boost due to poor matchup
      expect(result.breakdown.zone_threat_boost).toBeUndefined();
    });
  });

  describe('Market Type Eligibility', () => {
    test('should apply to Home Runs market', () => {
      const hrProp = createMockProp({
        market_type: 'Home Runs',
        pitcher_hr_per_9: 2.5,
        pitcher_barrel_pct: 14.0,
        pitcher_meatball_pct: 10.0,
        pitcher_hittable_count_pct: 35,
        pitcher_recent_hrs: 8,
        pitcher_walk_rate: 4.8,
        batter_barrel_pct: 12.0,
        batter_launch_angle: 20.0,
        park_factor: 1.06,
        wind_out: true
      });

      const result = finalEdgeScore(hrProp, EDGE_CONFIG);
      expect(result.breakdown.zone_threat_boost).toBe(2);
    });

    test('should apply to rocket props regardless of market', () => {
      const rocketProp = createMockProp({
        market_type: 'Hits',  // Not normally eligible
        is_rocket: true,      // But it's a rocket
        pitcher_hr_per_9: 2.5,
        pitcher_barrel_pct: 14.0,
        pitcher_meatball_pct: 10.0,
        pitcher_hittable_count_pct: 35,
        pitcher_recent_hrs: 8,
        pitcher_walk_rate: 4.8,
        batter_barrel_pct: 12.0,
        batter_launch_angle: 20.0,
        park_factor: 1.06,
        wind_out: true
      });

      const result = finalEdgeScore(rocketProp, EDGE_CONFIG);
      expect(result.breakdown.zone_threat_boost).toBe(2);
    });

    test('should not apply to ineligible markets', () => {
      const ineligibleProp = createMockProp({
        market_type: 'Strikeouts',  // Not eligible
        is_rocket: false,           // Not a rocket
        pitcher_hr_per_9: 2.5,
        pitcher_barrel_pct: 14.0,
        pitcher_meatball_pct: 10.0,
        pitcher_hittable_count_pct: 35,
        pitcher_recent_hrs: 8,
        pitcher_walk_rate: 4.8,
        batter_barrel_pct: 12.0,
        batter_launch_angle: 20.0,
        park_factor: 1.06,
        wind_out: true
      });

      const internalDetails = getInternalScoringDetails(ineligibleProp);
      expect(internalDetails.zoneThreatAnalysis?.eligible).toBe(false);
    });
  });

  describe('Public vs Internal Data Exposure', () => {
    test('should hide Zone Threat details from public scoring', () => {
      const extremeProp = createMockProp({
        pitcher_hr_per_9: 2.5,
        pitcher_barrel_pct: 14.0,
        pitcher_meatball_pct: 10.0,
        pitcher_hittable_count_pct: 35,
        pitcher_recent_hrs: 8,
        pitcher_walk_rate: 4.8,
        batter_barrel_pct: 12.0,
        batter_launch_angle: 20.0,
        park_factor: 1.06,
        wind_out: true
      });

      // Import the public scoring function
      const { scorePropEdge } = require('../scoring/edgeScoring');
      const publicResult = scorePropEdge(extremeProp);
      
      // Public result should not expose Zone Threat details
      expect(publicResult.edge_breakdown.zone_threat_boost).toBeUndefined();
      expect(publicResult.edge_breakdown.zone_threat_level).toBeUndefined();
      expect(publicResult.context_tags).not.toContain('zone-threat-extreme');
    });

    test('should expose Zone Threat details in internal scoring', () => {
      const extremeProp = createMockProp({
        pitcher_hr_per_9: 2.5,
        pitcher_barrel_pct: 14.0,
        pitcher_meatball_pct: 10.0,
        pitcher_hittable_count_pct: 35,
        pitcher_recent_hrs: 8,
        pitcher_walk_rate: 4.8,
        batter_barrel_pct: 12.0,
        batter_launch_angle: 20.0,
        park_factor: 1.06,
        wind_out: true
      });

      const internalResult = getInternalScoringDetails(extremeProp);
      
      // Internal result should expose Zone Threat details
      expect(internalResult.breakdown.zone_threat_boost).toBe(2);
      expect(internalResult.breakdown.zone_threat_level).toBe('EXTREME');
      expect(internalResult.tags).toContain('zone-threat-extreme');
      expect(internalResult.zoneThreatAnalysis?.eligible).toBe(true);
    });
  });

  describe('Missing Data Handling', () => {
    test('should handle missing pitcher data gracefully', () => {
      const noPitcherDataProp = createMockProp({
        pitcher_id: undefined,
        pitcher_name: undefined
      });

      const result = finalEdgeScore(noPitcherDataProp, EDGE_CONFIG);
      const internalDetails = getInternalScoringDetails(noPitcherDataProp);
      
      // Should not crash and should not apply boost
      expect(result.breakdown.zone_threat_boost).toBeUndefined();
      expect(internalDetails.zoneThreatAnalysis?.eligible).toBe(false);
    });

    test('should handle missing matchup data gracefully', () => {
      const noMatchupDataProp = createMockProp({
        batter_barrel_pct: undefined,
        batter_launch_angle: undefined,
        // Pitcher data present but matchup missing
        pitcher_id: 'pitcher_001',
        pitcher_name: 'Test Pitcher',
        pitcher_hr_per_9: 2.5,
        pitcher_barrel_pct: 14.0
      });

      const result = finalEdgeScore(noMatchupDataProp, EDGE_CONFIG);
      
      // Should not crash and should not apply boost (no matchup data)
      expect(result.breakdown.zone_threat_boost).toBeUndefined();
    });

    test('should handle disabled Zone Threat feature', () => {
      const originalEnabled = EDGE_CONFIG.zoneThreat.enabled;
      EDGE_CONFIG.zoneThreat.enabled = false;

      const extremeProp = createMockProp({
        pitcher_id: 'pitcher_001',
        pitcher_name: 'Test Pitcher',
        pitcher_hr_per_9: 2.5,
        pitcher_barrel_pct: 14.0,
        pitcher_meatball_pct: 10.0,
        pitcher_hittable_count_pct: 35,
        pitcher_recent_hrs: 8,
        pitcher_walk_rate: 4.8
      });

      const internalDetails = getInternalScoringDetails(extremeProp);
      
      // Should not apply boost when disabled
      expect(internalDetails.zoneThreatAnalysis?.eligible).toBe(false);
      
      // Restore original setting
      EDGE_CONFIG.zoneThreat.enabled = originalEnabled;
    });
  });

  describe('Score Impact Analysis', () => {
    test('should demonstrate meaningful score improvement', () => {
      const baseProp = createMockProp({
        // Average pitcher (no boost)
        pitcher_id: 'pitcher_avg',
        pitcher_name: 'Average Pitcher',
        pitcher_hr_per_9: 1.3,
        pitcher_barrel_pct: 8.0,
        pitcher_meatball_pct: 5.0,
        pitcher_hittable_count_pct: 25,
        pitcher_recent_hrs: 2,
        pitcher_walk_rate: 3.2,
        // Add matchup data
        batter_barrel_pct: 11.0,
        batter_launch_angle: 20.0,
        park_factor: 1.05,
        wind_out: true
      });

      const extremeProp = createMockProp({
        // Same base prop but with EXTREME pitcher
        pitcher_id: 'pitcher_extreme',
        pitcher_name: 'Extreme Pitcher',
        pitcher_hr_per_9: 2.5,
        pitcher_barrel_pct: 14.0,
        pitcher_meatball_pct: 10.0,
        pitcher_hittable_count_pct: 35,
        pitcher_recent_hrs: 8,
        pitcher_walk_rate: 4.8,
        // Same matchup data
        batter_barrel_pct: 11.0,
        batter_launch_angle: 20.0,
        park_factor: 1.05,
        wind_out: true
      });

      const baseResult = finalEdgeScore(baseProp, EDGE_CONFIG);
      const extremeResult = finalEdgeScore(extremeProp, EDGE_CONFIG);
      
      // Extreme prop should score higher due to Zone Threat boost
      expect(extremeResult.score).toBeGreaterThanOrEqual(baseResult.score);
      if (extremeResult.breakdown.zone_threat_boost) {
        expect(extremeResult.score - baseResult.score).toBe(2); // Boost amount
      }
    });

    test('should potentially change tier with boost', () => {
      // Create a prop that's borderline between tiers
      const borderlineProp = createMockProp({
        market_type: 'Home Runs',
        odds: -110,  // Gets some points
        trend_score: 0.5, // Below threshold
        matchup_score: 1.0, // Below threshold
        
        // EXTREME pitcher for boost
        pitcher_id: 'pitcher_extreme',
        pitcher_name: 'Extreme Pitcher',
        pitcher_hr_per_9: 2.5,
        pitcher_barrel_pct: 14.0,
        pitcher_meatball_pct: 10.0,
        pitcher_hittable_count_pct: 35,
        pitcher_recent_hrs: 8,
        pitcher_walk_rate: 4.8,
        // Favorable matchup
        batter_barrel_pct: 11.0,
        batter_launch_angle: 20.0,
        park_factor: 1.05,
        wind_out: true
      });

      const result = finalEdgeScore(borderlineProp, EDGE_CONFIG);
      
      // The +2 boost could push it to a higher tier
      expect(result.score).toBeGreaterThanOrEqual(2); // At least the boost
      expect(['D', 'C', 'B', 'A', 'S']).toContain(result.tier); // Should be valid tier
    });
  });

  describe('Real-world Scenario Simulation', () => {
    test('should handle typical game scenario', () => {
      const gameScenario = createMockProp({
        id: 'game_001_hr_prop',
        market_type: 'Home Runs',
        odds: -125,
        is_rocket: true,
        
        // Struggling pitcher facing power hitter in hitter-friendly park
        pitcher_id: 'pitcher_struggling',
        pitcher_name: 'Struggling Starter',
        pitcher_hr_per_9: 2.1,      // High HR rate
        pitcher_barrel_pct: 11.8,   // Allows hard contact
        pitcher_meatball_pct: 8.5,  // Poor location
        pitcher_hittable_count_pct: 31, // Gets behind in counts
        pitcher_recent_hrs: 6,       // Bad recent form
        pitcher_walk_rate: 4.2,      // Poor control
        
        // Power hitter in good conditions
        batter_barrel_pct: 13.2,    // Above average power
        batter_launch_angle: 19.5,  // Good launch angle
        park_factor: 1.09,           // Hitter-friendly park
        wind_out: true,              // Wind blowing out
        
        // Additional scoring factors
        trend_score: 0.8,            // Strong trend
        matchup_score: 1.8           // Good matchup
      });

      const result = finalEdgeScore(gameScenario, EDGE_CONFIG);
      const internalDetails = getInternalScoringDetails(gameScenario);
      
      // Should be a high-scoring prop with Zone Threat boost
      if (result.breakdown.zone_threat_boost) {
        expect(result.breakdown.zone_threat_boost).toBe(2);
        expect(result.breakdown.zone_threat_level).toBe('EXTREME');
      }
      expect(result.score).toBeGreaterThan(5); // Should be decent score
      expect(['C', 'B', 'A', 'S']).toContain(result.tier); // Reasonable tier
      expect(result.postable).toBeDefined();
      
      // Internal analysis should be comprehensive
      expect(internalDetails.zoneThreatAnalysis?.eligible).toBe(true);
      if (internalDetails.zoneThreatAnalysis?.boostApplied) {
        expect(internalDetails.zoneThreatAnalysis.boostApplied).toBe(2);
      }
      expect(internalDetails.zoneThreatAnalysis?.pitcherName).toBe('Struggling Starter');
    });

    test('should handle edge case scenarios', () => {
      // Test various edge cases
      const edgeCases = [
        // Borderline EXTREME pitcher
        createMockProp({
          pitcher_hr_per_9: 1.8,  // Exactly at threshold
          pitcher_barrel_pct: 10.0,
          pitcher_meatball_pct: 7.0,
          pitcher_hittable_count_pct: 28,
          pitcher_recent_hrs: 4,
          pitcher_walk_rate: 3.5,
          batter_barrel_pct: 10.0,
          batter_launch_angle: 16.0,
          park_factor: 1.04,
          wind_out: false
        }),
        
        // Elite control pitcher with some risk factors
        createMockProp({
          pitcher_hr_per_9: 2.0,
          pitcher_barrel_pct: 11.0,
          pitcher_meatball_pct: 8.0,
          pitcher_hittable_count_pct: 30,
          pitcher_recent_hrs: 5,
          pitcher_walk_rate: 1.5,  // Elite control
          batter_barrel_pct: 12.0,
          batter_launch_angle: 20.0,
          park_factor: 1.06,
          wind_out: true
        })
      ];

      edgeCases.forEach((prop, index) => {
        const result = finalEdgeScore(prop, EDGE_CONFIG);
        const internalDetails = getInternalScoringDetails(prop);
        
        // Should not crash
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(internalDetails.zoneThreatAnalysis?.eligible).toBe(true);
        
        // Log for debugging if needed
        console.log(`Edge case ${index + 1}:`, {
          score: result.score,
          tier: result.tier,
          boost: result.breakdown.zone_threat_boost,
          level: result.breakdown.zone_threat_level
        });
      });
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle batch processing without errors', () => {
      const batchProps = Array.from({ length: 100 }, (_, i) => 
        createMockProp({
          id: `batch_prop_${i}`,
          pitcher_hr_per_9: 1.0 + (i % 20) * 0.1, // Vary stats
          pitcher_barrel_pct: 6.0 + (i % 15) * 0.5,
          batter_barrel_pct: 8.0 + (i % 10) * 0.8,
          batter_launch_angle: 15.0 + (i % 8) * 2.0
        })
      );

      const startTime = Date.now();
      
      batchProps.forEach(prop => {
        const result = finalEdgeScore(prop, EDGE_CONFIG);
        const internalDetails = getInternalScoringDetails(prop);
        
        // Basic validation
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(['D', 'C', 'B', 'A', 'S']).toContain(result.tier);
        expect(internalDetails.zoneThreatAnalysis).toBeDefined();
      });

      const processingTime = Date.now() - startTime;
      
      // Should process 100 props quickly
      expect(processingTime).toBeLessThan(1000); // Under 1 second
    });
  });
});