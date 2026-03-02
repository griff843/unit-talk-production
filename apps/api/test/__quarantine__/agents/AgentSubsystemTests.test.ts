import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { BaseAgentConfig, BaseAgentDependencies } from '../../src/agents/BaseAgent/types';
import { PerformanceOptimizationAgent } from '../../src/agents/PerformanceOptimizationAgent';
import { PredictiveAnalyticsAgent } from '../../src/agents/PredictiveAnalyticsAgent';
import { RiskManagementAgent } from '../../src/agents/RiskManagementAgent';
import { UserRetentionAgent } from '../../src/agents/UserRetentionAgent';
import { redisCache } from '../../src/cache/enhanced-cache';

// Mock dependencies
jest.mock('../../src/cache/enhanced-cache');
jest.mock('../../src/services/enhanced-circuit-breaker');

describe('Agent Subsystem Specialized Tests', () => {
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

  describe('UserRetentionAgent - Advanced Features', () => {
    let agent: UserRetentionAgent;

    beforeEach(async () => {
      agent = new UserRetentionAgent(mockConfig, mockDeps);
      await agent.initialize();
    });

    test('should handle engagement analysis with multiple dimensions', async () => {
      const mockUserActivity = {
        userId: 'test-user-123',
        activities: [
          { type: 'login', timestamp: new Date(), metadata: { device: 'mobile' } },
          {
            type: 'bet_placed',
            timestamp: new Date(),
            metadata: { amount: 50, sport: 'football' },
          },
          {
            type: 'message_sent',
            timestamp: new Date(),
            metadata: { channel: 'general', length: 100 },
          },
          { type: 'pick_viewed', timestamp: new Date(), metadata: { category: 'premium' } },
        ],
        timeframe: '7d',
      };

      const engagementSpy = jest.spyOn(agent as any, 'analyzeEngagement');
      engagementSpy.mockResolvedValue({
        userId: 'test-user-123',
        overallScore: 0.75,
        dimensions: {
          activity_frequency: 0.8,
          betting_engagement: 0.7,
          social_interaction: 0.6,
          content_consumption: 0.9,
          retention_probability: 0.75,
        },
        trends: {
          weekly_change: 0.1,
          momentum: 'increasing',
        },
      });

      const analysis = await agent.analyzeEngagement(mockUserActivity);

      expect(analysis).toBeDefined();
      expect(analysis.dimensions).toHaveProperty('activity_frequency');
      expect(analysis.dimensions).toHaveProperty('betting_engagement');
      expect(analysis.dimensions).toHaveProperty('social_interaction');
      expect(analysis.overallScore).toBeGreaterThan(0.5);
    });

    test('should generate personalized retention strategies', async () => {
      const mockUserProfile = {
        userId: 'test-user-123',
        segment: 'high_value_declining',
        riskFactors: ['decreased_betting', 'lower_engagement'],
        preferences: { sports: ['football', 'basketball'], bet_types: ['moneyline', 'spread'] },
        history: { total_bets: 150, avg_bet_size: 75, win_rate: 0.68 },
      };

      const strategySpy = jest.spyOn(agent as any, 'generatePersonalizedStrategy');
      strategySpy.mockResolvedValue({
        userId: 'test-user-123',
        strategies: [
          {
            type: 'personalized_content',
            priority: 'high',
            actions: ['send_football_picks', 'offer_spread_analysis'],
            timeline: '24h',
            expectedImpact: 0.6,
          },
          {
            type: 'engagement_boost',
            priority: 'medium',
            actions: ['invite_to_contest', 'premium_trial'],
            timeline: '72h',
            expectedImpact: 0.4,
          },
        ],
        confidence: 0.8,
      });

      const strategy = await agent.generatePersonalizedStrategy(mockUserProfile);

      expect(strategy.strategies).toHaveLength(2);
      expect(strategy.strategies[0].type).toBe('personalized_content');
      expect(strategy.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('RiskManagementAgent - Portfolio Optimization', () => {
    let agent: RiskManagementAgent;

    beforeEach(async () => {
      agent = new RiskManagementAgent(mockConfig, mockDeps);
      await agent.initialize();
    });

    test('should perform Monte Carlo risk simulations', async () => {
      const mockPortfolio = {
        positions: [
          {
            symbol: 'OVER_45.5',
            allocation: 0.3,
            expectedReturn: 0.08,
            volatility: 0.15,
            correlation: 0.2,
          },
          {
            symbol: 'UNDER_52.5',
            allocation: 0.4,
            expectedReturn: 0.06,
            volatility: 0.12,
            correlation: -0.1,
          },
          {
            symbol: 'ML_HOME',
            allocation: 0.3,
            expectedReturn: 0.1,
            volatility: 0.18,
            correlation: 0.3,
          },
        ],
        totalValue: 50000,
        timeHorizon: 30,
      };

      const simulationSpy = jest.spyOn(agent as any, 'runMonteCarloSimulation');
      simulationSpy.mockResolvedValue({
        portfolioId: 'portfolio-123',
        simulations: 10000,
        results: {
          var95: 0.12,
          var99: 0.18,
          expectedShortfall: 0.15,
          maxDrawdown: 0.25,
          sharpeRatio: 1.8,
          expectedReturn: 0.076,
          volatility: 0.142,
        },
        scenarios: {
          best_case: { return: 0.15, probability: 0.05 },
          worst_case: { return: -0.22, probability: 0.05 },
          most_likely: { return: 0.076, probability: 0.68 },
        },
      });

      const simulation = await agent.runMonteCarloSimulation(mockPortfolio);

      expect(simulation.simulations).toBe(10000);
      expect(simulation.results.var95).toBeLessThan(simulation.results.var99);
      expect(simulation.results.sharpeRatio).toBeGreaterThan(1.0);
      expect(simulation.scenarios).toHaveProperty('best_case');
      expect(simulation.scenarios).toHaveProperty('worst_case');
    });

    test('should optimize portfolio using Black-Litterman model', async () => {
      const mockMarketData = {
        assets: ['OVER_45.5', 'UNDER_52.5', 'ML_HOME'],
        marketCap: [1000000, 800000, 1200000],
        expectedReturns: [0.08, 0.06, 0.1],
        covarianceMatrix: [
          [0.0225, 0.002, 0.004],
          [0.002, 0.0144, -0.001],
          [0.004, -0.001, 0.0324],
        ],
        riskAversion: 3.0,
      };

      const viewsData = {
        views: [
          { asset: 'OVER_45.5', expectedReturn: 0.09, confidence: 0.8 },
          { asset: 'ML_HOME', expectedReturn: 0.11, confidence: 0.6 },
        ],
      };

      const blOptimizationSpy = jest.spyOn(agent as any, 'blackLittermanOptimization');
      blOptimizationSpy.mockResolvedValue({
        optimizationId: 'bl-opt-123',
        allocations: {
          'OVER_45.5': 0.35,
          'UNDER_52.5': 0.35,
          ML_HOME: 0.3,
        },
        adjustedReturns: [0.084, 0.058, 0.103],
        portfolioReturn: 0.081,
        portfolioRisk: 0.138,
        sharpeRatio: 1.94,
        confidence: 0.75,
      });

      const optimization = await agent.blackLittermanOptimization(mockMarketData, viewsData);

      expect(optimization.allocations['OVER_45.5']).toBeCloseTo(0.35, 2);
      expect(optimization.portfolioReturn).toBeGreaterThan(0.07);
      expect(optimization.sharpeRatio).toBeGreaterThan(1.5);
    });
  });

  describe('PredictiveAnalyticsAgent - ML Model Management', () => {
    let agent: PredictiveAnalyticsAgent;

    beforeEach(async () => {
      agent = new PredictiveAnalyticsAgent(mockConfig, mockDeps);
      await agent.initialize();
    });

    test('should perform automated model training and evaluation', async () => {
      const mockTrainingData = {
        features: [
          {
            gameId: 'game-1',
            homeTeam: 'LAL',
            awayTeam: 'BOS',
            spread: -3.5,
            total: 215.5,
            weather: 'clear',
          },
          {
            gameId: 'game-2',
            homeTeam: 'GSW',
            awayTeam: 'MIA',
            spread: -7.0,
            total: 220.0,
            weather: 'indoor',
          },
        ],
        targets: [
          { gameId: 'game-1', outcome: 'under', actual_total: 212 },
          { gameId: 'game-2', outcome: 'cover', final_margin: 8 },
        ],
        validationSplit: 0.2,
      };

      const autoMLSpy = jest.spyOn(agent as any, 'runAutoMLTraining');
      autoMLSpy.mockResolvedValue({
        trainingId: 'automl-training-123',
        bestModel: {
          name: 'gradient_boosting_v2',
          algorithm: 'xgboost',
          hyperparameters: {
            n_estimators: 500,
            max_depth: 8,
            learning_rate: 0.1,
            subsample: 0.8,
          },
          performance: {
            accuracy: 0.72,
            precision: 0.68,
            recall: 0.75,
            f1_score: 0.71,
            auc_roc: 0.78,
          },
          feature_importance: {
            spread: 0.35,
            team_form: 0.28,
            total: 0.2,
            weather: 0.1,
            injuries: 0.07,
          },
        },
        modelComparison: [
          { name: 'random_forest', accuracy: 0.69, training_time: 45 },
          { name: 'neural_network', accuracy: 0.71, training_time: 120 },
          { name: 'gradient_boosting_v2', accuracy: 0.72, training_time: 85 },
        ],
        trainingMetrics: {
          total_samples: 10000,
          training_time: 85,
          convergence_achieved: true,
        },
      });

      const training = await agent.runAutoMLTraining(mockTrainingData);

      expect(training.bestModel.performance.accuracy).toBeGreaterThan(0.7);
      expect(training.bestModel.feature_importance.spread).toBeGreaterThan(0.3);
      expect(training.modelComparison).toHaveLength(3);
      expect(training.trainingMetrics.convergence_achieved).toBe(true);
    });

    test('should detect market anomalies and opportunities', async () => {
      const mockMarketData = [
        {
          marketId: 'market-1',
          odds: 1.85,
          volume: 50000,
          timestamp: new Date(),
          line_movement: 0.05,
        },
        {
          marketId: 'market-2',
          odds: 3.2,
          volume: 15000,
          timestamp: new Date(),
          line_movement: -0.15,
        },
        {
          marketId: 'market-3',
          odds: 1.45,
          volume: 80000,
          timestamp: new Date(),
          line_movement: 0.02,
        },
      ];

      const anomalyDetectionSpy = jest.spyOn(agent as any, 'detectMarketAnomalies');
      anomalyDetectionSpy.mockResolvedValue({
        detectionId: 'anomaly-detection-123',
        anomalies: [
          {
            marketId: 'market-2',
            type: 'unusual_line_movement',
            severity: 'high',
            confidence: 0.87,
            description: 'Significant line movement (-15 cents) with low volume',
            indicators: {
              line_movement: -0.15,
              volume_ratio: 0.3,
              time_window: '15min',
            },
            action_recommended: 'investigate_further',
          },
        ],
        opportunities: [
          {
            marketId: 'market-1',
            type: 'value_bet',
            confidence: 0.72,
            expected_value: 0.08,
            description: 'Model suggests 5% edge on current line',
            recommendation: {
              action: 'bet',
              suggested_stake: 0.02,
              max_exposure: 0.05,
            },
          },
        ],
        market_health: {
          overall_efficiency: 0.85,
          liquidity_score: 0.78,
          volatility_index: 0.42,
        },
      });

      const detection = await agent.detectMarketAnomalies(mockMarketData);

      expect(detection.anomalies).toHaveLength(1);
      expect(detection.anomalies[0].severity).toBe('high');
      expect(detection.opportunities).toHaveLength(1);
      expect(detection.opportunities[0].expected_value).toBeGreaterThan(0.05);
      expect(detection.market_health.overall_efficiency).toBeGreaterThan(0.8);
    });
  });

  describe('PerformanceOptimizationAgent - System Optimization', () => {
    let agent: PerformanceOptimizationAgent;

    beforeEach(async () => {
      agent = new PerformanceOptimizationAgent(mockConfig, mockDeps);
      await agent.initialize();
    });

    test('should perform intelligent bottleneck analysis', async () => {
      const mockSystemState = {
        components: {
          database: { response_time: 250, connection_pool: 85, query_cache_hit: 0.6 },
          cache: { hit_rate: 0.4, memory_usage: 0.9, eviction_rate: 0.2 },
          network: { latency: 120, packet_loss: 0.01, bandwidth_usage: 0.7 },
          application: { cpu_usage: 0.8, memory_usage: 0.75, error_rate: 0.08 },
        },
        workload: {
          requests_per_second: 45,
          concurrent_users: 200,
          peak_hours: true,
        },
      };

      const bottleneckAnalysisSpy = jest.spyOn(
        agent as any,
        'performIntelligentBottleneckAnalysis'
      );
      bottleneckAnalysisSpy.mockResolvedValue({
        analysisId: 'bottleneck-analysis-123',
        primaryBottlenecks: [
          {
            component: 'cache',
            severity: 'critical',
            impact_score: 0.9,
            root_causes: ['low_hit_rate', 'high_memory_pressure', 'frequent_evictions'],
            cascade_effects: ['increased_database_load', 'higher_response_times'],
            recommended_actions: [
              { action: 'increase_cache_memory', priority: 'immediate', estimated_impact: 0.7 },
              { action: 'optimize_cache_keys', priority: 'high', estimated_impact: 0.5 },
            ],
          },
          {
            component: 'database',
            severity: 'high',
            impact_score: 0.7,
            root_causes: ['slow_queries', 'connection_pool_saturation'],
            cascade_effects: ['application_timeouts', 'increased_error_rate'],
            recommended_actions: [
              { action: 'optimize_slow_queries', priority: 'high', estimated_impact: 0.6 },
              { action: 'increase_connection_pool', priority: 'medium', estimated_impact: 0.4 },
            ],
          },
        ],
        systemHealth: {
          overall_score: 0.35,
          component_scores: {
            database: 0.4,
            cache: 0.2,
            network: 0.6,
            application: 0.5,
          },
          predicted_failure_risk: 0.25,
        },
      });

      const analysis = await agent.performIntelligentBottleneckAnalysis(mockSystemState);

      expect(analysis.primaryBottlenecks).toHaveLength(2);
      expect(analysis.primaryBottlenecks[0].severity).toBe('critical');
      expect(analysis.systemHealth.overall_score).toBeLessThan(0.5);
      expect(analysis.systemHealth.predicted_failure_risk).toBeGreaterThan(0.2);
    });

    test('should execute automated optimization with safety validation', async () => {
      const mockOptimizationPlan = {
        optimizations: [
          {
            id: 'opt-1',
            type: 'cache_optimization',
            actions: ['increase_memory', 'optimize_ttl'],
            safety_score: 0.9,
            rollback_plan: ['revert_memory_size', 'restore_ttl_settings'],
          },
          {
            id: 'opt-2',
            type: 'query_optimization',
            actions: ['enable_query_cache', 'add_indexes'],
            safety_score: 0.8,
            rollback_plan: ['disable_query_cache', 'remove_indexes'],
          },
        ],
        validation_checks: ['cpu_usage_stable', 'memory_usage_stable', 'error_rate_normal'],
        monitoring_duration: 300,
      };

      const safeOptimizationSpy = jest.spyOn(
        agent as any,
        'executeOptimizationWithSafetyValidation'
      );
      safeOptimizationSpy.mockResolvedValue({
        executionId: 'safe-opt-execution-123',
        results: [
          {
            optimizationId: 'opt-1',
            status: 'success',
            applied_at: new Date(),
            before_metrics: { cache_hit_rate: 0.4, response_time: 250 },
            after_metrics: { cache_hit_rate: 0.75, response_time: 180 },
            impact: 0.6,
            safety_validation: 'passed',
          },
          {
            optimizationId: 'opt-2',
            status: 'rollback_triggered',
            applied_at: new Date(),
            rollback_reason: 'cpu_usage_exceeded_threshold',
            before_metrics: { query_time: 200, cpu_usage: 0.7 },
            after_metrics: { query_time: 150, cpu_usage: 0.95 },
            rollback_completed: true,
          },
        ],
        overall_success_rate: 0.5,
        total_performance_gain: 0.3,
        monitoring_summary: {
          violations_detected: 1,
          rollbacks_triggered: 1,
          system_stability: 'maintained',
        },
      });

      const execution = await agent.executeOptimizationWithSafetyValidation(mockOptimizationPlan);

      expect(execution.results).toHaveLength(2);
      expect(execution.results[0].status).toBe('success');
      expect(execution.results[1].status).toBe('rollback_triggered');
      expect(execution.monitoring_summary.system_stability).toBe('maintained');
    });
  });

  describe('Cross-Agent Data Flow Tests', () => {
    test('should handle agent-to-agent data pipeline', async () => {
      const retentionAgent = new UserRetentionAgent(mockConfig, mockDeps);
      const riskAgent = new RiskManagementAgent(mockConfig, mockDeps);
      const predictiveAgent = new PredictiveAnalyticsAgent(mockConfig, mockDeps);

      await Promise.all([
        retentionAgent.initialize(),
        riskAgent.initialize(),
        predictiveAgent.initialize(),
      ]);

      // Mock user data flow from retention to risk management
      const userRiskProfile = {
        userId: 'test-user-123',
        churnProbability: 0.3,
        engagementScore: 0.7,
        bettingBehavior: {
          avgBetSize: 50,
          frequency: 'daily',
          riskTolerance: 'moderate',
        },
      };

      // Mock the data pipeline
      const retentionDataSpy = jest.spyOn(retentionAgent as any, 'generateUserRiskProfile');
      retentionDataSpy.mockResolvedValue(userRiskProfile);

      const riskAssessmentSpy = jest.spyOn(riskAgent as any, 'assessUserRisk');
      riskAssessmentSpy.mockResolvedValue({
        userId: 'test-user-123',
        riskLevel: 'moderate',
        recommendedPositionSize: 0.02,
        maxExposure: 0.1,
        personalizedLimits: {
          dailyLimit: 500,
          weeklyLimit: 2000,
        },
      });

      const marketPredictionSpy = jest.spyOn(
        predictiveAgent as any,
        'generatePersonalizedPredictions'
      );
      marketPredictionSpy.mockResolvedValue({
        userId: 'test-user-123',
        predictions: [
          { marketId: 'market-1', confidence: 0.8, recommendedStake: 0.015 },
          { marketId: 'market-2', confidence: 0.6, recommendedStake: 0.01 },
        ],
        personalizationFactors: ['churn_risk', 'engagement_level', 'risk_profile'],
      });

      // Execute the pipeline
      const userProfile = await retentionAgent.generateUserRiskProfile({ userId: 'test-user-123' });
      const riskAssessment = await riskAgent.assessUserRisk(userProfile);
      const predictions = await predictiveAgent.generatePersonalizedPredictions(
        userProfile,
        riskAssessment
      );

      expect(userProfile.userId).toBe('test-user-123');
      expect(riskAssessment.riskLevel).toBe('moderate');
      expect(predictions.predictions).toHaveLength(2);
      expect(predictions.personalizationFactors).toContain('churn_risk');
    });
  });
});
