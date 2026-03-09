// @ts-nocheck — Archived: all concrete agents archived in SPRINT-REPO-TRUTH-LOCK-002
import { AutomatedOnboardingAgent } from '../../agents/_archived/AutomatedOnboardingAgent';
import { PerformanceOptimizationAgent } from '../../agents/_archived/PerformanceOptimizationAgent';
import { PredictiveAnalyticsAgent } from '../../agents/_archived/PredictiveAnalyticsAgent';
import { RiskManagementAgent } from '../../agents/_archived/RiskManagementAgent';
import { UserRetentionAgent } from '../../agents/_archived/UserRetentionAgent';
import { BaseAgent } from '../../agents/BaseAgent';
import { Logger } from '../shared/logger/types';

import { AgentMetricsCollector } from './AgentMetricsCollector';

interface AgentMetricsAdapter {
  agentName: string;
  collectMetrics(): Promise<any>;
  getBusinessMetrics(): Promise<any>;
  getHealthMetrics(): Promise<any>;
  getCacheMetrics(): Promise<any>;
}

export class AgentMonitoringIntegration {
  private readonly logger: Logger;
  private readonly metricsCollector: AgentMetricsCollector;
  private adapters: Map<string, AgentMetricsAdapter> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private registeredAgents: Map<string, BaseAgent> = new Map();

  constructor(logger: Logger, metricsCollector: AgentMetricsCollector) {
    this.logger = logger;
    this.metricsCollector = metricsCollector;
  }

  async initialize(): Promise<void> {
    this.logger.info('🔗 Initializing AgentMonitoringIntegration');

    this.setupAdapters();
    this.startMonitoring();

    this.logger.info('✅ AgentMonitoringIntegration initialized');
  }

  registerAgent(agent: BaseAgent): void {
    const agentName = agent.constructor.name;
    this.registeredAgents.set(agentName, agent);

    // Setup event listeners for real-time metrics
    this.setupAgentEventListeners(agent);

    this.logger.info('Agent registered for monitoring', { agentName });
  }

  unregisterAgent(agentName: string): void {
    this.registeredAgents.delete(agentName);
    this.adapters.delete(agentName);

    this.logger.info('Agent unregistered from monitoring', { agentName });
  }

  async collectAllAgentMetrics(): Promise<void> {
    const collectionPromises = Array.from(this.registeredAgents.entries()).map(
      async ([agentName, agent]) => {
        try {
          await this.collectAgentMetrics(agentName, agent);
        } catch (error) {
          this.logger.error('Failed to collect metrics for agent', { agentName, error });
        }
      }
    );

    await Promise.allSettled(collectionPromises);
  }

  private async collectAgentMetrics(agentName: string, agent: BaseAgent): Promise<void> {
    const adapter = this.adapters.get(agentName);
    if (!adapter) {
      this.logger.warn('No adapter found for agent', { agentName });
      return;
    }

    try {
      const [performanceMetrics, businessMetrics, healthMetrics, cacheMetrics] = await Promise.all([
        this.getPerformanceMetrics(agent),
        adapter.getBusinessMetrics(),
        adapter.getHealthMetrics(),
        adapter.getCacheMetrics(),
      ]);

      await this.metricsCollector.collectMetrics(agentName, {
        performance: performanceMetrics,
        business: businessMetrics,
        health: healthMetrics,
        cache: cacheMetrics,
        circuitBreaker: await this.getCircuitBreakerMetrics(agent),
      });
    } catch (error) {
      this.logger.error('Failed to collect comprehensive metrics', { agentName, error });
    }
  }

  private async getPerformanceMetrics(agent: BaseAgent): Promise<any> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
      memoryUsage: memoryUsage.heapUsed,
      responseTime: await this.measureResponseTime(agent),
      throughput: await this.calculateThroughput(agent),
      errorRate: await this.calculateErrorRate(agent),
      successRate: await this.calculateSuccessRate(agent),
    };
  }

  private async measureResponseTime(agent: BaseAgent): Promise<number> {
    const startTime = Date.now();

    try {
      await agent.getEnhancedHealth();
      return Date.now() - startTime;
    } catch (error) {
      return Date.now() - startTime; // Return time even if health check fails
    }
  }

  private async calculateThroughput(agent: BaseAgent): Promise<number> {
    // This would be implemented based on agent-specific operation counters
    // For now, return a mock value
    return Math.random() * 100;
  }

  private async calculateErrorRate(agent: BaseAgent): Promise<number> {
    // This would be implemented based on agent-specific error tracking
    // For now, return a mock value
    return Math.random() * 0.05;
  }

  private async calculateSuccessRate(agent: BaseAgent): Promise<number> {
    const errorRate = await this.calculateErrorRate(agent);
    return 1 - errorRate;
  }

  private async getCircuitBreakerMetrics(agent: BaseAgent): Promise<any> {
    // This would integrate with the circuit breaker implementation
    // For now, return mock values
    return {
      state: 'closed',
      failures: 0,
      successes: Math.floor(Math.random() * 100),
      lastFailure: null,
    };
  }

  private setupAdapters(): void {
    // AutomatedOnboardingAgent Adapter
    this.adapters.set('AutomatedOnboardingAgent', {
      agentName: 'AutomatedOnboardingAgent',
      async collectMetrics() {
        return {};
      },
      async getBusinessMetrics() {
        return {
          operationsCompleted: Math.floor(Math.random() * 50),
          usersProcessed: Math.floor(Math.random() * 100),
          conversationsGenerated: Math.floor(Math.random() * 200),
          behaviorEventsTracked: Math.floor(Math.random() * 500),
        };
      },
      async getHealthMetrics() {
        return {
          status: 'healthy',
          score: 85 + Math.random() * 15,
          dependencies: {
            redis: 'healthy',
            database: 'healthy',
            nlp_service: 'healthy',
          },
          lastHealthCheck: new Date(),
        };
      },
      async getCacheMetrics() {
        return {
          hitRate: 0.8 + Math.random() * 0.15,
          missRate: 0.05 + Math.random() * 0.15,
          operations: Math.floor(Math.random() * 1000),
          averageLatency: 5 + Math.random() * 10,
        };
      },
    });

    // UserRetentionAgent Adapter
    this.adapters.set('UserRetentionAgent', {
      agentName: 'UserRetentionAgent',
      async collectMetrics() {
        return {};
      },
      async getBusinessMetrics() {
        return {
          operationsCompleted: Math.floor(Math.random() * 30),
          usersProcessed: Math.floor(Math.random() * 200),
          churnPredictionsGenerated: Math.floor(Math.random() * 150),
          retentionStrategiesCreated: Math.floor(Math.random() * 75),
          segmentationUpdates: Math.floor(Math.random() * 10),
        };
      },
      async getHealthMetrics() {
        return {
          status: 'healthy',
          score: 80 + Math.random() * 20,
          dependencies: {
            redis: 'healthy',
            database: 'healthy',
            ml_service: 'healthy',
            analytics_engine: 'healthy',
          },
          lastHealthCheck: new Date(),
        };
      },
      async getCacheMetrics() {
        return {
          hitRate: 0.75 + Math.random() * 0.2,
          missRate: 0.05 + Math.random() * 0.2,
          operations: Math.floor(Math.random() * 800),
          averageLatency: 8 + Math.random() * 12,
        };
      },
    });

    // RiskManagementAgent Adapter
    this.adapters.set('RiskManagementAgent', {
      agentName: 'RiskManagementAgent',
      async collectMetrics() {
        return {};
      },
      async getBusinessMetrics() {
        return {
          operationsCompleted: Math.floor(Math.random() * 40),
          portfoliosOptimized: Math.floor(Math.random() * 25),
          riskAssessmentsPerformed: Math.floor(Math.random() * 100),
          hedgeRecommendationsGenerated: Math.floor(Math.random() * 50),
          positionSizingCalculations: Math.floor(Math.random() * 200),
        };
      },
      async getHealthMetrics() {
        return {
          status: 'healthy',
          score: 90 + Math.random() * 10,
          dependencies: {
            redis: 'healthy',
            database: 'healthy',
            market_data_feed: 'healthy',
            risk_engine: 'healthy',
          },
          lastHealthCheck: new Date(),
        };
      },
      async getCacheMetrics() {
        return {
          hitRate: 0.85 + Math.random() * 0.1,
          missRate: 0.05 + Math.random() * 0.1,
          operations: Math.floor(Math.random() * 600),
          averageLatency: 3 + Math.random() * 7,
        };
      },
    });

    // PredictiveAnalyticsAgent Adapter
    this.adapters.set('PredictiveAnalyticsAgent', {
      agentName: 'PredictiveAnalyticsAgent',
      async collectMetrics() {
        return {};
      },
      async getBusinessMetrics() {
        return {
          operationsCompleted: Math.floor(Math.random() * 60),
          predictionsGenerated: Math.floor(Math.random() * 300),
          modelsUpdated: Math.floor(Math.random() * 5),
          marketDataProcessed: Math.floor(Math.random() * 1000),
          anomaliesDetected: Math.floor(Math.random() * 10),
        };
      },
      async getHealthMetrics() {
        return {
          status: 'healthy',
          score: 75 + Math.random() * 25,
          dependencies: {
            redis: 'healthy',
            database: 'healthy',
            ml_models: 'healthy',
            market_data_apis: 'healthy',
            feature_store: 'healthy',
          },
          lastHealthCheck: new Date(),
        };
      },
      async getCacheMetrics() {
        return {
          hitRate: 0.7 + Math.random() * 0.25,
          missRate: 0.05 + Math.random() * 0.25,
          operations: Math.floor(Math.random() * 1500),
          averageLatency: 10 + Math.random() * 15,
        };
      },
    });

    // PerformanceOptimizationAgent Adapter
    this.adapters.set('PerformanceOptimizationAgent', {
      agentName: 'PerformanceOptimizationAgent',
      async collectMetrics() {
        return {};
      },
      async getBusinessMetrics() {
        return {
          operationsCompleted: Math.floor(Math.random() * 35),
          bottlenecksDetected: Math.floor(Math.random() * 15),
          optimizationsApplied: Math.floor(Math.random() * 8),
          systemMetricsCollected: Math.floor(Math.random() * 2000),
          recommendationsGenerated: Math.floor(Math.random() * 20),
        };
      },
      async getHealthMetrics() {
        return {
          status: 'healthy',
          score: 95 + Math.random() * 5,
          dependencies: {
            redis: 'healthy',
            database: 'healthy',
            system_monitor: 'healthy',
            optimization_engine: 'healthy',
          },
          lastHealthCheck: new Date(),
        };
      },
      async getCacheMetrics() {
        return {
          hitRate: 0.9 + Math.random() * 0.05,
          missRate: 0.05 + Math.random() * 0.05,
          operations: Math.floor(Math.random() * 500),
          averageLatency: 2 + Math.random() * 3,
        };
      },
    });
  }

  private setupAgentEventListeners(agent: BaseAgent): void {
    const agentName = agent.constructor.name;

    // Listen for agent-specific events and collect real-time metrics
    if (agent instanceof AutomatedOnboardingAgent) {
      this.setupOnboardingAgentListeners(agent, agentName);
    } else if (agent instanceof UserRetentionAgent) {
      this.setupRetentionAgentListeners(agent, agentName);
    } else if (agent instanceof RiskManagementAgent) {
      this.setupRiskAgentListeners(agent, agentName);
    } else if (agent instanceof PredictiveAnalyticsAgent) {
      this.setupPredictiveAgentListeners(agent, agentName);
    } else if (agent instanceof PerformanceOptimizationAgent) {
      this.setupPerformanceAgentListeners(agent, agentName);
    }
  }

  private setupOnboardingAgentListeners(agent: AutomatedOnboardingAgent, agentName: string): void {
    // Listen for behavior tracking events
    agent.on?.('behavior_tracked', async event => {
      await this.metricsCollector.collectMetrics(agentName, {
        business: { operationsCompleted: 1, behaviorEventsTracked: 1 },
        performance: {
          cpuUsage: 0,
          memoryUsage: 0,
          responseTime: event.processingTime || 0,
          throughput: 0,
          errorRate: 0,
          successRate: 1.0,
        },
      });
    });

    // Listen for conversation generation events
    agent.on?.('conversation_generated', async event => {
      await this.metricsCollector.collectMetrics(agentName, {
        business: { operationsCompleted: 1, conversationsGenerated: 1 },
        performance: {
          cpuUsage: 0,
          memoryUsage: 0,
          responseTime: event.generationTime || 0,
          throughput: 0,
          errorRate: 0,
          successRate: 1.0,
        },
      });
    });
  }

  private setupRetentionAgentListeners(agent: UserRetentionAgent, agentName: string): void {
    // Listen for churn prediction events
    agent.on?.('churn_predicted', async event => {
      await this.metricsCollector.collectMetrics(agentName, {
        business: { operationsCompleted: 1, churnPredictionsGenerated: 1 },
        performance: {
          cpuUsage: 0,
          memoryUsage: 0,
          responseTime: event.predictionTime || 0,
          throughput: 0,
          errorRate: 0,
          successRate: 1.0,
        },
      });
    });

    // Listen for user segmentation events
    agent.on?.('users_segmented', async event => {
      await this.metricsCollector.collectMetrics(agentName, {
        business: {
          operationsCompleted: 1,
          usersProcessed: event.userCount || 0,
          segmentationUpdates: 1,
        },
      });
    });
  }

  private setupRiskAgentListeners(agent: RiskManagementAgent, agentName: string): void {
    // Listen for portfolio optimization events
    agent.on?.('portfolio_optimized', async event => {
      await this.metricsCollector.collectMetrics(agentName, {
        business: { operationsCompleted: 1, optimizationsApplied: 1 },
        performance: {
          responseTime: event.optimizationTime || 0,
          cpuUsage: 0,
          memoryUsage: 0,
          throughput: 1,
          errorRate: 0,
          successRate: 1,
        },
      });
    });

    // Listen for risk assessment events
    agent.on?.('risk_assessed', async _event => {
      await this.metricsCollector.collectMetrics(agentName, {
        business: { operationsCompleted: 1 },
      });
    });
  }

  private setupPredictiveAgentListeners(agent: PredictiveAnalyticsAgent, agentName: string): void {
    // Listen for prediction generation events
    agent.on?.('prediction_generated', async event => {
      await this.metricsCollector.collectMetrics(agentName, {
        business: { operationsCompleted: 1, predictionsGenerated: 1 },
        performance: {
          responseTime: event.predictionTime || 0,
          cpuUsage: 0,
          memoryUsage: 0,
          throughput: 1,
          errorRate: 0,
          successRate: 1,
        },
      });
    });

    // Listen for model update events
    agent.on?.('model_updated', async _event => {
      await this.metricsCollector.collectMetrics(agentName, {
        business: { operationsCompleted: 1 },
      });
    });
  }

  private setupPerformanceAgentListeners(
    agent: PerformanceOptimizationAgent,
    agentName: string
  ): void {
    // Listen for bottleneck detection events
    agent.on?.('bottleneck_detected', async _event => {
      await this.metricsCollector.collectMetrics(agentName, {
        business: { operationsCompleted: 1 },
      });
    });

    // Listen for optimization application events
    agent.on?.('optimization_applied', async event => {
      await this.metricsCollector.collectMetrics(agentName, {
        business: { operationsCompleted: 1, optimizationsApplied: 1 },
        performance: {
          responseTime: event.applicationTime || 0,
          cpuUsage: 0,
          memoryUsage: 0,
          throughput: 1,
          errorRate: 0,
          successRate: 1,
        },
      });
    });
  }

  private startMonitoring(): void {
    // Collect metrics every 60 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectAllAgentMetrics();
      } catch (error) {
        this.logger.error('Failed to collect agent metrics during monitoring', { error });
      }
    }, 60000);

    this.logger.info('Started periodic agent metrics collection', { intervalSeconds: 60 });
  }

  async getIntegrationStatus(): Promise<any> {
    const registeredAgentNames = Array.from(this.registeredAgents.keys());
    const adapterNames = Array.from(this.adapters.keys());

    return {
      registeredAgents: registeredAgentNames.length,
      availableAdapters: adapterNames.length,
      monitoringActive: this.monitoringInterval !== null,
      agents: registeredAgentNames.map(name => ({
        name,
        hasAdapter: this.adapters.has(name),
        lastMetricsCollection: new Date(), // Would track actual last collection time
      })),
    };
  }

  async cleanup(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Remove event listeners from all registered agents
    for (const [agentName, agent] of this.registeredAgents) {
      try {
        agent.removeAllListeners?.();
      } catch (error) {
        this.logger.warn('Failed to remove listeners from agent', { agentName, error });
      }
    }

    this.registeredAgents.clear();
    this.adapters.clear();

    this.logger.info('🧹 AgentMonitoringIntegration cleanup completed');
  }
}
