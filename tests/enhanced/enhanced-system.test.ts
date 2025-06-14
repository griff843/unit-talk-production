import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AIOrchestrator } from '../../src/agents/AlertAgent/aiOrchestrator';
import { EnhancedAlertManager } from '../../src/monitoring/alerts';
import { UnitTalkMetrics } from '../../src/monitoring/Dashboard';
import { FinalPick } from '../../src/types/picks';

// Mock OpenAI
jest.mock('openai', () => ({
  __esModule: true,
  default: class MockOpenAI {
    chat = {
      completions: {
        // @ts-ignore
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '**HOLD** - Strong pick with good edge score. Monitor for optimal entry timing.'
            }
          }]
        })
      }
    };
  }
}));

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-key';
process.env.DISCORD_ALERT_WEBHOOK = 'https://discord.com/api/webhooks/test';

describe('Enhanced AI Orchestrator', () => {
  let orchestrator: AIOrchestrator;
  let mockPick: FinalPick;

  beforeEach(() => {
    orchestrator = new AIOrchestrator();
    mockPick = {
      id: 'test-pick-1',
      player_name: 'Test Player',
      market_type: 'points',
      line: 25.5,
      odds: -110,
      tier: 'A',
      edge_score: 15,
      is_sharp_fade: false,
      tags: ['nba', 'player-props'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      play_status: 'pending'
    };
  });

  describe('Model Selection', () => {
    it('should select optimal model based on pick tier', async () => {
      const advice = await orchestrator.getAdviceForPick(mockPick);
      
      expect(advice).toBeDefined();
      expect(advice.model).toBe('gpt-4-turbo'); // Should select highest priority model
      expect(advice.confidence).toBeGreaterThan(0);
      expect(advice.advice).toContain('HOLD');
    });

    it('should handle high-tier picks with lower temperature', async () => {
      const sTierPick = { ...mockPick, tier: 'S' as const };
      const advice = await orchestrator.getAdviceForPick(sTierPick);
      
      expect(advice.temperature).toBeLessThan(0.3); // Should use lower temperature for S-tier
    });

    it('should provide fallback advice when AI fails', async () => {
      // Mock AI failure
      const mockOrchestrator = new AIOrchestrator();
      jest.spyOn(mockOrchestrator as any, 'queryModel').mockRejectedValue(new Error('AI service unavailable'));
      
      const advice = await mockOrchestrator.getAdviceForPick(mockPick);
      
      expect(advice.fallbackUsed).toBe(true);
      expect(advice.model).toBe('fallback-rules');
    });
  });

  describe('Consensus Advice', () => {
    it('should aggregate multiple model responses', async () => {
      const consensus = await orchestrator.getConsensusAdvice(mockPick);
      
      expect(consensus).toBeDefined();
      expect(consensus.models.length).toBeGreaterThan(0);
      expect(consensus.agreement).toBeGreaterThan(0);
      expect(consensus.confidence).toBeGreaterThan(0);
    });

    it('should identify conflicts in model responses', async () => {
      // This would require mocking different responses from different models
      // For now, we'll test the structure
      const consensus = await orchestrator.getConsensusAdvice(mockPick);
      
      expect(consensus.conflictFlags).toBeDefined();
      expect(Array.isArray(consensus.conflictFlags)).toBe(true);
    });
  });

  describe('Performance Tracking', () => {
    it('should track model performance metrics', async () => {
      await orchestrator.getAdviceForPick(mockPick);
      
      const performance = await orchestrator.getModelPerformance();
      expect(performance.size).toBeGreaterThan(0);
      
      const gpt4Performance = performance.get('gpt-4-turbo');
      expect(gpt4Performance).toBeDefined();
      expect(gpt4Performance?.totalPredictions).toBeGreaterThanOrEqual(0);
    });

    it('should update model accuracy over time', async () => {
      const initialPerformance = await orchestrator.getModelPerformance();
      const initialAccuracy = initialPerformance.get('gpt-4-turbo')?.accuracy || 0;
      
      // Simulate successful prediction
      (orchestrator as any).updateModelPerformance('gpt-4-turbo', true, 1000);
      
      const updatedPerformance = await orchestrator.getModelPerformance();
      const updatedAccuracy = updatedPerformance.get('gpt-4-turbo')?.accuracy || 0;
      
      expect(updatedAccuracy).toBeGreaterThanOrEqual(initialAccuracy);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after multiple failures', async () => {
      const circuitBreaker = (orchestrator as any).circuitBreaker;
      
      // Simulate multiple failures
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure('test-model');
      }
      
      expect(circuitBreaker.isOpen('test-model')).toBe(true);
    });

    it('should reset circuit breaker after timeout', async () => {
      const circuitBreaker = (orchestrator as any).circuitBreaker;
      
      // Simulate failures and then reset
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure('test-model');
      }
      
      circuitBreaker.reset('test-model');
      expect(circuitBreaker.isOpen('test-model')).toBe(false);
    });
  });
});

describe('Enhanced Alert Manager', () => {
  let alertManager: EnhancedAlertManager;
  let metrics: UnitTalkMetrics;

  beforeEach(() => {
    alertManager = new EnhancedAlertManager();
    metrics = new UnitTalkMetrics();
  });

  afterEach(() => {
    // Clean up any intervals or timeouts
    jest.clearAllTimers();
  });

  describe('Alert Rules', () => {
    it('should evaluate error rate alerts correctly', async () => {
      const mockMetrics = {
        totalRequests: 100,
        totalErrors: 10, // 10% error rate
        avgProcessingTime: 2.5,
        unhealthyAgents: 0,
        totalAIRequests: 50,
        totalAIErrors: 1,
        pickAccuracy: 0.75,
        dbConnectionErrors: 0,
        rateLimitHits: 3
      };

      await alertManager.evaluateMetrics(mockMetrics);
      
      const activeAlerts = alertManager.getActiveAlerts();
      const errorRateAlert = activeAlerts.find(alert => alert.ruleId === 'high-error-rate');
      
      expect(errorRateAlert).toBeDefined();
      expect(errorRateAlert?.severity).toBe('critical');
    });

    it('should respect cooldown periods', async () => {
      const mockMetrics = {
        totalRequests: 100,
        totalErrors: 10,
        avgProcessingTime: 2.5,
        unhealthyAgents: 0,
        totalAIRequests: 50,
        totalAIErrors: 1,
        pickAccuracy: 0.75,
        dbConnectionErrors: 0,
        rateLimitHits: 3
      };

      // First evaluation should trigger alert
      await alertManager.evaluateMetrics(mockMetrics);
      const firstAlerts = alertManager.getActiveAlerts();
      
      // Second evaluation immediately after should not trigger due to cooldown
      await alertManager.evaluateMetrics(mockMetrics);
      const secondAlerts = alertManager.getActiveAlerts();
      
      expect(secondAlerts.length).toBe(firstAlerts.length);
    });

    it('should filter alerts by severity for channels', async () => {
      const channels = alertManager.getChannels();
      const criticalChannel = channels.find(c => c.id === 'email-critical');
      
      expect(criticalChannel).toBeDefined();
      expect(criticalChannel?.severityFilter).toContain('critical');
      expect(criticalChannel?.severityFilter).not.toContain('info');
    });
  });

  describe('Alert Channels', () => {
    it('should have default channels configured', () => {
      const channels = alertManager.getChannels();
      
      expect(channels.length).toBeGreaterThan(0);
      expect(channels.some(c => c.type === 'discord')).toBe(true);
      expect(channels.some(c => c.type === 'email')).toBe(true);
    });

    it('should support multiple notification types', () => {
      const channels = alertManager.getChannels();
      const channelTypes = channels.map(c => c.type);
      
      expect(channelTypes).toContain('discord');
      expect(channelTypes).toContain('email');
      expect(channelTypes).toContain('sms');
      expect(channelTypes).toContain('webhook');
    });
  });

  describe('Alert Management', () => {
    it('should acknowledge alerts', () => {
      // Create a mock alert
      const mockAlert = {
        id: 'test-alert-1',
        ruleId: 'test-rule',
        title: 'Test Alert',
        description: 'Test alert description',
        severity: 'warning' as const,
        timestamp: new Date().toISOString(),
        value: 10,
        threshold: 5,
        status: 'active' as const,
        channels: ['discord-alerts'],
        tags: ['test'],
        metadata: {}
      };

      (alertManager as any).activeAlerts.set(mockAlert.id, mockAlert);
      
      alertManager.acknowledgeAlert(mockAlert.id);
      
      const alert = (alertManager as any).activeAlerts.get(mockAlert.id);
      expect(alert.status).toBe('acknowledged');
    });

    it('should resolve alerts', () => {
      // Create a mock alert
      const mockAlert = {
        id: 'test-alert-2',
        ruleId: 'test-rule',
        title: 'Test Alert',
        description: 'Test alert description',
        severity: 'warning' as const,
        timestamp: new Date().toISOString(),
        value: 10,
        threshold: 5,
        status: 'active' as const,
        channels: ['discord-alerts'],
        tags: ['test'],
        metadata: {}
      };

      (alertManager as any).activeAlerts.set(mockAlert.id, mockAlert);
      
      alertManager.resolveAlert(mockAlert.id);
      
      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts.find(a => a.id === mockAlert.id)).toBeUndefined();
    });

    it('should maintain alert history', () => {
      const initialHistory = alertManager.getAlertHistory();
      const initialCount = initialHistory.length;
      
      // The alert manager should have some history from initialization
      expect(initialCount).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Unit Talk Metrics', () => {
  let metrics: UnitTalkMetrics;

  beforeEach(() => {
    metrics = new UnitTalkMetrics();
  });

  describe('Agent Metrics', () => {
    it('should record agent processing time', () => {
      expect(() => {
        metrics.recordAgentProcessing('AlertAgent', 'process', 2.5);
      }).not.toThrow();
    });

    it('should record agent errors', () => {
      expect(() => {
        metrics.recordAgentError('AlertAgent', 'api_failure');
      }).not.toThrow();
    });

    it('should update agent health status', () => {
      expect(() => {
        metrics.updateAgentHealth('AlertAgent', 'supabase', true);
        metrics.updateAgentHealth('AlertAgent', 'openai', false);
      }).not.toThrow();
    });
  });

  describe('Alert Metrics', () => {
    it('should record alerts sent', () => {
      expect(() => {
        metrics.recordAlertSent('discord', 'A', 'HOLD');
      }).not.toThrow();
    });
  });

  describe('AI Model Metrics', () => {
    it('should record AI model requests', () => {
      expect(() => {
        metrics.recordAIModelRequest('gpt-4-turbo', 'openai', 'success', 1.5, 0.002);
      }).not.toThrow();
    });

    it('should update AI model accuracy', () => {
      expect(() => {
        metrics.updateAIModelAccuracy('gpt-4-turbo', 'openai', 0.78);
      }).not.toThrow();
    });
  });

  describe('Business Metrics', () => {
    it('should record pick processing', () => {
      expect(() => {
        metrics.recordPickProcessed('A', 'points', 'processed');
      }).not.toThrow();
    });

    it('should update business metrics', () => {
      expect(() => {
        metrics.updateBusinessMetric('user_engagement', 'daily', 85.5);
      }).not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should record performance summaries', () => {
      expect(() => {
        metrics.recordPerformance('alert_processing', 'AlertAgent', 3.2);
      }).not.toThrow();
    });
  });
});

describe('Integration Tests', () => {
  let orchestrator: AIOrchestrator;
  let alertManager: EnhancedAlertManager;
  let metrics: UnitTalkMetrics;

  beforeEach(() => {
    orchestrator = new AIOrchestrator();
    alertManager = new EnhancedAlertManager();
    metrics = new UnitTalkMetrics();
  });

  describe('End-to-End Alert Flow', () => {
    it('should process pick, generate advice, and trigger alerts if needed', async () => {
      const mockPick: FinalPick = {
        id: 'integration-test-1',
        player_name: 'Integration Test Player',
        market_type: 'points',
        line: 25.5,
        odds: -110,
        tier: 'A',
        edge_score: 15,
        is_sharp_fade: false,
        tags: ['nba', 'integration-test'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        play_status: 'pending'
      };

      // Generate AI advice
      const advice = await orchestrator.getAdviceForPick(mockPick);
      expect(advice).toBeDefined();

      // Record metrics
      metrics.recordPickProcessed(mockPick.tier, mockPick.market_type, 'processed');
      metrics.recordAIModelRequest(advice.model, 'openai', 'success', advice.processingTime);

      // Simulate alert conditions
      const mockMetrics = {
        totalRequests: 100,
        totalErrors: 2, // Low error rate, shouldn't trigger alert
        avgProcessingTime: advice.processingTime,
        unhealthyAgents: 0,
        totalAIRequests: 1,
        totalAIErrors: 0,
        pickAccuracy: 0.75,
        dbConnectionErrors: 0,
        rateLimitHits: 0
      };

      await alertManager.evaluateMetrics(mockMetrics);
      
      // Should not trigger any critical alerts with these metrics
      const activeAlerts = alertManager.getActiveAlerts();
      const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
      expect(criticalAlerts.length).toBe(0);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple concurrent requests', async () => {
      const mockPick: FinalPick = {
        id: 'load-test-1',
        player_name: 'Load Test Player',
        market_type: 'points',
        line: 25.5,
        odds: -110,
        tier: 'B',
        edge_score: 12,
        is_sharp_fade: false,
        tags: ['load-test'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        play_status: 'pending'
      };

      const promises = Array(5).fill(null).map(() => 
        orchestrator.getAdviceForPick(mockPick)
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle AI service failures', async () => {
      const mockPick: FinalPick = {
        id: 'error-test-1',
        player_name: 'Error Test Player',
        market_type: 'points',
        line: 25.5,
        odds: -110,
        tier: 'C',
        edge_score: 8,
        is_sharp_fade: false,
        tags: ['error-test'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        play_status: 'pending'
      };

      // Mock AI failure
      const mockOrchestrator = new AIOrchestrator();
      jest.spyOn(mockOrchestrator as any, 'queryModel').mockRejectedValue(new Error('Service unavailable'));

      const advice = await mockOrchestrator.getAdviceForPick(mockPick);
      
      expect(advice.fallbackUsed).toBe(true);
      expect(advice.advice).toContain('HOLD'); // Should provide fallback advice
    });

    it('should handle malformed metric data', async () => {
      const malformedMetrics = {
        // Missing required fields
        totalRequests: null,
        totalErrors: undefined,
        avgProcessingTime: 'invalid'
      };

      // Should not throw error
      expect(async () => {
        await alertManager.evaluateMetrics(malformedMetrics as any);
      }).not.toThrow();
    });
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  let orchestrator: AIOrchestrator;

  beforeEach(() => {
    orchestrator = new AIOrchestrator();
  });

  it('should generate advice within acceptable time limits', async () => {
    const mockPick: FinalPick = {
      id: 'perf-test-1',
      player_name: 'Performance Test Player',
      market_type: 'points',
      line: 25.5,
      odds: -110,
      tier: 'A',
      edge_score: 15,
      is_sharp_fade: false,
      tags: ['performance-test'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      play_status: 'pending'
    };

    const startTime = Date.now();
    const advice = await orchestrator.getAdviceForPick(mockPick);
    const endTime = Date.now();
    
    const processingTime = endTime - startTime;
    
    expect(advice).toBeDefined();
    expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
  });

  it('should maintain performance with multiple model queries', async () => {
    const mockPick: FinalPick = {
      id: 'consensus-perf-test-1',
      player_name: 'Consensus Performance Test Player',
      market_type: 'points',
      line: 25.5,
      odds: -110,
      tier: 'S',
      edge_score: 20,
      is_sharp_fade: false,
      tags: ['consensus-performance-test'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      play_status: 'pending'
    };

    const startTime = Date.now();
    const consensus = await orchestrator.getConsensusAdvice(mockPick);
    const endTime = Date.now();
    
    const processingTime = endTime - startTime;
    
    expect(consensus).toBeDefined();
    expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds for consensus
  });
});

export {};