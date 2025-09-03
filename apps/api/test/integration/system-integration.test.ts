import { EnhancedMLPipeline } from '../../ml/enhanced-pipeline';
import { EnhancedMonitoringSystem } from '../../monitoring/enhanced-monitoring';
import { SystemOrchestrator } from '../../services/orchestrator';
import { EnhancedRiskManager } from '../../src/risk/enhanced-risk-manager';
import { 
  PortfolioPosition,
  RiskMetrics,
  PredictionResult,
  SystemStatus
} from '../../types';

describe('System Integration', () => {
  let orchestrator: SystemOrchestrator;
  let mlPipeline: EnhancedMLPipeline;
  let riskManager: EnhancedRiskManager;
  let monitoring: EnhancedMonitoringSystem;

  beforeEach(async () => {
    monitoring = new EnhancedMonitoringSystem();
    mlPipeline = new EnhancedMLPipeline();
    riskManager = new EnhancedRiskManager();
    orchestrator = new SystemOrchestrator();

    // Wait for system initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('End-to-End Position Evaluation', () => {
    it('should process position through entire pipeline', async () => {
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

      const result = await orchestrator.evaluatePosition(position);

      // Verify complete evaluation
      expect(result.prediction).toBeDefined();
      expect(result.risk).toBeDefined();
      expect(result.recommendation).toBeDefined();

      // Verify prediction quality
      expect(result.prediction.confidence).toBeGreaterThan(0.7);
      expect(result.prediction.metadata?.dataQuality).toBeGreaterThan(0.8);

      // Verify risk assessment
      expect(result.risk.totalRisk).toBeLessThan(0.2);
      expect(result.risk.valueAtRisk).toBeLessThan(0.15);

      // Verify monitoring
      const health = await orchestrator.getSystemHealth();
      expect(health.status).toBe('healthy');
    });

    it('should handle high volume of concurrent requests', async () => {
      const positions: PortfolioPosition[] = Array(50).fill(null).map((_, i) => ({
        id: `${i}`,
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
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        positions.map(position => orchestrator.evaluatePosition(position))
      );
      const endTime = Date.now();

      // Verify all requests processed successfully
      expect(results).toHaveLength(positions.length);
      results.forEach(result => {
        expect(result.prediction).toBeDefined();
        expect(result.risk).toBeDefined();
      });

      // Verify performance under load
      const avgLatency = (endTime - startTime) / positions.length;
      expect(avgLatency).toBeLessThan(100); // 100ms per request average

      // Verify system health maintained
      const health = await orchestrator.getSystemHealth();
      expect(health.status).toBe('healthy');
    });
  });

  describe('System Resilience', () => {
    it('should handle ML model failures gracefully', async () => {
      // Simulate ML model failure
      jest.spyOn(mlPipeline, 'predict').mockRejectedValueOnce(new Error('Model failure'));

      const position = {
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

      // Should still complete with fallback
      const result = await orchestrator.evaluatePosition(position);
      expect(result).toBeDefined();
      expect(result.recommendation).toBe('AVOID'); // Conservative fallback
    });

    it('should recover from system degradation', async () => {
      // Simulate system stress
      const heavyLoad = Array(100).fill(null).map((_, i) => ({
        id: `${i}`,
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
      }));

      // Process heavy load
      await Promise.all(
        heavyLoad.map(position => orchestrator.evaluatePosition(position))
      );

      // Allow system to recover
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify system recovery
      const health = await orchestrator.getSystemHealth();
      expect(health.status).toBe('healthy');

      // Verify normal operation resumed
      const testPosition = heavyLoad[0];
      const result = await orchestrator.evaluatePosition(testPosition);
      expect(result.prediction.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('System Monitoring', () => {
    it('should track critical metrics', async () => {
      const position = {
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

      // Process position
      await orchestrator.evaluatePosition(position);

      // Verify metrics
      const health = await orchestrator.getSystemHealth();
      expect(health.metrics).toBeDefined();
      expect(health.metrics.prediction.accuracy).toBeGreaterThan(0);
      expect(health.metrics.prediction.latency).toBeGreaterThan(0);
      expect(health.metrics.risk.exposure).toBeGreaterThan(0);
    });

    it('should detect and report system degradation', async () => {
      // Simulate resource exhaustion
      const memory = process.memoryUsage();
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        ...memory,
        heapUsed: memory.heapTotal * 0.9 // 90% heap usage
      });

      const health = await orchestrator.getSystemHealth();
      expect(health.status).toBe('degraded');
      expect(health.components.monitoring).toBe('degraded');
    });
  });

  describe('Data Quality', () => {
    it('should maintain data consistency across systems', async () => {
      const position = {
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

      // Get predictions and risks separately
      const mlPrediction = await mlPipeline.predict(position);
      const riskMetrics = await riskManager.evaluatePosition(position);

      // Get orchestrated result
      const orchestratedResult = await orchestrator.evaluatePosition(position);

      // Verify data consistency
      expect(orchestratedResult.prediction.confidence)
        .toBeCloseTo(mlPrediction.confidence, 4);
      expect(orchestratedResult.risk.totalRisk)
        .toBeCloseTo(riskMetrics.totalRisk, 4);
    });

    it('should handle data validation errors', async () => {
      const invalidPosition = {
        id: '1',
        type: 'single',
        sport: 'NBA',
        league: 'NBA',
        sector: 'basketball',
        confidence: 2.0, // Invalid confidence > 1
        odds: -110,
        timestamp: new Date().toISOString(),
        metadata: {
          market: 'player_points',
          liquidity: 0.8,
          volatility: 0.2
        }
      };

      await expect(orchestrator.evaluatePosition(invalidPosition))
        .rejects.toThrow();

      // Verify system remains healthy
      const health = await orchestrator.getSystemHealth();
      expect(health.status).toBe('healthy');
    });
  });
}); 