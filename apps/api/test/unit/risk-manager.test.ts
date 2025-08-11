import { EnhancedRiskManager } from '../../src/risk/enhanced-risk-manager';
import { 
  PortfolioPosition
} from '../../src/types/risk';
import { mockPosition } from '../mocks/risk-mocks';

describe('EnhancedRiskManager', () => {
  let riskManager: EnhancedRiskManager;

  beforeEach(() => {
    riskManager = new EnhancedRiskManager();
  });

  describe('Position Evaluation', () => {
    it('should calculate comprehensive risk metrics', async () => {
      const position: PortfolioPosition = {
        id: '1',
        type: 'single',
        sport: 'NBA',
        league: 'NBA',
        sector: 'basketball',
        confidence: 0.85,
        odds: -110,
        timestamp: new Date().toISOString(),
        metadata: {
          market: 'player_points',
          liquidity: 0.8,
          volatility: 0.2
        }
      };

      const metrics = await riskManager.evaluatePosition(position);

      // Verify all risk metrics are calculated
      expect(metrics.valueAtRisk).toBeDefined();
      expect(metrics.expectedShortfall).toBeDefined();
      expect(metrics.betaToMarket).toBeDefined();
      expect(metrics.sharpeRatio).toBeDefined();
      expect(metrics.totalRisk).toBeDefined();
      expect(metrics.correlations).toBeDefined();
      expect(metrics.stressTestResults).toBeDefined();

      // Verify risk metrics are within expected ranges
      expect(metrics.valueAtRisk).toBeLessThan(0.2);
      expect(metrics.totalRisk).toBeLessThan(0.15);
      expect(metrics.sharpeRatio).toBeGreaterThan(1);
    });

    it('should identify high-risk positions', async () => {
      const highRiskPosition: PortfolioPosition = {
        ...mockPosition,
        confidence: 0.6,
        metadata: {
          market: 'player_points',
          liquidity: 0.3, // Low liquidity
          volatility: 0.8  // High volatility
        }
      };

      const metrics = await riskManager.evaluatePosition(highRiskPosition);

      expect(metrics.totalRisk).toBeGreaterThan(0.2);
      expect(metrics.valueAtRisk).toBeGreaterThan(0.15);
    });
  });

  describe('Kelly Criterion', () => {
    it('should calculate conservative position sizes', async () => {
      const position: PortfolioPosition = {
        ...mockPosition,
        confidence: 0.85,
        odds: -110
      };

      const kellyResult = await riskManager['calculateKellyPosition'](position);

      // Verify Kelly calculations
      expect(kellyResult.fullKelly).toBeDefined();
      expect(kellyResult.fractionalKelly).toBeDefined();
      expect(kellyResult.recommendedSize).toBeDefined();

      // Verify conservative sizing
      expect(kellyResult.recommendedSize).toBeLessThan(kellyResult.fullKelly);
      expect(kellyResult.recommendedSize).toBeLessThan(0.05); // Max position size
    });

    it('should reduce size for higher risk positions', async () => {
      const highRiskPosition: PortfolioPosition = {
        ...mockPosition,
        confidence: 0.85,
        odds: -110,
        metadata: {
          market: 'player_points',
          liquidity: 0.3,
          volatility: 0.8
        }
      };

      const kellyResult = await riskManager['calculateKellyPosition'](highRiskPosition);
      const adjustedSize = await riskManager['adjustForRiskLimits'](kellyResult, highRiskPosition);

      expect(adjustedSize).toBeLessThan(kellyResult.recommendedSize);
    });
  });

  describe('Portfolio Risk', () => {
    it('should enforce portfolio-level risk limits', async () => {
      // Add multiple positions
      const positions = [
        { ...mockPosition, sector: 'basketball', size: 0.03 },
        { ...mockPosition, sector: 'basketball', size: 0.03 },
        { ...mockPosition, sector: 'football', size: 0.02 }
      ];

      // Add positions to portfolio
      for (const position of positions) {
        await riskManager.evaluatePosition(position);
      }

      // Try to add position that would breach sector limit
      const newPosition: PortfolioPosition = {
        ...mockPosition,
        sector: 'basketball',
        size: 0.05
      };

      const metrics = await riskManager.evaluatePosition(newPosition);
      
      // Should identify sector concentration risk
      expect(metrics.totalRisk).toBeGreaterThan(0.15);
    });

    it('should handle correlation risk', async () => {
      const correlatedPositions = [
        { ...mockPosition, market: 'player_points', player: 'Player1' },
        { ...mockPosition, market: 'player_assists', player: 'Player1' }
      ];

      for (const position of correlatedPositions) {
        const metrics = await riskManager.evaluatePosition(position);
        expect(metrics.correlations.portfolio).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Stress Testing', () => {
    it('should simulate market stress scenarios', async () => {
      const position = mockPosition;
      const metrics = await riskManager.evaluatePosition(position);

      // Verify stress test scenarios
      expect(metrics.stressTestResults).toHaveProperty('marketCrash');
      expect(metrics.stressTestResults).toHaveProperty('highVolatility');
      expect(metrics.stressTestResults).toHaveProperty('sectorDecline');

      // Verify reasonable stress impacts
      Object.values(metrics.stressTestResults).forEach(impact => {
        expect(impact).toBeLessThan(0);
        expect(impact).toBeGreaterThan(-0.5);
      });
    });

    it('should handle extreme market conditions', async () => {
      const extremePosition: PortfolioPosition = {
        ...mockPosition,
        metadata: {
          market: 'player_points',
          liquidity: 0.1,  // Very low liquidity
          volatility: 0.9  // Extreme volatility
        }
      };

      const metrics = await riskManager.evaluatePosition(extremePosition);

      // Should have severe risk metrics
      expect(metrics.valueAtRisk).toBeGreaterThan(0.25);
      expect(metrics.totalRisk).toBeGreaterThan(0.3);
      expect(metrics.stressTestResults.marketCrash).toBeLessThan(-0.3);
    });
  });

  describe('Risk Reduction', () => {
    it('should implement risk reduction when limits are breached', async () => {
      const highRiskPosition: PortfolioPosition = {
        ...mockPosition,
        size: 0.1 // Exceeds position limit
      };

      const metrics = await riskManager.evaluatePosition(highRiskPosition);
      const breaches = riskManager['checkRiskLimits'](metrics);

      expect(breaches).toContain('position_size');
      
      // Verify risk reduction plan
      const reductionPlan = await riskManager['calculateRiskReduction'](highRiskPosition);
      expect(reductionPlan).toBeDefined();
      expect(reductionPlan.positions[0].targetSize).toBeLessThan(highRiskPosition.size);
    });

    it('should handle multiple limit breaches', async () => {
      const multipleBreachPosition: PortfolioPosition = {
        ...mockPosition,
        size: 0.1,
        metadata: {
          market: 'player_points',
          liquidity: 0.2,
          volatility: 0.9
        }
      };

      const metrics = await riskManager.evaluatePosition(multipleBreachPosition);
      const breaches = riskManager['checkRiskLimits'](metrics);

      expect(breaches.length).toBeGreaterThan(1);
      expect(breaches).toContain('position_size');
      expect(breaches).toContain('portfolio_risk');
    });
  });
}); 