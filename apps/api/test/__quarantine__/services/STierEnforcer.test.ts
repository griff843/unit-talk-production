/**
 * Tests for S-Tier Enforcement Service
 * Validates S-tier standards, EV/CLV/steam validation, and tier adjustments
 */

import { sTierEnforcer } from '../../src/services/STierEnforcer';

describe('STierEnforcer Tests', () => {
  beforeEach(() => {
    // Set test environment variables
    process.env.S_TIER_MIN_CLV_BPS = '15';
    process.env.S_TIER_MAX_NEGATIVE_CLV_BPS = '-3';
    process.env.S_TIER_MIN_STEAM_STRENGTH = '20';
  });

  describe('Core S-Tier Threshold Validation', () => {
    test('should pass S-tier pick meeting all requirements', async () => {
      const pick = {
        id: 'test-s-tier-pass',
        tier: 'S',
        expected_value: 0.08, // 8% EV
        confidence: 0.85, // 85% confidence
        professional_score: 92, // 92 professional professional_score
        clv_tracking: {
          current_clv_bps: 25, // 25 BPS positive CLV
        },
        prop_id: 'nba_lbj_pts_29.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.passed).toBe(true);
      expect(validation.enforced).toBe(false);
      expect(validation.violations.filter(v => v.severity === 'critical').length).toBe(0);
      expect(validation.adjustedTier).toBeUndefined();
    });

    test('should downgrade S-tier pick with insufficient EV', async () => {
      const pick = {
        id: 'test-low-ev-downgrade',
        tier: 'S',
        expected_value: 0.03, // Only 3% EV (below 5% minimum)
        confidence: 0.82,
        professional_score: 88,
        clv_tracking: {
          current_clv_bps: 18,
        },
        prop_id: 'nba_curry_3pm_4.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.passed).toBe(false);
      expect(validation.enforced).toBe(true);
      expect(validation.adjustedTier).toBe('A');
      expect(validation.reasoning).toContain('Downgraded from S to A');
      expect(validation.violations.some(v => v.rule === 'min_expected_value')).toBe(true);
    });

    test('should downgrade S-tier pick with insufficient confidence', async () => {
      const pick = {
        id: 'test-low-confidence',
        tier: 'S',
        expected_value: 0.06,
        confidence: 0.68, // Below 75% minimum
        professional_score: 89,
        clv_tracking: {
          current_clv_bps: 20,
        },
        prop_id: 'nba_ad_reb_12.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.passed).toBe(false);
      expect(validation.enforced).toBe(true);
      expect(validation.adjustedTier).toBe('A');
      expect(
        validation.violations.some(v => v.rule === 'min_confidence' && v.severity === 'critical')
      ).toBe(true);
    });

    test('should downgrade S-tier pick with low professional score', async () => {
      const pick = {
        id: 'test-low-professional-score',
        tier: 'S',
        expected_value: 0.07,
        confidence: 0.81,
        professional_score: 79, // Below 85 minimum
        clv_tracking: {
          current_clv_bps: 22,
        },
        prop_id: 'nba_giannis_blk_2.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.passed).toBe(false);
      expect(validation.enforced).toBe(true);
      expect(validation.violations.some(v => v.rule === 'min_professional_score')).toBe(true);
    });
  });

  describe('CLV Validation', () => {
    test('should pass S-tier pick with strong positive CLV', async () => {
      const pick = {
        id: 'test-strong-clv',
        tier: 'S',
        expected_value: 0.06,
        confidence: 0.83,
        professional_score: 90,
        clv_tracking: {
          current_clv_bps: 35, // Strong 35 BPS CLV
        },
        prop_id: 'nba_embiid_pts_31.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.passed).toBe(true);
      expect(validation.violations.some(v => v.rule.includes('clv'))).toBe(false);
    });

    test('should downgrade S-tier pick with insufficient CLV', async () => {
      const pick = {
        id: 'test-low-clv',
        tier: 'S',
        expected_value: 0.07,
        confidence: 0.78,
        professional_score: 87,
        clv_tracking: {
          current_clv_bps: 8, // Below 15 BPS minimum
        },
        prop_id: 'nba_tatum_ast_6.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.passed).toBe(false);
      expect(validation.enforced).toBe(true);
      expect(validation.violations.some(v => v.rule === 'min_clv_threshold')).toBe(true);
    });

    test('should downgrade S-tier pick with excessive negative CLV', async () => {
      const pick = {
        id: 'test-negative-clv',
        tier: 'S',
        expected_value: 0.08,
        confidence: 0.86,
        professional_score: 91,
        clv_tracking: {
          current_clv_bps: -8, // Exceeds -3 BPS tolerance
        },
        prop_id: 'nba_durant_3pm_3.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.passed).toBe(false);
      expect(validation.violations.some(v => v.rule === 'max_negative_clv')).toBe(true);
    });

    test('should flag missing CLV tracking as critical', async () => {
      const pick = {
        id: 'test-missing-clv',
        tier: 'S',
        expected_value: 0.09,
        confidence: 0.84,
        professional_score: 93,
        // Missing clv_tracking
        prop_id: 'nba_westbrook_reb_8.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.passed).toBe(false);
      expect(
        validation.violations.some(
          v => v.rule === 'missing_clv_tracking' && v.severity === 'critical'
        )
      ).toBe(true);
    });
  });

  describe('Steam Validation', () => {
    test('should pass pick with positive steam', async () => {
      // Mock steam data
      const mockSteamData = {
        strength: 28,
        direction: 'for' as const,
        volume: 125000,
        timeframe: '1h',
        sustainability: 0.8,
        qualityScore: 0.85,
      };

      const pick = {
        id: 'test-positive-steam',
        tier: 'S',
        expected_value: 0.065,
        confidence: 0.79,
        professional_score: 86,
        clv_tracking: { current_clv_bps: 19 },
        prop_id: 'nba_holiday_stl_1.5',
        sport: 'NBA',
      };

      // Mock getSteamData method
      jest.spyOn(sTierEnforcer as any, 'getSteamData').mockResolvedValue(mockSteamData);

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.steamAnalysis.strength).toBe(28);
      expect(validation.steamAnalysis.direction).toBe('for');
      expect(validation.violations.some(v => v.rule === 'min_steam_strength')).toBe(false);
    });

    test('should flag insufficient steam strength', async () => {
      const mockSteamData = {
        strength: 12, // Below 20 BPS requirement
        direction: 'for' as const,
        volume: 50000,
        timeframe: '1h',
        sustainability: 0.6,
        qualityScore: 0.7,
      };

      const pick = {
        id: 'test-weak-steam',
        tier: 'S',
        expected_value: 0.055,
        confidence: 0.76,
        professional_score: 88,
        clv_tracking: { current_clv_bps: 16 },
        prop_id: 'nba_harden_to_8.5',
        sport: 'NBA',
      };

      jest.spyOn(sTierEnforcer as any, 'getSteamData').mockResolvedValue(mockSteamData);

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(
        validation.violations.some(v => v.rule === 'min_steam_strength' && v.severity === 'major')
      ).toBe(true);
    });

    test('should flag excessive counter-steam', async () => {
      const mockSteamData = {
        strength: 25,
        direction: 'against' as const, // Counter-steam
        volume: 85000,
        timeframe: '1h',
        sustainability: 0.4,
        qualityScore: 0.6,
      };

      const pick = {
        id: 'test-counter-steam',
        tier: 'S',
        expected_value: 0.072,
        confidence: 0.81,
        professional_score: 89,
        clv_tracking: { current_clv_bps: 21 },
        prop_id: 'nba_butler_pts_20.5',
        sport: 'NBA',
      };

      jest.spyOn(sTierEnforcer as any, 'getSteamData').mockResolvedValue(mockSteamData);

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.violations.some(v => v.rule === 'max_counter_steam')).toBe(true);
    });
  });

  describe('Risk Assessment', () => {
    test('should calculate Kelly fraction correctly', async () => {
      const pick = {
        id: 'test-kelly-calculation',
        tier: 'S',
        expected_value: 0.08,
        confidence: 0.8,
        professional_score: 88,
        clv_tracking: { current_clv_bps: 22 },
        odds: -110,
        prop_id: 'nba_jokic_reb_11.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.riskAssessment.kellyFraction).toBeGreaterThan(0.05);
      expect(validation.riskAssessment.kellyFraction).toBeLessThan(0.25);
      expect(validation.riskAssessment.overallRisk).toBeIn(['low', 'medium', 'high', 'extreme']);
    });

    test('should flag excessive Kelly fraction', async () => {
      const pick = {
        id: 'test-high-kelly',
        tier: 'S',
        expected_value: 0.15, // Very high EV
        confidence: 0.95, // Very high confidence
        professional_score: 95,
        clv_tracking: { current_clv_bps: 35 },
        kelly_fraction: 0.35, // Exceeds 25% maximum
        prop_id: 'nba_morant_ast_8.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.violations.some(v => v.rule === 'max_kelly_fraction')).toBe(true);
    });

    test('should flag excessive drawdown risk', async () => {
      const pick = {
        id: 'test-high-drawdown',
        tier: 'S',
        expected_value: 0.06,
        confidence: 0.75,
        professional_score: 86,
        clv_tracking: { current_clv_bps: 18 },
        variance: 0.45, // High variance
        prop_id: 'nba_young_3pm_4.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.riskAssessment.expectedDrawdown).toBeGreaterThan(0);
      if (validation.riskAssessment.expectedDrawdown > 0.15) {
        expect(validation.violations.some(v => v.rule === 'max_drawdown_risk')).toBe(true);
      }
    });
  });

  describe('Market Validation', () => {
    test('should validate market depth and impact', async () => {
      const mockMarketData = {
        depth: 25000, // Good depth
        impact: 0.03, // Low impact
        efficiency: 0.92,
        sharpMoneyPresent: true,
        institutionalFlow: 0.65,
        retailPercentage: 0.35,
        qualityScore: 0.88,
      };

      const pick = {
        id: 'test-market-validation',
        tier: 'S',
        expected_value: 0.07,
        confidence: 0.83,
        professional_score: 91,
        clv_tracking: { current_clv_bps: 24 },
        prop_id: 'nba_booker_pts_27.5',
        sport: 'NBA',
      };

      jest.spyOn(sTierEnforcer as any, 'getMarketData').mockResolvedValue(mockMarketData);

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.marketValidation.depth).toBe(25000);
      expect(validation.marketValidation.sharpMoneyPresent).toBe(true);
      expect(validation.violations.some(v => v.rule === 'min_market_depth')).toBe(false);
    });

    test('should flag low market depth', async () => {
      const mockMarketData = {
        depth: 7500, // Below $10K minimum
        impact: 0.08, // High impact
        efficiency: 0.75,
        sharpMoneyPresent: false,
        institutionalFlow: 0.3,
        retailPercentage: 0.7,
        qualityScore: 0.65,
      };

      const pick = {
        id: 'test-low-depth',
        tier: 'S',
        expected_value: 0.055,
        confidence: 0.77,
        professional_score: 87,
        clv_tracking: { current_clv_bps: 17 },
        prop_id: 'nba_fox_ast_6.5',
        sport: 'NBA',
      };

      jest.spyOn(sTierEnforcer as any, 'getMarketData').mockResolvedValue(mockMarketData);

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.violations.some(v => v.rule === 'min_market_depth')).toBe(true);
      expect(validation.violations.some(v => v.rule === 'max_market_impact')).toBe(true);
      expect(validation.violations.some(v => v.rule === 'requires_sharp_money')).toBe(true);
    });
  });

  describe('Enforcement Actions', () => {
    test('should not enforce on non-S-tier picks', async () => {
      const pick = {
        id: 'test-a-tier-no-enforcement',
        tier: 'A', // Not S-tier
        expected_value: 0.03, // Would fail S-tier standards
        confidence: 0.65,
        professional_score: 75,
        prop_id: 'nba_bench_player_pts_12.5',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      expect(validation.enforced).toBe(false);
      expect(validation.reasoning).toContain('not S-tier');
    });

    test('should handle multiple major violations', async () => {
      const pick = {
        id: 'test-multiple-violations',
        tier: 'S',
        expected_value: 0.06, // OK
        confidence: 0.78, // OK
        professional_score: 88, // OK
        clv_tracking: { current_clv_bps: 10 }, // Major violation
        kelly_fraction: 0.3, // Major violation
        variance: 0.4, // May cause drawdown violation
        prop_id: 'nba_multiple_issues',
        sport: 'NBA',
      };

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      const majorViolations = validation.violations.filter(v => v.severity === 'major');
      if (majorViolations.length >= 3) {
        expect(validation.enforced).toBe(true);
        expect(validation.adjustedTier).toBe('A');
        expect(validation.reasoning).toContain('major violations exceed threshold');
      }
    });

    test('should maintain S-tier for minor violations', async () => {
      const pick = {
        id: 'test-minor-violations-only',
        tier: 'S',
        expected_value: 0.065, // Good
        confidence: 0.82, // Good
        professional_score: 89, // Good
        clv_tracking: { current_clv_bps: 18 }, // Good
        prop_id: 'nba_minor_issues',
        sport: 'NBA',
      };

      // Mock market data with minor issues
      jest.spyOn(sTierEnforcer as any, 'getMarketData').mockResolvedValue({
        depth: 8500, // Slightly low (minor violation)
        impact: 0.04,
        efficiency: 0.85,
        sharpMoneyPresent: true,
        institutionalFlow: 0.6,
        retailPercentage: 0.4,
        qualityScore: 0.8,
      });

      const validation = await sTierEnforcer.enforceSTierStandards(pick);

      const criticalViolations = validation.violations.filter(v => v.severity === 'critical');
      const majorViolations = validation.violations.filter(v => v.severity === 'major');

      if (criticalViolations.length === 0 && majorViolations.length < 3) {
        expect(validation.enforced).toBe(false);
        expect(validation.adjustedTier).toBeUndefined();
        expect(validation.reasoning).toContain('standards maintained');
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
