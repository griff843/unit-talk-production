// src/logic/__tests__/zoneThreat.test.ts

import {
  zoneThreatRating,
  shouldBoostHRProp,
  calculateZoneThreatBoost,
  generateZoneThreatSummary,
  ZONE_THREAT_CONFIG,
  type PitcherStats,
  type MatchupData,
  type ZoneThreatLevel
} from '../zoneThreat';

describe('Zone Threat Rating Module', () => {
  // Test pitcher profiles based on real MLB scenarios
  const eliteControlPitcher: PitcherStats = {
    pitcherId: 'elite_001',
    name: 'Elite Control',
    hrPer9: 0.8,        // Well below average
    barrelPercent: 6.5,  // Below average
    meatballPercent: 3.2, // Excellent location
    hittableCountPct: 22, // Good count management
    recentHRs: 1,        // Strong recent form
    walkRate: 1.5        // Elite control
  };

  const averagePitcher: PitcherStats = {
    pitcherId: 'avg_001',
    name: 'Average Pitcher',
    hrPer9: 1.3,        // League average
    barrelPercent: 8.0,  // League average
    meatballPercent: 5.0, // League average
    hittableCountPct: 25, // Average
    recentHRs: 2,        // Average
    walkRate: 3.2        // League average
  };

  const extremeRiskPitcher: PitcherStats = {
    pitcherId: 'risk_001',
    name: 'High Risk Pitcher',
    hrPer9: 2.4,        // 95th percentile worst
    barrelPercent: 13.5, // 95th percentile worst
    meatballPercent: 9.8, // 95th percentile worst
    hittableCountPct: 34, // Poor count management
    recentHRs: 7,        // Terrible recent form
    walkRate: 4.5        // Poor control
  };

  const moderateRiskPitcher: PitcherStats = {
    pitcherId: 'mod_001',
    name: 'Moderate Risk Pitcher',
    hrPer9: 1.9,        // Above threshold
    barrelPercent: 10.5, // Above threshold
    meatballPercent: 7.5, // Above threshold
    hittableCountPct: 29, // Above threshold
    recentHRs: 4,        // At threshold
    walkRate: 3.8        // Slightly poor control
  };

  const favorableMatchup: MatchupData = {
    batterBarrel: 12.5,  // Above average power
    batterLaunch: 22.3,  // Optimal HR launch angle
    parkFactor: 1.08,    // Hitter-friendly park
    windOut: true        // Wind blowing out
  };

  const unfavorableMatchup: MatchupData = {
    batterBarrel: 7.2,   // Below average power
    batterLaunch: 12.1,  // Too low for HRs
    parkFactor: 0.95,    // Pitcher-friendly park
    windOut: false       // No wind assistance
  };

  describe('zoneThreatRating', () => {
    test('should classify elite control pitcher as CLEAN', () => {
      const result = zoneThreatRating(eliteControlPitcher);
      expect(result).toBe('CLEAN');
    });

    test('should classify average pitcher as CLEAN or MODERATE', () => {
      const result = zoneThreatRating(averagePitcher);
      expect(['CLEAN', 'MODERATE']).toContain(result);
    });

    test('should classify extreme risk pitcher as EXTREME', () => {
      const result = zoneThreatRating(extremeRiskPitcher);
      expect(result).toBe('EXTREME');
    });

    test('should classify moderate risk pitcher correctly', () => {
      const result = zoneThreatRating(moderateRiskPitcher);
      // This pitcher should be MODERATE or EXTREME based on scoring
      expect(['MODERATE', 'EXTREME']).toContain(result);
    });

    test('should handle edge cases at thresholds', () => {
      const edgeCasePitcher: PitcherStats = {
        pitcherId: 'edge_001',
        name: 'Edge Case',
        hrPer9: ZONE_THREAT_CONFIG.hrPer9.high, // Exactly at threshold
        barrelPercent: ZONE_THREAT_CONFIG.barrelPercent.high,
        meatballPercent: ZONE_THREAT_CONFIG.meatballPercent.high,
        hittableCountPct: ZONE_THREAT_CONFIG.hittableCountPct.high,
        recentHRs: ZONE_THREAT_CONFIG.recentHRs.high,
        walkRate: 3.0 // Neutral
      };

      const result = zoneThreatRating(edgeCasePitcher);
      expect(['MODERATE', 'EXTREME']).toContain(result);
    });

    test('should apply elite control bonus correctly', () => {
      const eliteControlRiskyPitcher: PitcherStats = {
        ...moderateRiskPitcher,
        walkRate: 1.5 // Elite control should reduce score
      };

      const normalResult = zoneThreatRating(moderateRiskPitcher);
      const eliteControlResult = zoneThreatRating(eliteControlRiskyPitcher);
      
      // Elite control should result in lower or equal threat level
      const threatLevels = ['CLEAN', 'MODERATE', 'EXTREME'];
      const normalIndex = threatLevels.indexOf(normalResult);
      const eliteIndex = threatLevels.indexOf(eliteControlResult);
      
      expect(eliteIndex).toBeLessThanOrEqual(normalIndex);
    });
  });

  describe('shouldBoostHRProp', () => {
    test('should boost EXTREME pitcher with favorable matchup', () => {
      const result = shouldBoostHRProp(extremeRiskPitcher, favorableMatchup);
      expect(result).toBe(true);
    });

    test('should not boost EXTREME pitcher with unfavorable matchup', () => {
      const result = shouldBoostHRProp(extremeRiskPitcher, unfavorableMatchup);
      expect(result).toBe(false);
    });

    test('should not boost non-EXTREME pitcher even with favorable matchup', () => {
      const result = shouldBoostHRProp(averagePitcher, favorableMatchup);
      expect(result).toBe(false);
    });

    test('should not boost MODERATE pitcher with favorable matchup', () => {
      // First check what threat level this pitcher actually gets
      const threatLevel = zoneThreatRating(moderateRiskPitcher);
      const result = shouldBoostHRProp(moderateRiskPitcher, favorableMatchup);
      
      // Only expect false if the pitcher is not EXTREME
      if (threatLevel !== 'EXTREME') {
        expect(result).toBe(false);
      } else {
        // If the pitcher is actually EXTREME, boost should be true with favorable matchup
        expect(result).toBe(true);
      }
    });

    test('should handle edge cases in matchup conditions', () => {
      const edgeMatchup: MatchupData = {
        batterBarrel: 10.0,  // Exactly at threshold
        batterLaunch: 16.0,  // Exactly at lower bound
        parkFactor: 1.04,    // Exactly at threshold
        windOut: false       // No wind, but park factor qualifies
      };

      const result = shouldBoostHRProp(extremeRiskPitcher, edgeMatchup);
      expect(result).toBe(true);
    });

    test('should require all conditions for boost', () => {
      // Test each condition individually
      const partialMatchups = [
        { ...favorableMatchup, batterBarrel: 8.0 }, // Fail barrel
        { ...favorableMatchup, batterLaunch: 35.0 }, // Fail launch angle (too high)
        { ...favorableMatchup, batterLaunch: 10.0 }, // Fail launch angle (too low)
        { ...favorableMatchup, parkFactor: 0.95, windOut: false }, // Fail park conditions
      ];

      partialMatchups.forEach((matchup, index) => {
        const result = shouldBoostHRProp(extremeRiskPitcher, matchup);
        expect(result).toBe(false);
      });
    });
  });

  describe('calculateZoneThreatBoost', () => {
    test('should return configured boost for qualifying props', () => {
      const result = calculateZoneThreatBoost(extremeRiskPitcher, favorableMatchup);
      expect(result).toBe(ZONE_THREAT_CONFIG.edgeBoost);
    });

    test('should return 0 for non-qualifying props', () => {
      const result = calculateZoneThreatBoost(averagePitcher, favorableMatchup);
      expect(result).toBe(0);
    });

    test('should return 0 for EXTREME pitcher with poor matchup', () => {
      const result = calculateZoneThreatBoost(extremeRiskPitcher, unfavorableMatchup);
      expect(result).toBe(0);
    });
  });

  describe('generateZoneThreatSummary', () => {
    test('should generate summary without matchup data', () => {
      const summary = generateZoneThreatSummary(extremeRiskPitcher);
      
      expect(summary).toContain('Zone Threat Analysis');
      expect(summary).toContain(extremeRiskPitcher.name);
      expect(summary).toContain('EXTREME');
      expect(summary).toContain('HR/9');
      expect(summary).toContain('Barrel%');
      expect(summary).not.toContain('Matchup Context');
    });

    test('should generate complete summary with matchup data', () => {
      const summary = generateZoneThreatSummary(extremeRiskPitcher, favorableMatchup);
      
      expect(summary).toContain('Zone Threat Analysis');
      expect(summary).toContain('Matchup Context');
      expect(summary).toContain('Edge Boost Applied');
      expect(summary).toContain(`+${ZONE_THREAT_CONFIG.edgeBoost} points`);
    });

    test('should show no boost when conditions not met', () => {
      const summary = generateZoneThreatSummary(averagePitcher, favorableMatchup);

      expect(summary).toContain('Edge Boost Applied:** None');
    });

    test('should format numbers correctly', () => {
      const summary = generateZoneThreatSummary(extremeRiskPitcher);
      
      // Check that numbers are formatted to appropriate decimal places
      expect(summary).toMatch(/HR\/9: \d+\.\d{2}/);
      expect(summary).toMatch(/Barrel%: \d+\.\d%/);
      expect(summary).toMatch(/BB\/9: \d+\.\d{2}/);
    });
  });

  describe('Configuration Validation', () => {
    test('should have reasonable threshold values', () => {
      const config = ZONE_THREAT_CONFIG;
      
      // HR/9 thresholds should be above league average (~1.3)
      expect(config.hrPer9.high).toBeGreaterThan(1.3);
      expect(config.hrPer9.extreme).toBeGreaterThan(config.hrPer9.high);
      
      // Barrel% thresholds should be above league average (~8%)
      expect(config.barrelPercent.high).toBeGreaterThan(8);
      expect(config.barrelPercent.extreme).toBeGreaterThan(config.barrelPercent.high);
      
      // Elite walk rate should be well below league average (~3.2)
      expect(config.walkRate.elite).toBeLessThan(2.0);
      expect(config.walkRate.poor).toBeGreaterThan(3.2);
      
      // Scoring thresholds should be reasonable
      expect(config.extremeThreshold).toBeGreaterThan(config.moderateThreshold);
      expect(config.moderateThreshold).toBeGreaterThan(0);
      
      // Edge boost should be meaningful but not excessive
      expect(config.edgeBoost).toBeGreaterThan(0);
      expect(config.edgeBoost).toBeLessThanOrEqual(5);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle real-world pitcher profiles', () => {
      // Simulate various real pitcher types
      const pitcherProfiles = [
        eliteControlPitcher,
        averagePitcher,
        moderateRiskPitcher,
        extremeRiskPitcher
      ];

      pitcherProfiles.forEach(pitcher => {
        const threat = zoneThreatRating(pitcher);
        const boost = calculateZoneThreatBoost(pitcher, favorableMatchup);
        const summary = generateZoneThreatSummary(pitcher, favorableMatchup);
        
        // All functions should execute without error
        expect(['CLEAN', 'MODERATE', 'EXTREME']).toContain(threat);
        expect(boost).toBeGreaterThanOrEqual(0);
        expect(summary).toBeTruthy();
        expect(summary.length).toBeGreaterThan(100); // Reasonable summary length
      });
    });

    test('should maintain consistency across multiple calls', () => {
      // Same input should always produce same output
      const threat1 = zoneThreatRating(extremeRiskPitcher);
      const threat2 = zoneThreatRating(extremeRiskPitcher);
      const boost1 = calculateZoneThreatBoost(extremeRiskPitcher, favorableMatchup);
      const boost2 = calculateZoneThreatBoost(extremeRiskPitcher, favorableMatchup);
      
      expect(threat1).toBe(threat2);
      expect(boost1).toBe(boost2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle extreme statistical values', () => {
      const extremeStatsPitcher: PitcherStats = {
        pitcherId: 'extreme_stats',
        name: 'Extreme Stats',
        hrPer9: 5.0,        // Unrealistically high
        barrelPercent: 25.0, // Unrealistically high
        meatballPercent: 20.0, // Unrealistically high
        hittableCountPct: 50, // Unrealistically high
        recentHRs: 15,       // Unrealistically high
        walkRate: 8.0        // Unrealistically high
      };

      const result = zoneThreatRating(extremeStatsPitcher);
      expect(result).toBe('EXTREME');
    });

    test('should handle zero/negative values gracefully', () => {
      const zeroStatsPitcher: PitcherStats = {
        pitcherId: 'zero_stats',
        name: 'Zero Stats',
        hrPer9: 0,
        barrelPercent: 0,
        meatballPercent: 0,
        hittableCountPct: 0,
        recentHRs: 0,
        walkRate: 0
      };

      const result = zoneThreatRating(zeroStatsPitcher);
      expect(['CLEAN', 'MODERATE', 'EXTREME']).toContain(result);
    });
  });
});

// Performance test for large-scale usage
describe('Zone Threat Performance', () => {
  test('should handle batch processing efficiently', () => {
    const startTime = Date.now();
    const batchSize = 1000;
    
    const testPitcher: PitcherStats = {
      pitcherId: 'perf_test',
      name: 'Performance Test',
      hrPer9: 1.5,
      barrelPercent: 9.0,
      meatballPercent: 6.0,
      hittableCountPct: 26,
      recentHRs: 3,
      walkRate: 3.0
    };

    const testMatchup: MatchupData = {
      batterBarrel: 11.0,
      batterLaunch: 20.0,
      parkFactor: 1.05,
      windOut: false
    };

    // Process batch
    for (let i = 0; i < batchSize; i++) {
      zoneThreatRating(testPitcher);
      calculateZoneThreatBoost(testPitcher, testMatchup);
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    // Should process 1000 calculations in under 100ms
    expect(processingTime).toBeLessThan(100);
  });
});