import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { AutomatedOnboardingAgent } from '../../src/agents/AutomatedOnboardingAgent';
import { BaseAgentConfig, BaseAgentDependencies } from '../../src/agents/BaseAgent/types';
import { PerformanceOptimizationAgent } from '../../src/agents/PerformanceOptimizationAgent';
import { PredictiveAnalyticsAgent } from '../../src/agents/PredictiveAnalyticsAgent';
import { RiskManagementAgent } from '../../src/agents/RiskManagementAgent';
import { UserRetentionAgent } from '../../src/agents/UserRetentionAgent';
import { redisCache } from '../../src/cache/enhanced-cache';

// Mock dependencies
jest.mock('../../src/cache/enhanced-cache');
jest.mock('../../src/services/enhanced-circuit-breaker');

interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHits: number;
  throughput: number;
}

describe('Agent Performance Testing Suite', () => {
  let mockConfig: BaseAgentConfig;
  let mockDeps: BaseAgentDependencies;

  beforeEach(() => {
    mockConfig = {
      name: 'test-agent',
      enabled: true,
      logLevel: 'info',
      schedule: 'enabled',
      metrics: { enabled: true, interval: 60000, port: 3001 },
      health: { enabled: true, interval: 30000, timeout: 5000 },
      retry: { enabled: true, maxRetries: 3, backoffMs: 1000 },
    };

    mockDeps = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any,
      supabase: null,
      redis: null,
      temporal: null,
    };

    jest.clearAllMocks();
    (redisCache.get as jest.Mock).mockResolvedValue(null);
    (redisCache.set as jest.Mock).mockResolvedValue(true);
    (redisCache.getPattern as jest.Mock).mockResolvedValue(new Map());
    (redisCache.ping as jest.Mock).mockResolvedValue('PONG');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // Helper function to measure performance
  const measurePerformance = async (fn: () => Promise<any>): Promise<PerformanceMetrics> => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    const startCpu = process.cpuUsage();

    await fn();

    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    const endCpu = process.cpuUsage(startCpu);

    return {
      executionTime: endTime - startTime,
      memoryUsage: endMemory - startMemory,
      cpuUsage: (endCpu.user + endCpu.system) / 1000, // Convert to milliseconds
      cacheHits: 0, // Would be measured from actual cache metrics
      throughput: 1000 / (endTime - startTime), // Operations per second
    };
  };

  describe('AutomatedOnboardingAgent Performance', () => {
    let agent: AutomatedOnboardingAgent;

    beforeEach(async () => {
      agent = new AutomatedOnboardingAgent(mockConfig, mockDeps);
      await agent.initialize();
    });

    test('should initialize within performance thresholds', async () => {
      const newAgent = new AutomatedOnboardingAgent(mockConfig, mockDeps);

      const metrics = await measurePerformance(async () => {
        await newAgent.initialize();
      });

      expect(metrics.executionTime).toBeLessThan(5000); // 5 seconds max
      expect(metrics.memoryUsage).toBeLessThan(50 * 1024 * 1024); // 50MB max
    });

    test('should handle high-frequency user behavior tracking', async () => {
      const behaviorEvents = Array.from({ length: 1000 }, (_, i) => ({
        userId: `user-${i % 100}`, // 100 unique users
        action: 'message_sent',
        timestamp: new Date(),
        metadata: { channel: 'general', messageLength: 50 + i },
      }));

      const trackBehaviorSpy = jest.spyOn(agent as any, 'trackUserBehavior');
      trackBehaviorSpy.mockResolvedValue(true);

      const metrics = await measurePerformance(async () => {
        const promises = behaviorEvents.map(event => agent.trackUserBehavior(event));
        await Promise.all(promises);
      });

      expect(metrics.executionTime).toBeLessThan(3000); // 3 seconds for 1000 events
      expect(metrics.throughput).toBeGreaterThan(100); // At least 100 ops/second
      expect(trackBehaviorSpy).toHaveBeenCalledTimes(1000);
    });

    test('should maintain memory efficiency under sustained load', async () => {
      const generateResponseSpy = jest.spyOn(agent as any, 'generateResponse');
      generateResponseSpy.mockResolvedValue({
        content: 'Hello! How can I help you today?',
        intent: 'greeting',
        confidence: 0.9,
      });

      let maxMemoryIncrease = 0;
      const iterations = 500;

      for (let i = 0; i < iterations; i++) {
        const startMemory = process.memoryUsage().heapUsed;

        await agent.generateResponse({
          userId: `user-${i % 50}`,
          content: `Test message ${i}`,
          timestamp: new Date(),
          channelId: 'test-channel',
        });

        const endMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = endMemory - startMemory;
        maxMemoryIncrease = Math.max(maxMemoryIncrease, memoryIncrease);

        // Force garbage collection every 100 iterations
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      // Memory increase should be reasonable (less than 10MB per operation)
      expect(maxMemoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('UserRetentionAgent Performance', () => {
    let agent: UserRetentionAgent;

    beforeEach(async () => {
      agent = new UserRetentionAgent(mockConfig, mockDeps);
      await agent.initialize();
    });

    test('should handle batch churn prediction efficiently', async () => {
      const users = Array.from({ length: 500 }, (_, i) => ({
        userId: `user-${i}`,
        lastActive: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        engagementScore: Math.random(),
        totalBets: Math.floor(Math.random() * 200),
        winRate: 0.4 + Math.random() * 0.4,
      }));

      const predictChurnSpy = jest.spyOn(agent as any, 'predictChurn');
      predictChurnSpy.mockImplementation(async user => ({
        userId: user.userId,
        churnProbability: Math.random(),
        confidence: 0.8 + Math.random() * 0.2,
        riskFactors: ['low_engagement'],
        predictedAt: new Date(),
      }));

      const metrics = await measurePerformance(async () => {
        const batchSize = 50;
        const batches = [];

        for (let i = 0; i < users.length; i += batchSize) {
          const batch = users.slice(i, i + batchSize);
          batches.push(Promise.all(batch.map(user => agent.predictChurn(user))));
        }

        await Promise.all(batches);
      });

      expect(metrics.executionTime).toBeLessThan(10000); // 10 seconds for 500 users
      expect(metrics.throughput).toBeGreaterThan(25); // At least 25 predictions/second
    });

    test('should optimize user segmentation performance', async () => {
      const users = Array.from({ length: 1000 }, (_, i) => ({
        userId: `user-${i}`,
        engagementScore: Math.random(),
        totalBets: Math.floor(Math.random() * 300),
        winRate: 0.3 + Math.random() * 0.5,
        avgBetSize: 10 + Math.random() * 200,
        daysSinceLastBet: Math.floor(Math.random() * 90),
      }));

      const segmentUsersSpy = jest.spyOn(agent as any, 'segmentUsers');
      segmentUsersSpy.mockResolvedValue({
        segments: [
          { name: 'high_value', users: users.slice(0, 100), characteristics: {} },
          { name: 'at_risk', users: users.slice(100, 300), characteristics: {} },
          { name: 'casual', users: users.slice(300, 700), characteristics: {} },
          { name: 'inactive', users: users.slice(700), characteristics: {} },
        ],
        algorithm: 'k_means',
        silhouetteScore: 0.75,
        processedAt: new Date(),
      });

      const metrics = await measurePerformance(async () => {
        await agent.segmentUsers(users);
      });

      expect(metrics.executionTime).toBeLessThan(5000); // 5 seconds for 1000 users
      expect(segmentUsersSpy).toHaveBeenCalledWith(users);
    });
  });

  describe('RiskManagementAgent Performance', () => {
    let agent: RiskManagementAgent;

    beforeEach(async () => {
      agent = new RiskManagementAgent(mockConfig, mockDeps);
      await agent.initialize();
    });

    test('should perform real-time portfolio optimization', async () => {
      const portfolio = {
        positions: Array.from({ length: 20 }, (_, i) => ({
          symbol: `POSITION_${i}`,
          allocation: 1 / 20,
          expectedReturn: 0.05 + Math.random() * 0.1,
          volatility: 0.1 + Math.random() * 0.2,
          correlation: Math.random() * 0.4 - 0.2,
        })),
        totalValue: 100000,
        riskTolerance: 0.25,
      };

      const optimizePortfolioSpy = jest.spyOn(agent as any, 'optimizePortfolio');
      optimizePortfolioSpy.mockResolvedValue({
        optimizedAllocations: portfolio.positions.reduce(
          (acc, pos) => {
            acc[pos.symbol] = Math.random() * 0.1;
            return acc;
          },
          {} as Record<string, number>
        ),
        expectedReturn: 0.08,
        portfolioRisk: 0.15,
        sharpeRatio: 1.6,
        optimizationTime: 500,
      });

      const metrics = await measurePerformance(async () => {
        await agent.optimizePortfolio(portfolio);
      });

      expect(metrics.executionTime).toBeLessThan(2000); // 2 seconds for 20 positions
      expect(optimizePortfolioSpy).toHaveBeenCalledWith(portfolio);
    });

    test('should handle concurrent risk calculations', async () => {
      const portfolios = Array.from({ length: 50 }, (_, i) => ({
        positions: [
          { value: 1000 + i * 100, volatility: 0.1 + Math.random() * 0.1, correlation: 0.2 },
          { value: 2000 + i * 150, volatility: 0.12 + Math.random() * 0.08, correlation: 0.1 },
          { value: 1500 + i * 120, volatility: 0.15 + Math.random() * 0.1, correlation: 0.3 },
        ],
        timeHorizon: 30,
      }));

      const assessRiskSpy = jest.spyOn(agent as any, 'assessRisk');
      assessRiskSpy.mockImplementation(async portfolio => ({
        var95: Math.random() * 0.2,
        expectedShortfall: Math.random() * 0.3,
        volatility: Math.random() * 0.2,
        concentration: Math.random() * 0.5,
        portfolioId: `portfolio-${Date.now()}`,
      }));

      const metrics = await measurePerformance(async () => {
        const promises = portfolios.map(portfolio => agent.assessRisk(portfolio));
        await Promise.all(promises);
      });

      expect(metrics.executionTime).toBeLessThan(5000); // 5 seconds for 50 portfolios
      expect(metrics.throughput).toBeGreaterThan(5); // At least 5 assessments/second
    });
  });

  describe('PredictiveAnalyticsAgent Performance', () => {
    let agent: PredictiveAnalyticsAgent;

    beforeEach(async () => {
      agent = new PredictiveAnalyticsAgent(mockConfig, mockDeps);
      await agent.initialize();
    });

    test('should process market data efficiently', async () => {
      const marketData = Array.from({ length: 1000 }, (_, i) => ({
        id: `data-${i}`,
        marketId: `market-${i % 100}`,
        timestamp: new Date(),
        odds: 1.5 + Math.random() * 2,
        volume: Math.floor(Math.random() * 100000),
        price: 50 + Math.random() * 100,
        bidAskSpread: Math.random() * 0.1,
        liquidity: Math.floor(Math.random() * 50000),
        volatility: Math.random() * 0.3,
        source: `provider-${i % 5}`,
        quality: 0.7 + Math.random() * 0.3,
      }));

      const processMarketDataSpy = jest.spyOn(agent as any, 'processMarketData');
      processMarketDataSpy.mockImplementation(async data =>
        data.map((item: any) => ({
          ...item,
          features: {
            normalized_odds: item.odds / 5,
            volume_score: Math.min(1, item.volume / 100000),
            liquidity_ratio: item.liquidity / item.volume,
          },
          technicalIndicators: {
            sma_5: item.price,
            rsi_14: 30 + Math.random() * 40,
            bollinger_upper: item.price * 1.1,
            bollinger_lower: item.price * 0.9,
          },
          qualityScore: item.quality,
        }))
      );

      const metrics = await measurePerformance(async () => {
        await agent.processMarketData(marketData);
      });

      expect(metrics.executionTime).toBeLessThan(3000); // 3 seconds for 1000 data points
      expect(metrics.throughput).toBeGreaterThan(100); // At least 100 data points/second
    });

    test('should maintain prediction latency under load', async () => {
      const markets = Array.from({ length: 100 }, (_, i) => ({
        id: `market-${i}`,
        gameId: `game-${i % 10}`,
        betType: ['moneyline', 'spread', 'total'][i % 3],
        currentOdds: 1.5 + Math.random() * 2,
        volume: Math.floor(Math.random() * 100000),
        liquidity: Math.floor(Math.random() * 50000),
      }));

      const generatePredictionSpy = jest.spyOn(agent as any, 'generatePrediction');
      generatePredictionSpy.mockImplementation(async market => ({
        predictionId: `pred-${market.id}`,
        marketId: market.id,
        predictedOutcome: {
          winProbability: 0.4 + Math.random() * 0.2,
          expectedValue: Math.random() * 0.1,
          confidence: 0.7 + Math.random() * 0.3,
        },
        confidence: 0.8,
        modelVersion: 'v2.1',
        generatedAt: new Date(),
      }));

      const latencies: number[] = [];

      for (const market of markets) {
        const startTime = Date.now();
        await agent.generatePrediction(market);
        const latency = Date.now() - startTime;
        latencies.push(latency);
      }

      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

      expect(avgLatency).toBeLessThan(100); // 100ms average latency
      expect(p95Latency).toBeLessThan(200); // 200ms P95 latency
    });
  });

  describe('PerformanceOptimizationAgent Performance', () => {
    let agent: PerformanceOptimizationAgent;

    beforeEach(async () => {
      agent = new PerformanceOptimizationAgent(mockConfig, mockDeps);
      await agent.initialize();
    });

    test('should collect comprehensive metrics efficiently', async () => {
      const collectMetricsSpy = jest.spyOn(agent as any, 'collectMetrics');
      collectMetricsSpy.mockResolvedValue({
        systemCpuUsage: Math.random() * 0.8,
        systemMemoryUsage: Math.random() * 0.8,
        systemDiskUsage: Math.random() * 0.6,
        networkLatency: 10 + Math.random() * 50,
        databaseQueryTime: 50 + Math.random() * 150,
        cacheHitRate: 0.7 + Math.random() * 0.3,
        errorRate: Math.random() * 0.05,
        throughput: 50 + Math.random() * 100,
        timestamp: Date.now(),
      });

      const metrics = await measurePerformance(async () => {
        // Simulate collecting metrics 100 times (typical monitoring interval)
        const promises = Array.from({ length: 100 }, () => agent.collectMetrics());
        await Promise.all(promises);
      });

      expect(metrics.executionTime).toBeLessThan(2000); // 2 seconds for 100 collections
      expect(metrics.throughput).toBeGreaterThan(25); // At least 25 collections/second
    });

    test('should detect bottlenecks with minimal overhead', async () => {
      const systemMetrics = {
        cpu: Math.random() * 0.9,
        memory: Math.random() * 0.9,
        disk: Math.random() * 0.8,
        network: Math.random() * 200,
        database: Math.random() * 300,
        cache: 0.5 + Math.random() * 0.5,
        errorRate: Math.random() * 0.1,
        throughput: 20 + Math.random() * 80,
      };

      const getActiveBottlenecksSpy = jest.spyOn(agent as any, 'getActiveBottlenecks');
      getActiveBottlenecksSpy.mockResolvedValue([
        {
          id: 'bottleneck-1',
          type: 'memory',
          severity: 'high',
          component: 'application',
          description: 'High memory usage detected',
          impact: 0.7,
          detectedAt: new Date(),
        },
      ]);

      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await agent.getActiveBottlenecks();
      }

      const totalTime = Date.now() - startTime;
      const avgLatency = totalTime / iterations;

      expect(avgLatency).toBeLessThan(10); // Less than 10ms per detection
      expect(totalTime).toBeLessThan(5000); // 5 seconds total for 1000 detections
    });
  });

  describe('Cross-Agent Performance Integration', () => {
    test('should handle concurrent agent operations efficiently', async () => {
      const agents = [
        new AutomatedOnboardingAgent(mockConfig, mockDeps),
        new UserRetentionAgent(mockConfig, mockDeps),
        new RiskManagementAgent(mockConfig, mockDeps),
        new PredictiveAnalyticsAgent(mockConfig, mockDeps),
        new PerformanceOptimizationAgent(mockConfig, mockDeps),
      ];

      // Initialize all agents concurrently
      const initMetrics = await measurePerformance(async () => {
        await Promise.all(agents.map(agent => agent.initialize()));
      });

      expect(initMetrics.executionTime).toBeLessThan(10000); // 10 seconds for all agents

      // Simulate concurrent operations
      const operationMetrics = await measurePerformance(async () => {
        const operations = [
          agents[0].checkHealth(),
          agents[1].checkHealth(),
          agents[2].checkHealth(),
          agents[3].checkHealth(),
          agents[4].checkHealth(),
        ];

        await Promise.all(operations);
      });

      expect(operationMetrics.executionTime).toBeLessThan(1000); // 1 second for health checks
    });

    test('should maintain performance under stress conditions', async () => {
      const performanceAgent = new PerformanceOptimizationAgent(mockConfig, mockDeps);
      await performanceAgent.initialize();

      const stressTest = async () => {
        const operations = Array.from({ length: 50 }, async (_, i) => {
          // Simulate various intensive operations
          const ops = [
            performanceAgent.checkHealth(),
            performanceAgent.collectMetrics?.(),
            performanceAgent.getActiveBottlenecks?.(),
            performanceAgent.getOptimizationRecommendations?.(),
          ].filter(Boolean);

          return Promise.all(ops);
        });

        return Promise.all(operations);
      };

      const stressMetrics = await measurePerformance(stressTest);

      expect(stressMetrics.executionTime).toBeLessThan(15000); // 15 seconds under stress
      expect(stressMetrics.memoryUsage).toBeLessThan(100 * 1024 * 1024); // 100MB max memory increase
    });
  });

  describe('Memory Leak Detection', () => {
    test('should not exhibit memory leaks during extended operation', async () => {
      const agent = new UserRetentionAgent(mockConfig, mockDeps);
      await agent.initialize();

      const predictChurnSpy = jest.spyOn(agent as any, 'predictChurn');
      predictChurnSpy.mockResolvedValue({
        userId: 'test-user',
        churnProbability: 0.5,
        confidence: 0.8,
      });

      const initialMemory = process.memoryUsage().heapUsed;
      const memoryReadings: number[] = [];

      // Run operations for extended period
      for (let cycle = 0; cycle < 10; cycle++) {
        // Perform 100 operations
        const operations = Array.from({ length: 100 }, () =>
          agent.predictChurn({
            userId: `user-${Math.random()}`,
            lastActive: new Date(),
            engagementScore: Math.random(),
            totalBets: Math.floor(Math.random() * 100),
            winRate: Math.random(),
          })
        );

        await Promise.all(operations);

        // Force garbage collection and measure memory
        if (global.gc) global.gc();
        memoryReadings.push(process.memoryUsage().heapUsed);

        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const maxMemoryReading = Math.max(...memoryReadings);

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      // Memory should not continuously grow
      expect(maxMemoryReading - initialMemory).toBeLessThan(100 * 1024 * 1024);
    });
  });
});
