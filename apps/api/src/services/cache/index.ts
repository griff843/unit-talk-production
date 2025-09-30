/**
 * Cache-First Architecture Services
 * 
 * Comprehensive caching solution for Unit Talk's unified_picks system
 * Provides L1 (Memory) → L2 (Redis) → L3 (Database) hierarchy with:
 * - >90% cache hit rate targets
 * - <100ms response time goals
 * - Intelligent warming and invalidation
 * - Real-time metrics and monitoring
 * - BaseAgent integration
 */

// Core cache service with L1-L2-L3 hierarchy
export { 
  CacheFirstUnifiedPicksService,
  cacheFirstUnifiedPicks,
  type CacheMetrics,
  type CacheConfig,
  type CacheKey
} from '../CacheFirstUnifiedPicksService';

// Cache warming with intelligent strategies
export {
  CacheWarmingService,
  cacheWarmingService,
  type WarmupStrategy,
  type WarmupMetrics
} from '../CacheWarmingService';

// Cache invalidation with rule-based triggers
export {
  CacheInvalidationService,
  cacheInvalidationService,
  type InvalidationRule,
  type InvalidationScope,
  type InvalidationTrigger,
  type InvalidationCondition,
  type InvalidationMetrics,
  type InvalidationEvent
} from '../CacheInvalidationService';

// Comprehensive metrics and monitoring
export {
  CacheMetricsService,
  cacheMetricsService,
  type CacheMetricsSnapshot,
  type PerformanceAlert,
  type CacheTrend
} from '../CacheMetricsService';

// Redis service foundation
export {
  ProductionRedisService,
  productionRedis
} from '../productionRedis';

// Agent integration
export {
  CacheManagementAgent,
  type CacheManagementAgentConfig
} from '../../agents/CacheManagementAgent';

/**
 * Quick Start Guide:
 * 
 * 1. Basic Usage:
 *    import { cacheFirstUnifiedPicks } from '@services/cache';
 *    const pick = await cacheFirstUnifiedPicks.getPick('pick-id');
 * 
 * 2. With Agent (recommended for production):
 *    import { CacheManagementAgent } from '@services/cache';
 *    const agent = new CacheManagementAgent(config, deps);
 *    await agent.start();
 * 
 * 3. Manual Warming:
 *    import { cacheWarmingService } from '@services/cache';
 *    await cacheWarmingService.warmupAll();
 * 
 * 4. Metrics and Health:
 *    import { cacheMetricsService } from '@services/cache';
 *    const report = await cacheMetricsService.getHealthReport();
 * 
 * 5. Custom Invalidation:
 *    import { cacheInvalidationService } from '@services/cache';
 *    await cacheInvalidationService.triggerInvalidation('custom_event', data);
 */

/**
 * Performance Targets:
 * - Cache Hit Rate: >90%
 * - Response Time: <100ms (average), <250ms (p95)
 * - Availability: >99.9%
 * - Memory Usage: <85% of allocated
 * - Error Rate: <1%
 */

/**
 * Architecture Components:
 * 
 * L1 Cache (Memory):
 * - 30 second TTL
 * - LRU eviction
 * - 1000 key limit
 * - Instant access
 * 
 * L2 Cache (Redis):
 * - 5 minute TTL
 * - Distributed
 * - Persistent
 * - Circuit breaker protection
 * 
 * L3 Cache (Database):
 * - Source of truth
 * - Materialized views
 * - Query optimization
 * - Full-text search indexes
 */

/**
 * Database Schema Extensions:
 * - cache_coordination: Cross-layer coordination
 * - cache_metrics: Performance aggregation
 * - cache_warming_strategies: Intelligent preloading
 * - cache_invalidation_rules: Rule-based clearing
 * - Materialized views for hot data
 */

/**
 * Monitoring & Alerting:
 * - Real-time performance metrics
 * - Automated performance alerts
 * - Trend analysis and recommendations
 * - Integration with BaseAgent health checks
 * - Grafana/Prometheus compatibility
 */