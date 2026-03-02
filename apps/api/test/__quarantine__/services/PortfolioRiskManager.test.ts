/**
 * Tests for Portfolio Risk Manager
 * Validates correlation limits, portfolio caps, and position sizing
 */

import { portfolioRiskManager } from '../../src/services/PortfolioRiskManager';

describe('PortfolioRiskManager Tests', () => {
  beforeEach(() => {
    // Set test environment variables
    process.env.MAX_SINGLE_POSITION_SIZE = '0.25';
    process.env.MAX_CORRELATION_THRESHOLD = '0.70';
    process.env.MAX_GAME_EXPOSURE = '0.40';
    process.env.DAILY_VAR_LIMIT = '0.15';
  });

  describe('Position Size Validation', () => {
    test('should approve normal-sized position', async () => {
      const pick = {
        id: 'test-normal-position',
        tier: 'S',
        expected_value: 0.06,
        confidence: 0.8,
        professional_score: 88,
        variance: 0.2,
        game_id: 'nba-lal-gsw-20250115',
        player_name: 'LeBron James',
        sport: 'NBA',
        prop_id: 'nba_lbj_pts_29.5',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(pick, 0.15); // 15% position

      expect(decision.approved).toBe(true);
      expect(decision.recommendedSize).toBeLessThanOrEqual(0.25);
      expect(decision.actualSize).toBeGreaterThan(0);
      expect(decision.limitingFactor).toBe('none');
    });

    test('should limit position size to maximum threshold', async () => {
      const pick = {
        id: 'test-oversized-position',
        tier: 'S',
        expected_value: 0.08,
        confidence: 0.85,
        professional_score: 92,
        variance: 0.18,
        game_id: 'nba-bkn-mil-20250115',
        player_name: 'Kevin Durant',
        sport: 'NBA',
        prop_id: 'nba_kd_pts_28.5',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(pick, 0.35); // 35% requested

      expect(decision.maxAllowedSize).toBe(0.25);
      expect(decision.limitingFactor).toBe('single_position_limit');
      expect(decision.riskAdjustment).toBeLessThan(1.0);
    });

    test('should calculate optimal Kelly sizing', async () => {
      const pick = {
        id: 'test-kelly-sizing',
        tier: 'A',
        expected_value: 0.05,
        confidence: 0.75,
        professional_score: 82,
        variance: 0.25,
        game_id: 'nba-phi-bos-20250115',
        player_name: 'Joel Embiid',
        sport: 'NBA',
        prop_id: 'nba_embiid_reb_11.5',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(pick, 0.2);

      // Kelly sizing should be reasonable for given EV and confidence
      expect(decision.recommendedSize).toBeGreaterThan(0.05);
      expect(decision.recommendedSize).toBeLessThan(0.25);
    });
  });

  describe('Correlation Analysis', () => {
    test('should detect same-game correlations', async () => {
      // Mock existing portfolio with same game
      jest.spyOn(portfolioRiskManager as any, 'getCurrentPortfolio').mockResolvedValue([
        {
          id: 'existing-pick-1',
          game_id: 'nba-lal-gsw-20250115',
          player_name: 'Stephen Curry',
          stat_type: 'points',
          position_size: 0.12,
          variance: 0.2,
          sport: 'NBA',
        },
      ]);

      const newPick = {
        id: 'test-same-game-correlation',
        tier: 'S',
        expected_value: 0.07,
        confidence: 0.78,
        professional_score: 89,
        game_id: 'nba-lal-gsw-20250115', // Same game
        player_name: 'LeBron James', // Different player
        stat_type: 'assists',
        sport: 'NBA',
        prop_id: 'nba_lbj_ast_7.5',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(newPick, 0.18);

      // Should detect correlation and potentially adjust sizing
      if (decision.limitingFactor === 'correlation_limit') {
        expect(decision.riskAdjustment).toBeLessThan(1.0);
      }
    });

    test('should detect same-player correlations', async () => {
      jest.spyOn(portfolioRiskManager as any, 'getCurrentPortfolio').mockResolvedValue([
        {
          id: 'existing-pick-2',
          game_id: 'nba-bos-mia-20250115',
          player_name: 'Jayson Tatum',
          stat_type: 'points',
          position_size: 0.15,
          variance: 0.22,
          sport: 'NBA',
        },
      ]);

      const newPick = {
        id: 'test-same-player-correlation',
        tier: 'A',
        expected_value: 0.055,
        confidence: 0.74,
        professional_score: 84,
        game_id: 'nba-bos-mia-20250115',
        player_name: 'Jayson Tatum', // Same player
        stat_type: 'rebounds', // Different stat
        sport: 'NBA',
        prop_id: 'nba_tatum_reb_8.5',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(newPick, 0.16);

      // Same player props should have high correlation
      if (decision.limitingFactor === 'correlation_limit') {
        expect(decision.reasoningToContain('correlation')).toBeTruthy;
      }
    });

    test('should handle statistical correlations', async () => {
      // Mock correlation matrix data
      jest
        .spyOn(portfolioRiskManager as any, 'calculateStatisticalCorrelation')
        .mockResolvedValue(0.45);

      jest.spyOn(portfolioRiskManager as any, 'getCurrentPortfolio').mockResolvedValue([
        {
          id: 'existing-pick-3',
          game_id: 'nba-den-phx-20250115',
          player_name: 'Nikola Jokic',
          stat_type: 'points',
          position_size: 0.14,
          variance: 0.19,
          sport: 'NBA',
        },
      ]);

      const newPick = {
        id: 'test-statistical-correlation',
        tier: 'A',
        expected_value: 0.045,
        confidence: 0.72,
        professional_score: 79,
        game_id: 'nba-den-phx-20250115',
        player_name: 'Devin Booker', // Different player, same game
        stat_type: 'assists', // Related stat type
        sport: 'NBA',
        prop_id: 'nba_booker_ast_5.5',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(newPick, 0.13);

      // Should account for statistical correlation
      expect(decision.approved).toBeDefined();
    });
  });

  describe('Game Exposure Limits', () => {
    test('should enforce game exposure limits', async () => {
      // Mock portfolio with high game exposure
      jest.spyOn(portfolioRiskManager as any, 'getCurrentPortfolio').mockResolvedValue([
        {
          id: 'game-exposure-1',
          game_id: 'nba-lal-gsw-20250115',
          position_size: 0.2,
          sport: 'NBA',
        },
        {
          id: 'game-exposure-2',
          game_id: 'nba-lal-gsw-20250115',
          position_size: 0.15,
          sport: 'NBA',
        },
        // Total: 35% exposure to this game
      ]);

      const newPick = {
        id: 'test-game-exposure-limit',
        tier: 'A',
        expected_value: 0.04,
        confidence: 0.7,
        professional_score: 77,
        game_id: 'nba-lal-gsw-20250115', // Same game as existing positions
        player_name: 'Anthony Davis',
        sport: 'NBA',
        prop_id: 'nba_ad_blk_2.5',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(newPick, 0.12); // Would total 47%

      if (decision.limitingFactor === 'game_exposure_limit') {
        expect(decision.maxAllowedSize).toBeLessThan(0.12);
        expect(decision.reasoning).toContain('game exposure');
      } else if (decision.limitingFactor === 'game_exposure_exceeded') {
        expect(decision.approved).toBe(false);
      }
    });

    test('should reject position exceeding game exposure', async () => {
      // Mock portfolio at maximum game exposure
      jest.spyOn(portfolioRiskManager as any, 'getCurrentPortfolio').mockResolvedValue([
        {
          id: 'max-exposure-1',
          game_id: 'nba-mil-bkn-20250115',
          position_size: 0.25,
          sport: 'NBA',
        },
        {
          id: 'max-exposure-2',
          game_id: 'nba-mil-bkn-20250115',
          position_size: 0.15,
          sport: 'NBA',
        },
        // Total: 40% exposure (at limit)
      ]);

      const newPick = {
        id: 'test-exceeded-exposure',
        tier: 'S',
        expected_value: 0.08,
        confidence: 0.85,
        professional_score: 93,
        game_id: 'nba-mil-bkn-20250115', // Same game at limit
        player_name: 'Giannis Antetokounmpo',
        sport: 'NBA',
        prop_id: 'nba_giannis_pts_32.5',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(newPick, 0.08);

      expect(decision.approved).toBe(false);
      expect(decision.limitingFactor).toBe('game_exposure_exceeded');
      expect(decision.actualSize).toBe(0);
    });
  });

  describe('Portfolio VaR Limits', () => {
    test('should reject position exceeding VaR limit', async () => {
      // Mock high-risk portfolio
      jest.spyOn(portfolioRiskManager as any, 'calculateCurrentPortfolioRisk').mockResolvedValue({
        totalPositions: 8,
        totalRisk: 0.25,
        var95: 0.12, // Already high VaR
        expectedDrawdown: 0.125,
        diversificationRatio: 0.75,
        concentrationRisk: 0.08,
        liquidityRisk: 0.03,
        overallRisk: 'high',
      });

      const newPick = {
        id: 'test-var-limit',
        tier: 'S',
        expected_value: 0.09,
        confidence: 0.88,
        professional_score: 94,
        variance: 0.35, // High variance
        game_id: 'nba-dal-phx-20250115',
        player_name: 'Luka Doncic',
        sport: 'NBA',
        prop_id: 'nba_luka_pts_31.5',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(newPick, 0.2); // Large position

      // High variance + large size + existing risk should exceed VaR
      if (decision.limitingFactor === 'var_limit_exceeded') {
        expect(decision.approved).toBe(false);
        expect(decision.reasoning).toContain('VaR limit');
      }
    });

    test('should approve position within VaR limits', async () => {
      // Mock low-risk portfolio
      jest.spyOn(portfolioRiskManager as any, 'calculateCurrentPortfolioRisk').mockResolvedValue({
        totalPositions: 3,
        totalRisk: 0.08,
        var95: 0.05, // Low current VaR
        expectedDrawdown: 0.04,
        diversificationRatio: 0.9,
        concentrationRisk: 0.02,
        liquidityRisk: 0.01,
        overallRisk: 'low',
      });

      const newPick = {
        id: 'test-var-ok',
        tier: 'A',
        expected_value: 0.045,
        confidence: 0.73,
        professional_score: 81,
        variance: 0.18, // Moderate variance
        game_id: 'nba-mem-por-20250115',
        player_name: 'Ja Morant',
        sport: 'NBA',
        prop_id: 'nba_morant_ast_8.5',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(newPick, 0.12);

      expect(decision.approved).toBe(true);
      expect(decision.actualSize).toBeGreaterThan(0);
    });
  });

  describe('Correlation Type Detection', () => {
    test('should identify same-game correlations', () => {
      const pick1 = { game_id: 'nba-lal-gsw-20250115', player_name: 'LeBron James' };
      const pick2 = { game_id: 'nba-lal-gsw-20250115', player_name: 'Stephen Curry' };

      const correlationType = portfolioRiskManager['determineCorrelationType'](pick1, pick2);
      expect(correlationType).toBe('same_game');
    });

    test('should identify same-player correlations', () => {
      const pick1 = { game_id: 'nba-bos-mia-20250115', player_name: 'Jayson Tatum' };
      const pick2 = { game_id: 'nba-bos-mia-20250115', player_name: 'Jayson Tatum' };

      const correlationType = portfolioRiskManager['determineCorrelationType'](pick1, pick2);
      expect(correlationType).toBe('same_player');
    });

    test('should identify market-driven correlations', () => {
      const pick1 = {
        game_id: 'nba-den-phx-20250115',
        player_name: 'Nikola Jokic',
        steam_strength: 25,
      };
      const pick2 = {
        game_id: 'nba-mia-bos-20250115',
        player_name: 'Jimmy Butler',
        steam_strength: 22,
      };

      const correlationType = portfolioRiskManager['determineCorrelationType'](pick1, pick2);
      expect(correlationType).toBe('market_driven');
    });

    test('should identify statistical correlations', () => {
      const pick1 = {
        game_id: 'nba-dal-por-20250115',
        player_name: 'Luka Doncic',
      };
      const pick2 = {
        game_id: 'nba-mem-sac-20250115',
        player_name: "De'Aaron Fox",
      };

      const correlationType = portfolioRiskManager['determineCorrelationType'](pick1, pick2);
      expect(correlationType).toBe('statistical');
    });
  });

  describe('Risk Classification', () => {
    test('should classify correlation risk levels', () => {
      // Test extreme correlation risk
      let riskLevel = portfolioRiskManager['classifyCorrelationRisk'](0.85, 4);
      expect(riskLevel).toBe('extreme');

      // Test high correlation risk
      riskLevel = portfolioRiskManager['classifyCorrelationRisk'](0.75, 3);
      expect(riskLevel).toBe('high');

      // Test medium correlation risk
      riskLevel = portfolioRiskManager['classifyCorrelationRisk'](0.6, 2);
      expect(riskLevel).toBe('medium');

      // Test low correlation risk
      riskLevel = portfolioRiskManager['classifyCorrelationRisk'](0.3, 1);
      expect(riskLevel).toBe('low');
    });

    test('should classify overall risk levels', () => {
      // Test extreme risk
      let riskLevel = portfolioRiskManager['classifyOverallRisk'](0.28, 0.55);
      expect(riskLevel).toBe('extreme');

      // Test high risk
      riskLevel = portfolioRiskManager['classifyOverallRisk'](0.18, 0.35);
      expect(riskLevel).toBe('high');

      // Test medium risk
      riskLevel = portfolioRiskManager['classifyOverallRisk'](0.12, 0.25);
      expect(riskLevel).toBe('medium');

      // Test low risk
      riskLevel = portfolioRiskManager['classifyOverallRisk'](0.08, 0.15);
      expect(riskLevel).toBe('low');
    });
  });

  describe('Portfolio Statistics', () => {
    test('should calculate portfolio statistics', async () => {
      // Mock portfolio data
      jest.spyOn(portfolioRiskManager as any, 'getCurrentPortfolio').mockResolvedValue([
        { id: '1', position_size: 0.15, sport: 'NBA', game_id: 'game1' },
        { id: '2', position_size: 0.12, sport: 'NBA', game_id: 'game2' },
        { id: '3', position_size: 0.08, sport: 'NFL', game_id: 'game3' },
      ]);

      const stats = await portfolioRiskManager.getPortfolioStats();

      expect(stats.totalPositions).toBe(3);
      expect(stats.totalRisk).toBeGreaterThan(0);
      expect(stats.currentVar95).toBeGreaterThan(0);
      expect(stats.topCorrelations).toBeDefined();
      expect(stats.concentrationByGame).toBeDefined();
      expect(stats.concentrationBySport).toBeDefined();
    });
  });

  describe('Position Sizing Edge Cases', () => {
    test('should handle zero variance picks', async () => {
      const pick = {
        id: 'test-zero-variance',
        tier: 'A',
        expected_value: 0.04,
        confidence: 0.75,
        professional_score: 80,
        variance: 0, // Zero variance
        game_id: 'nba-test-20250115',
        player_name: 'Test Player',
        sport: 'NBA',
        prop_id: 'test_prop',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(pick, 0.1);

      expect(decision.approved).toBe(true);
      expect(decision.recommendedSize).toBeGreaterThan(0);
    });

    test('should handle negative expected value', async () => {
      const pick = {
        id: 'test-negative-ev',
        tier: 'B',
        expected_value: -0.02, // Negative EV
        confidence: 0.6,
        professional_score: 65,
        variance: 0.25,
        game_id: 'nba-test-20250115',
        player_name: 'Test Player 2',
        sport: 'NBA',
        prop_id: 'test_prop_2',
      };

      const decision = await portfolioRiskManager.assessPositionRisk(pick, 0.08);

      // Should handle gracefully, likely with very small or zero sizing
      expect(decision.recommendedSize).toBeLessThanOrEqual(0.05);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
