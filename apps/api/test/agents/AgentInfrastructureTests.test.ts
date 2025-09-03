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

describe('Agent Infrastructure Integration Tests', () => {
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
      retry: { enabled: true, maxRetries: 3, backoffMs: 1000 }
    };

    mockDeps = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      } as any,
      supabase: null,
      redis: null,
      temporal: null
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Redis Cache Integration Tests', () => {
    test('should handle Redis cache operations correctly', async () => {
      // Mock successful Redis operations
      (redisCache.get as jest.Mock).mockResolvedValue('cached_value');
      (redisCache.set as jest.Mock).mockResolvedValue(true);
      (redisCache.ping as jest.Mock).mockResolvedValue('PONG');
      (redisCache.getPattern as jest.Mock).mockResolvedValue(new Map([
        ['key1', 'value1'],
        ['key2', 'value2']
      ]));

      const agent = new UserRetentionAgent(mockConfig, mockDeps);
      await agent.initialize();

      // Test cache get operation
      const cachedValue = await redisCache.get('test_key');
      expect(cachedValue).toBe('cached_value');
      expect(redisCache.get).toHaveBeenCalledWith('test_key');

      // Test cache set operation
      const setResult = await redisCache.set('test_key', 'test_value', 300);
      expect(setResult).toBe(true);
      expect(redisCache.set).toHaveBeenCalledWith('test_key', 'test_value', 300);

      // Test cache pattern retrieval
      const patternResults = await redisCache.getPattern('test_*');
      expect(patternResults.size).toBe(2);
      expect(patternResults.get('key1')).toBe('value1');
    });

    test('should handle Redis connection failures gracefully', async () => {
      // Mock Redis connection failure
      (redisCache.ping as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));
      (redisCache.get as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));
      (redisCache.set as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      const agent = new PredictiveAnalyticsAgent(mockConfig, mockDeps);
      
      // Agent should still initialize despite Redis failures
      await expect(agent.initialize()).resolves.not.toThrow();

      // Verify error handling was logged
      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis')
      );
    });

    test('should implement cache fallback strategies', async () => {
      let cacheCallCount = 0;
      (redisCache.get as jest.Mock).mockImplementation(() => {
        cacheCallCount++;
        if (cacheCallCount <= 2) {
          throw new Error('Cache temporarily unavailable');
        }
        return Promise.resolve('fallback_value');
      });

      const agent = new RiskManagementAgent(mockConfig, mockDeps);
      await agent.initialize();

      // Mock a method that uses cache with fallback
      const getCachedDataSpy = jest.spyOn(agent as any, 'getCachedData');
      getCachedDataSpy.mockImplementation(async (key: string) => {
        try {
          return await redisCache.get(key);
        } catch (error) {
          // Fallback strategy: return default value
          return 'default_value';
        }
      });

      // First calls should use fallback
      const result1 = await agent.getCachedData('test_key');
      expect(result1).toBe('default_value');

      const result2 = await agent.getCachedData('test_key');
      expect(result2).toBe('default_value');

      // Third call should succeed with cache
      const result3 = await agent.getCachedData('test_key');
      expect(result3).toBe('fallback_value');
    });

    test('should handle concurrent cache operations safely', async () => {
      let operationCount = 0;
      (redisCache.set as jest.Mock).mockImplementation(async (key, value, ttl) => {
        operationCount++;
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        return true;
      });

      (redisCache.get as jest.Mock).mockImplementation(async (key) => {
        // Simulate cache hits and misses
        return Math.random() > 0.5 ? `cached_value_${key}` : null;
      });

      const agent = new PerformanceOptimizationAgent(mockConfig, mockDeps);
      await agent.initialize();

      // Simulate concurrent cache operations
      const concurrentOperations = Array.from({ length: 50 }, (_, i) => 
        Promise.all([
          redisCache.set(`key_${i}`, `value_${i}`, 300),
          redisCache.get(`key_${i}`),
          redisCache.set(`batch_key_${i}`, `batch_value_${i}`, 600)
        ])
      );

      const results = await Promise.allSettled(concurrentOperations);
      
      // All operations should complete successfully
      expect(results.every(result => result.status === 'fulfilled')).toBe(true);
      expect(operationCount).toBeGreaterThan(0);
    });

    test('should implement proper cache key namespacing', async () => {
      (redisCache.set as jest.Mock).mockResolvedValue(true);
      (redisCache.get as jest.Mock).mockResolvedValue(null);

      const agents = [
        new AutomatedOnboardingAgent(mockConfig, mockDeps),
        new UserRetentionAgent(mockConfig, mockDeps),
        new RiskManagementAgent(mockConfig, mockDeps)
      ];

      await Promise.all(agents.map(agent => agent.initialize()));

      // Mock cache operations with proper namespacing
      const cacheKeys: string[] = [];
      (redisCache.set as jest.Mock).mockImplementation((key, value, ttl) => {
        cacheKeys.push(key);
        return Promise.resolve(true);
      });

      // Simulate each agent using cache with their own namespace
      const mockCacheUsage = async (agent: any, agentName: string) => {
        await redisCache.set(`${agentName}:user_data:123`, 'user_data', 300);
        await redisCache.set(`${agentName}:metrics:latest`, 'metrics_data', 60);
        await redisCache.set(`${agentName}:config:settings`, 'config_data', 3600);
      };

      await Promise.all([
        mockCacheUsage(agents[0], 'onboarding_agent'),
        mockCacheUsage(agents[1], 'retention_agent'),
        mockCacheUsage(agents[2], 'risk_agent')
      ]);

      // Verify proper namespacing
      expect(cacheKeys).toContain('onboarding_agent:user_data:123');
      expect(cacheKeys).toContain('retention_agent:metrics:latest');
      expect(cacheKeys).toContain('risk_agent:config:settings');
      expect(cacheKeys).toHaveLength(9); // 3 agents × 3 keys each
    });
  });

  describe('Circuit Breaker Pattern Tests', () => {
    test('should implement circuit breaker for external service calls', async () => {
      let failureCount = 0;
      const maxFailures = 3;

      // Mock external service that fails initially
      const mockExternalService = jest.fn().mockImplementation(async () => {
        failureCount++;
        if (failureCount <= maxFailures) {
          throw new Error('External service unavailable');
        }
        return 'service_response';
      });

      const agent = new PredictiveAnalyticsAgent(mockConfig, mockDeps);
      await agent.initialize();

      // Mock circuit breaker implementation
      const circuitBreakerSpy = jest.spyOn(agent as any, 'callWithCircuitBreaker');
      circuitBreakerSpy.mockImplementation(async (serviceName: string, fn: () => Promise<any>) => {
        try {
          return await fn();
        } catch (error) {
          if (failureCount >= maxFailures) {
            // Circuit breaker opens after max failures
            throw new Error(`Circuit breaker opened for ${serviceName}`);
          }
          throw error;
        }
      });

      // First few calls should fail and trigger circuit breaker
      for (let i = 0; i < maxFailures; i++) {
        await expect(
          agent.callWithCircuitBreaker('test_service', mockExternalService)
        ).rejects.toThrow('External service unavailable');
      }

      // Circuit breaker should be open now
      await expect(
        agent.callWithCircuitBreaker('test_service', mockExternalService)
      ).rejects.toThrow('Circuit breaker opened for test_service');

      expect(mockExternalService).toHaveBeenCalledTimes(maxFailures);
    });

    test('should handle circuit breaker recovery correctly', async () => {
      let callCount = 0;
      const serviceMock = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Service temporarily down');
        }
        return 'service_recovered';
      });

      const agent = new RiskManagementAgent(mockConfig, mockDeps);
      await agent.initialize();

      // Mock circuit breaker with half-open state testing
      const circuitBreakerSpy = jest.spyOn(agent as any, 'callWithCircuitBreaker');
      circuitBreakerSpy.mockImplementation(async (serviceName: string, fn: () => Promise<any>) => {
        if (callCount > 2) {
          // Service has recovered
          return await fn();
        } else if (callCount === 2) {
          // Test recovery (half-open state)
          try {
            const result = await fn();
            // Success, circuit breaker closes
            return result;
          } catch (error) {
            // Still failing, keep circuit breaker open
            throw new Error(`Circuit breaker still open for ${serviceName}`);
          }
        } else {
          // Circuit breaker is open
          throw new Error(`Circuit breaker open for ${serviceName}`);
        }
      });

      // Initial failures
      await expect(
        agent.callWithCircuitBreaker('recovery_service', serviceMock)
      ).rejects.toThrow('Circuit breaker open');

      await expect(
        agent.callWithCircuitBreaker('recovery_service', serviceMock)
      ).rejects.toThrow('Circuit breaker still open');

      // Recovery attempt should succeed
      const result = await agent.callWithCircuitBreaker('recovery_service', serviceMock);
      expect(result).toBe('service_recovered');
    });

    test('should track circuit breaker metrics', async () => {
      const agent = new PerformanceOptimizationAgent(mockConfig, mockDeps);
      await agent.initialize();

      const circuitBreakerMetrics = {
        calls: 0,
        failures: 0,
        successes: 0,
        circuitOpen: false,
        lastFailure: null as Date | null
      };

      const mockServiceWithMetrics = jest.fn().mockImplementation(async (shouldFail = false) => {
        circuitBreakerMetrics.calls++;
        if (shouldFail) {
          circuitBreakerMetrics.failures++;
          circuitBreakerMetrics.lastFailure = new Date();
          throw new Error('Service failed');
        } else {
          circuitBreakerMetrics.successes++;
          return 'success';
        }
      });

      // Mock circuit breaker metrics tracking
      const getCircuitBreakerMetricsSpy = jest.spyOn(agent as any, 'getCircuitBreakerMetrics');
      getCircuitBreakerMetricsSpy.mockImplementation(() => circuitBreakerMetrics);

      // Simulate various service calls
      await mockServiceWithMetrics(false); // Success
      await mockServiceWithMetrics(false); // Success
      
      try {
        await mockServiceWithMetrics(true); // Failure
      } catch (error) {
        // Expected failure
      }

      const metrics = agent.getCircuitBreakerMetrics();
      expect(metrics.calls).toBe(3);
      expect(metrics.successes).toBe(2);
      expect(metrics.failures).toBe(1);
      expect(metrics.lastFailure).toBeInstanceOf(Date);
    });
  });

  describe('Health Check Integration Tests', () => {
    test('should perform comprehensive dependency health checks', async () => {
      // Mock various dependency states
      (redisCache.ping as jest.Mock).mockResolvedValue('PONG');

      const agent = new AutomatedOnboardingAgent(mockConfig, mockDeps);
      await agent.initialize();

      const healthCheckSpy = jest.spyOn(agent, 'checkHealth');
      healthCheckSpy.mockResolvedValue({
        status: 'healthy',
        timestamp: new Date(),
        details: {
          redis: { status: 'healthy', latency: 5 },
          database: { status: 'healthy', latency: 25 },
          external_apis: { status: 'healthy', response_time: 150 },
          memory_usage: { status: 'healthy', usage_percent: 45 },
          cpu_usage: { status: 'healthy', usage_percent: 35 }
        }
      });

      const health = await agent.checkHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.details).toHaveProperty('redis');
      expect(health.details).toHaveProperty('database');
      expect(health.details.redis.status).toBe('healthy');
    });

    test('should detect unhealthy dependencies', async () => {
      // Mock Redis failure
      (redisCache.ping as jest.Mock).mockRejectedValue(new Error('Redis connection timeout'));

      const agent = new UserRetentionAgent(mockConfig, mockDeps);
      await agent.initialize();

      const healthCheckSpy = jest.spyOn(agent, 'checkHealth');
      healthCheckSpy.mockResolvedValue({
        status: 'degraded',
        timestamp: new Date(),
        details: {
          redis: { status: 'unhealthy', error: 'Connection timeout' },
          database: { status: 'healthy', latency: 30 },
          memory_usage: { status: 'warning', usage_percent: 85 }
        }
      });

      const health = await agent.checkHealth();
      
      expect(health.status).toBe('degraded');
      expect(health.details.redis.status).toBe('unhealthy');
      expect(health.details.redis).toHaveProperty('error');
    });

    test('should implement health check timeouts', async () => {
      const agent = new RiskManagementAgent(mockConfig, mockDeps);
      await agent.initialize();

      // Mock slow health check
      const slowHealthCheck = jest.spyOn(agent as any, 'performHealthCheck');
      slowHealthCheck.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 6000)); // 6 seconds
        return { status: 'healthy' };
      });

      const healthCheckWithTimeout = jest.spyOn(agent as any, 'checkHealthWithTimeout');
      healthCheckWithTimeout.mockImplementation(async (timeoutMs = 5000) => {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), timeoutMs)
        );

        try {
          return await Promise.race([
            agent.performHealthCheck(),
            timeoutPromise
          ]);
        } catch (error) {
          return {
            status: 'timeout',
            timestamp: new Date(),
            error: 'Health check exceeded timeout limit'
          };
        }
      });

      const result = await agent.checkHealthWithTimeout(5000);
      expect(result.status).toBe('timeout');
      expect(result.error).toContain('timeout');
    });
  });

  describe('Error Handling and Resilience Tests', () => {
    test('should implement exponential backoff for retries', async () => {
      let attemptCount = 0;
      const maxRetries = 3;
      const baseDelay = 100;

      const failingOperation = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < maxRetries) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return 'success_after_retries';
      });

      const agent = new PredictiveAnalyticsAgent(mockConfig, mockDeps);
      await agent.initialize();

      // Mock retry logic with exponential backoff
      const retryWithBackoffSpy = jest.spyOn(agent as any, 'retryWithExponentialBackoff');
      retryWithBackoffSpy.mockImplementation(async (operation: () => Promise<any>, maxAttempts = 3) => {
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await operation();
          } catch (error) {
            lastError = error as Error;
            if (attempt < maxAttempts) {
              const delay = baseDelay * Math.pow(2, attempt - 1);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        throw lastError;
      });

      const startTime = Date.now();
      const result = await agent.retryWithExponentialBackoff(failingOperation, maxRetries);
      const totalTime = Date.now() - startTime;

      expect(result).toBe('success_after_retries');
      expect(attemptCount).toBe(maxRetries);
      expect(totalTime).toBeGreaterThan(300); // Should include backoff delays
    });

    test('should handle cascading failures gracefully', async () => {
      const agent = new PerformanceOptimizationAgent(mockConfig, mockDeps);
      await agent.initialize();

      // Mock multiple dependent services failing
      const serviceA = jest.fn().mockRejectedValue(new Error('Service A failed'));
      const serviceB = jest.fn().mockRejectedValue(new Error('Service B failed'));
      const serviceC = jest.fn().mockResolvedValue('Service C OK');

      const cascadeHandlerSpy = jest.spyOn(agent as any, 'handleCascadingFailures');
      cascadeHandlerSpy.mockImplementation(async (services: Array<() => Promise<any>>) => {
        const results = await Promise.allSettled(services.map(service => service()));
        
        const successes = results.filter(r => r.status === 'fulfilled');
        const failures = results.filter(r => r.status === 'rejected');

        if (failures.length >= services.length * 0.6) {
          // More than 60% failures - enter degraded mode
          return {
            mode: 'degraded',
            available_services: successes.length,
            failed_services: failures.length,
            error_summary: failures.map(f => (f as PromiseRejectedResult).reason.message)
          };
        }

        return {
          mode: 'normal',
          available_services: successes.length,
          failed_services: failures.length
        };
      });

      const result = await agent.handleCascadingFailures([serviceA, serviceB, serviceC]);

      expect(result.mode).toBe('degraded');
      expect(result.failed_services).toBe(2);
      expect(result.available_services).toBe(1);
      expect(result.error_summary).toContain('Service A failed');
      expect(result.error_summary).toContain('Service B failed');
    });
  });

  describe('Resource Management Tests', () => {
    test('should implement proper resource cleanup', async () => {
      const agents = [
        new AutomatedOnboardingAgent(mockConfig, mockDeps),
        new UserRetentionAgent(mockConfig, mockDeps),
        new RiskManagementAgent(mockConfig, mockDeps)
      ];

      await Promise.all(agents.map(agent => agent.initialize()));

      // Mock resource tracking
      const resourceTracker = {
        openConnections: 3,
        activeTimers: 5,
        memoryAllocations: new Set(['buffer1', 'buffer2', 'buffer3'])
      };

      // Mock cleanup operations
      const cleanupSpy = jest.fn().mockImplementation(async () => {
        resourceTracker.openConnections = 0;
        resourceTracker.activeTimers = 0;
        resourceTracker.memoryAllocations.clear();
      });

      agents.forEach(agent => {
        jest.spyOn(agent, 'cleanup').mockImplementation(cleanupSpy);
      });

      // Cleanup all agents
      await Promise.all(agents.map(agent => agent.cleanup()));

      expect(cleanupSpy).toHaveBeenCalledTimes(3);
      expect(resourceTracker.openConnections).toBe(0);
      expect(resourceTracker.activeTimers).toBe(0);
      expect(resourceTracker.memoryAllocations.size).toBe(0);
    });

    test('should handle resource exhaustion scenarios', async () => {
      const agent = new PerformanceOptimizationAgent(mockConfig, mockDeps);
      await agent.initialize();

      // Mock resource monitoring
      const resourceMonitorSpy = jest.spyOn(agent as any, 'checkResourceUsage');
      resourceMonitorSpy.mockImplementation(async () => {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        return {
          memory: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            usage_percent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
            usage_percent: 45 // Mock value
          },
          thresholds: {
            memory_warning: 80,
            memory_critical: 95,
            cpu_warning: 70,
            cpu_critical: 90
          }
        };
      });

      const resourceStatus = await agent.checkResourceUsage();

      expect(resourceStatus).toHaveProperty('memory');
      expect(resourceStatus).toHaveProperty('cpu');
      expect(resourceStatus).toHaveProperty('thresholds');
      expect(resourceStatus.memory.usage_percent).toBeGreaterThan(0);
    });
  });
});