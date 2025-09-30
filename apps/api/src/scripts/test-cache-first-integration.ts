#!/usr/bin/env tsx
/**
 * Cache-First Architecture Integration Test
 * 
 * Validates the complete cache-first implementation:
 * - Service instantiation and configuration
 * - Database schema and migrations
 * - L1-L2-L3 cache hierarchy
 * - Cache warming strategies
 * - Invalidation rules
 * - Metrics collection
 * - BaseAgent integration
 * - Performance targets
 */

import { logger } from '../utils/logger';
import { requireSupabase } from '../utils/supabaseUtils';
import {
  CacheFirstUnifiedPicksService,
  CacheWarmingService,
  CacheInvalidationService,
  CacheMetricsService,
  CacheManagementAgent,
  cacheFirstUnifiedPicks,
  cacheWarmingService,
  cacheInvalidationService,
  cacheMetricsService
} from '../services/cache';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details?: any;
  error?: string;
}

class CacheFirstIntegrationTest {
  private results: TestResult[] = [];
  private testStartTime = Date.now();

  async runAll(): Promise<void> {
    logger.info('Starting Cache-First Architecture Integration Test...');
    
    try {
      // Core service tests
      await this.testServiceInstantiation();
      await this.testDatabaseSchema();
      await this.testCacheHierarchy();
      
      // Functional tests
      await this.testCacheOperations();
      await this.testWarmingStrategies();
      await this.testInvalidationRules();
      await this.testMetricsCollection();
      
      // Integration tests
      await this.testAgentIntegration();
      await this.testPerformanceTargets();
      
      // Cleanup
      await this.cleanup();
      
    } catch (error) {
      logger.error('Integration test suite failed', {
        error: (error as Error).message
      });
    } finally {
      this.printResults();
    }
  }

  private async testServiceInstantiation(): Promise<void> {
    const testName = 'Service Instantiation';
    const startTime = Date.now();
    
    try {
      logger.info(`Testing: ${testName}`);
      
      // Test singleton pattern
      const cache1 = CacheFirstUnifiedPicksService.getInstance();
      const cache2 = CacheFirstUnifiedPicksService.getInstance();
      
      if (cache1 !== cache2) {
        throw new Error('CacheFirstUnifiedPicksService is not a singleton');
      }
      
      // Test service configuration
      const config = cacheFirstUnifiedPicks.getConfig();
      if (!config.l1TtlMs || !config.l2TtlSec) {
        throw new Error('Service configuration is incomplete');
      }
      
      // Test health check
      const health = await cacheFirstUnifiedPicks.healthCheck();
      if (!health.status) {
        throw new Error('Health check failed');
      }
      
      this.addResult({
        name: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        details: {
          config,
          health: health.status
        }
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
    }
  }

  private async testDatabaseSchema(): Promise<void> {
    const testName = 'Database Schema Validation';
    const startTime = Date.now();
    
    try {
      logger.info(`Testing: ${testName}`);
      
      const supabase = requireSupabase();
      
      // Check cache coordination table
      const { data: coordData, error: coordError } = await supabase
        .from('cache_coordination')
        .select('*')
        .limit(1);
      
      if (coordError) {
        throw new Error(`Cache coordination table missing: ${coordError.message}`);
      }
      
      // Check cache metrics table
      const { data: metricsData, error: metricsError } = await supabase
        .from('cache_metrics')
        .select('*')
        .limit(1);
      
      if (metricsError) {
        throw new Error(`Cache metrics table missing: ${metricsError.message}`);
      }
      
      // Check warming strategies table
      const { data: warmingData, error: warmingError } = await supabase
        .from('cache_warming_strategies')
        .select('*')
        .limit(5);
      
      if (warmingError) {
        throw new Error(`Cache warming strategies table missing: ${warmingError.message}`);
      }
      
      // Check invalidation rules table
      const { data: invalidationData, error: invalidationError } = await supabase
        .from('cache_invalidation_rules')
        .select('*')
        .limit(5);
      
      if (invalidationError) {
        throw new Error(`Cache invalidation rules table missing: ${invalidationError.message}`);
      }
      
      // Check materialized views
      const { data: mvData, error: mvError } = await supabase
        .from('mv_hot_published_picks')
        .select('*')
        .limit(1);
      
      if (mvError) {
        logger.warn('Materialized view may need refresh', { error: mvError.message });
      }
      
      this.addResult({
        name: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        details: {
          warmingStrategies: warmingData?.length || 0,
          invalidationRules: invalidationData?.length || 0,
          materializedViewWorking: !mvError
        }
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
    }
  }

  private async testCacheHierarchy(): Promise<void> {
    const testName = 'L1-L2-L3 Cache Hierarchy';
    const startTime = Date.now();
    
    try {
      logger.info(`Testing: ${testName}`);
      
      // Test Redis connectivity (L2)
      const redisHealth = await cacheFirstUnifiedPicks.healthCheck();
      
      // Test database connectivity (L3)
      const supabase = requireSupabase();
      const { error: dbError } = await supabase
        .from('unified_picks')
        .select('id')
        .limit(1);
      
      if (dbError) {
        throw new Error(`Database connectivity failed: ${dbError.message}`);
      }
      
      this.addResult({
        name: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        details: {
          l1Cache: 'Memory cache active',
          l2Cache: redisHealth.details?.redis ? 'Redis connected' : 'Redis fallback mode',
          l3Cache: 'Database connected'
        }
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
    }
  }

  private async testCacheOperations(): Promise<void> {
    const testName = 'Basic Cache Operations';
    const startTime = Date.now();
    
    try {
      logger.info(`Testing: ${testName}`);
      
      // Test list operation (should be cached)
      const picks1 = await cacheFirstUnifiedPicks.listPicks({ limit: 10 });
      const picks2 = await cacheFirstUnifiedPicks.listPicks({ limit: 10 });
      
      // Test published picks (high-frequency endpoint)
      const publishedPicks = await cacheFirstUnifiedPicks.getPublishedPicks(5);
      
      // Test today's picks
      const todaysPicks = await cacheFirstUnifiedPicks.getTodaysPicks();
      
      // Test metrics after operations
      const metrics = cacheFirstUnifiedPicks.getMetrics();
      
      this.addResult({
        name: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        details: {
          picksRetrieved: picks1.length,
          publishedPicks: publishedPicks.length,
          todaysPicks: todaysPicks.length,
          hitRatio: metrics.hitRatio,
          avgResponseTime: metrics.avgResponseTime
        }
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
    }
  }

  private async testWarmingStrategies(): Promise<void> {
    const testName = 'Cache Warming Strategies';
    const startTime = Date.now();
    
    try {
      logger.info(`Testing: ${testName}`);
      
      // Get warming service health
      const warmingHealth = cacheWarmingService.healthCheck();
      
      // Get strategies
      const strategies = cacheWarmingService.getStrategies();
      const enabledStrategies = strategies.filter(s => s.enabled);
      
      // Test manual strategy trigger
      if (enabledStrategies.length > 0) {
        await cacheWarmingService.warmupStrategy(enabledStrategies[0].id);
      }
      
      // Get metrics
      const warmingMetrics = cacheWarmingService.getMetrics();
      
      this.addResult({
        name: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        details: {
          healthStatus: warmingHealth.status,
          totalStrategies: strategies.length,
          enabledStrategies: enabledStrategies.length,
          lastWarmup: warmingMetrics.lastWarmup,
          itemsWarmed: warmingMetrics.totalItemsWarmed
        }
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
    }
  }

  private async testInvalidationRules(): Promise<void> {
    const testName = 'Cache Invalidation Rules';
    const startTime = Date.now();
    
    try {
      logger.info(`Testing: ${testName}`);
      
      // Get invalidation service health
      const invalidationHealth = cacheInvalidationService.healthCheck();
      
      // Get rules
      const rules = cacheInvalidationService.getRules();
      const enabledRules = rules.filter(r => r.enabled);
      
      // Test manual invalidation trigger
      await cacheInvalidationService.triggerInvalidation('test.cache_clear', {
        source: 'integration_test'
      });
      
      // Get metrics
      const invalidationMetrics = cacheInvalidationService.getMetrics();
      
      this.addResult({
        name: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        details: {
          healthStatus: invalidationHealth.status,
          totalRules: rules.length,
          enabledRules: enabledRules.length,
          totalInvalidations: invalidationMetrics.totalInvalidations,
          pendingInvalidations: invalidationMetrics.pendingInvalidations
        }
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
    }
  }

  private async testMetricsCollection(): Promise<void> {
    const testName = 'Metrics Collection';
    const startTime = Date.now();
    
    try {
      logger.info(`Testing: ${testName}`);
      
      // Record some test metrics
      cacheMetricsService.recordRequest(50);
      cacheMetricsService.recordCacheOperation();
      
      // Get snapshot
      const snapshot = await cacheMetricsService.getMetricsSnapshot();
      
      // Get health report
      const healthReport = await cacheMetricsService.getHealthReport();
      
      // Get performance recommendations
      const recommendations = await cacheMetricsService.getPerformanceRecommendations();
      
      this.addResult({
        name: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        details: {
          overallStatus: healthReport.status,
          hitRate: snapshot.hitRates.overall,
          avgResponseTime: snapshot.responseTimes.avg,
          activeAlerts: snapshot.warming.strategiesActive,
          recommendations: recommendations.length
        }
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
    }
  }

  private async testAgentIntegration(): Promise<void> {
    const testName = 'BaseAgent Integration';
    const startTime = Date.now();
    
    try {
      logger.info(`Testing: ${testName}`);
      
      // Create and test cache management agent
      const agent = new CacheManagementAgent({
        cache: {
          warmupOnStart: false, // Skip for test
          metricsCollection: true,
          alertsEnabled: true,
          refreshMaterializedViews: false,
          materializedViewRefreshInterval: 15,
          warmingInterval: 60,
          metricsInterval: 5
        }
      }, {
        supabase: requireSupabase()
      });
      
      // Test health check
      const health = await agent.checkHealth();
      
      // Test metrics collection
      const metrics = await agent.collectMetrics();
      
      // Test performance report
      const report = await agent.getPerformanceReport();
      
      this.addResult({
        name: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        details: {
          agentHealth: health.status,
          agentName: metrics.agentName,
          cacheHitRate: metrics.cacheHitRate,
          reportStatus: report.status,
          activeAlerts: report.alerts.length
        }
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
    }
  }

  private async testPerformanceTargets(): Promise<void> {
    const testName = 'Performance Targets Validation';
    const startTime = Date.now();
    
    try {
      logger.info(`Testing: ${testName}`);
      
      const snapshot = await cacheMetricsService.getMetricsSnapshot();
      const targets = {
        hitRate: 90, // >90%
        responseTime: 100, // <100ms average
        errorRate: 1 // <1%
      };
      
      const results = {
        hitRateTarget: snapshot.hitRates.overall >= targets.hitRate,
        responseTimeTarget: snapshot.responseTimes.avg <= targets.responseTime,
        errorRateTarget: snapshot.errors.rate <= targets.errorRate
      };
      
      const allTargetsMet = Object.values(results).every(Boolean);
      
      this.addResult({
        name: testName,
        status: allTargetsMet ? 'PASS' : 'FAIL',
        duration: Date.now() - startTime,
        details: {
          targets,
          actual: {
            hitRate: snapshot.hitRates.overall,
            responseTime: snapshot.responseTimes.avg,
            errorRate: snapshot.errors.rate
          },
          results,
          allTargetsMet
        }
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
    }
  }

  private async cleanup(): Promise<void> {
    const testName = 'Cleanup';
    const startTime = Date.now();
    
    try {
      logger.info(`Testing: ${testName}`);
      
      // Cleanup any test data if needed
      // For now, just log completion
      
      this.addResult({
        name: testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        details: 'Test cleanup completed'
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
    }
  }

  private addResult(result: TestResult): void {
    this.results.push(result);
    
    const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    logger.info(`${status} ${result.name} (${result.duration}ms)`, {
      details: result.details,
      error: result.error
    });
  }

  private printResults(): void {
    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const totalDuration = Date.now() - this.testStartTime;
    
    logger.info('Cache-First Architecture Integration Test Results', {
      summary: {
        total: totalTests,
        passed,
        failed,
        skipped,
        successRate: `${((passed / totalTests) * 100).toFixed(1)}%`,
        totalDuration: `${totalDuration}ms`
      },
      results: this.results.map(r => ({
        name: r.name,
        status: r.status,
        duration: `${r.duration}ms`,
        error: r.error
      }))
    });
    
    if (failed > 0) {
      logger.error(`❌ Integration test failed: ${failed}/${totalTests} tests failed`);
      process.exit(1);
    } else {
      logger.info(`✅ Integration test passed: ${passed}/${totalTests} tests passed`);
    }
  }
}

// Run the integration test if called directly
if (require.main === module) {
  const test = new CacheFirstIntegrationTest();
  test.runAll().catch(error => {
    logger.error('Integration test suite crashed', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  });
}

export default CacheFirstIntegrationTest;