import { CacheFirstUnifiedPicksService } from './CacheFirstUnifiedPicksService';
import { ProductionRedisService } from './productionRedis';
import { requireSupabase } from '../utils/supabaseUtils';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface InvalidationRule {
  id: string;
  name: string;
  enabled: boolean;
  triggers: InvalidationTrigger[];
  scope: InvalidationScope;
  priority: number; // 1-10, higher = more important
  delay?: number; // Delay in ms before invalidation
  conditions?: InvalidationCondition[];
}

export interface InvalidationTrigger {
  type: 'database_change' | 'api_call' | 'time_based' | 'external_event';
  event: string;
  table?: string;
  operation?: 'INSERT' | 'UPDATE' | 'DELETE';
  columns?: string[];
}

export interface InvalidationScope {
  type: 'specific' | 'pattern' | 'cascade' | 'global';
  target: string | string[];
  cascade?: {
    related: string[];
    maxDepth: number;
  };
}

export interface InvalidationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'in';
  value: any;
}

export interface InvalidationMetrics {
  totalInvalidations: number;
  byRule: Map<string, number>;
  byTrigger: Map<string, number>;
  byScope: Map<string, number>;
  averageProcessingTime: number;
  errors: number;
  lastInvalidation: Date;
  pendingInvalidations: number;
}

export interface InvalidationEvent {
  ruleId: string;
  trigger: string;
  scope: string;
  timestamp: Date;
  processingTime: number;
  success: boolean;
  error?: string;
}

/**
 * Cache Invalidation Service
 * Manages intelligent cache invalidation patterns to maintain data consistency
 * Supports rule-based invalidation, cascading updates, and event-driven clearing
 */
export class CacheInvalidationService extends EventEmitter {
  private static instance: CacheInvalidationService;
  private cacheService: CacheFirstUnifiedPicksService;
  private redis: ProductionRedisService;
  
  private rules: Map<string, InvalidationRule> = new Map();
  private metrics: InvalidationMetrics = {
    totalInvalidations: 0,
    byRule: new Map(),
    byTrigger: new Map(),
    byScope: new Map(),
    averageProcessingTime: 0,
    errors: 0,
    lastInvalidation: new Date(),
    pendingInvalidations: 0
  };
  
  private invalidationQueue: Array<{
    ruleId: string;
    data: any;
    scheduledTime: number;
  }> = [];
  
  private processingTimes: number[] = [];
  private isProcessing = false;

  private constructor() {
    super();
    this.cacheService = CacheFirstUnifiedPicksService.getInstance();
    this.redis = ProductionRedisService.getInstance();
    
    this.initializeRules();
    this.startInvalidationProcessor();
    this.setupDatabaseTriggers();
    
    logger.info('CacheInvalidationService initialized', {
      rulesCount: this.rules.size
    });
  }

  public static getInstance(): CacheInvalidationService {
    if (!CacheInvalidationService.instance) {
      CacheInvalidationService.instance = new CacheInvalidationService();
    }
    return CacheInvalidationService.instance;
  }

  /**
   * Initialize default invalidation rules
   */
  private initializeRules(): void {
    // Rule: Invalidate pick cache when pick is updated
    this.rules.set('pick_updated', {
      id: 'pick_updated',
      name: 'Pick Updated',
      enabled: true,
      triggers: [{
        type: 'database_change',
        event: 'unified_picks.updated',
        table: 'unified_picks',
        operation: 'UPDATE'
      }],
      scope: {
        type: 'cascade',
        target: 'unified_picks:pick:{id}',
        cascade: {
          related: [
            'unified_picks:picks_list:*',
            'unified_picks:user_picks:{userId}',
            'unified_picks:published_picks:*',
            'unified_picks:daily_picks:*'
          ],
          maxDepth: 2
        }
      },
      priority: 9
    });
    
    // Rule: Invalidate when pick is published
    this.rules.set('pick_published', {
      id: 'pick_published',
      name: 'Pick Published',
      enabled: true,
      triggers: [{
        type: 'database_change',
        event: 'unified_picks.published',
        table: 'unified_picks',
        operation: 'UPDATE',
        columns: ['published']
      }],
      scope: {
        type: 'cascade',
        target: 'unified_picks:published_picks:*',
        cascade: {
          related: [
            'unified_picks:picks_list:*',
            'unified_picks:daily_picks:*',
            'unified_picks:user_picks:{userId}'
          ],
          maxDepth: 2
        }
      },
      priority: 10,
      conditions: [{
        field: 'published',
        operator: 'equals',
        value: true
      }]
    });
    
    // Rule: Invalidate user-specific caches when user updates
    this.rules.set('user_updated', {
      id: 'user_updated',
      name: 'User Updated',
      enabled: true,
      triggers: [{
        type: 'database_change',
        event: 'users.updated',
        table: 'users',
        operation: 'UPDATE'
      }],
      scope: {
        type: 'pattern',
        target: 'unified_picks:user_picks:{id}:*'
      },
      priority: 6
    });
    
    // Rule: Time-based invalidation for daily picks
    this.rules.set('daily_refresh', {
      id: 'daily_refresh',
      name: 'Daily Cache Refresh',
      enabled: true,
      triggers: [{
        type: 'time_based',
        event: 'daily_refresh'
      }],
      scope: {
        type: 'pattern',
        target: 'unified_picks:daily_picks:*'
      },
      priority: 5
    });
    
    // Rule: Invalidate on external odds updates
    this.rules.set('odds_updated', {
      id: 'odds_updated',
      name: 'Odds Updated',
      enabled: true,
      triggers: [{
        type: 'external_event',
        event: 'odds.updated'
      }],
      scope: {
        type: 'cascade',
        target: 'unified_picks:*',
        cascade: {
          related: [
            'cache:book_quotes:*',
            'cache:game_results:*'
          ],
          maxDepth: 1
        }
      },
      priority: 8,
      delay: 1000 // 1 second delay to batch updates
    });
    
    // Rule: Emergency global invalidation
    this.rules.set('emergency_clear', {
      id: 'emergency_clear',
      name: 'Emergency Clear All',
      enabled: true,
      triggers: [{
        type: 'api_call',
        event: 'emergency.clear_cache'
      }],
      scope: {
        type: 'global',
        target: '*'
      },
      priority: 10
    });
    
    // Rule: Invalidate on pick status changes (win/loss)
    this.rules.set('pick_settled', {
      id: 'pick_settled',
      name: 'Pick Settled',
      enabled: true,
      triggers: [{
        type: 'database_change',
        event: 'unified_picks.settled',
        table: 'unified_picks',
        operation: 'UPDATE',
        columns: ['status', 'settled_at']
      }],
      scope: {
        type: 'cascade',
        target: 'unified_picks:pick:{id}',
        cascade: {
          related: [
            'unified_picks:user_picks:{userId}',
            'unified_picks:picks_list:*'
          ],
          maxDepth: 1
        }
      },
      priority: 7,
      conditions: [{
        field: 'status',
        operator: 'in',
        value: ['won', 'lost', 'push', 'void']
      }]
    });
  }

  /**
   * Set up database triggers for real-time invalidation
   */
  private async setupDatabaseTriggers(): Promise<void> {
    try {
      // This would set up PostgreSQL triggers/notifications
      // For now, we'll use a polling mechanism or webhook approach
      logger.info('Database triggers setup initiated');
      
      // Start polling for database changes (in a real implementation,
      // this would be replaced with proper database notifications)
      this.startDatabaseChangePolling();
      
    } catch (error) {
      logger.error('Failed to setup database triggers', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Start database change polling (fallback mechanism)
   */
  private startDatabaseChangePolling(): void {
    // Poll every 30 seconds for changes (in production, use proper triggers)
    setInterval(async () => {
      await this.checkForDatabaseChanges();
    }, 30 * 1000);
  }

  /**
   * Check for database changes that should trigger invalidation
   */
  private async checkForDatabaseChanges(): Promise<void> {
    try {
      const supabase = requireSupabase();
      
      // Check for recent updates in unified_picks
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: recentUpdates, error } = await supabase
        .from('unified_picks')
        .select('id, user_id, published, status, updated_at')
        .gte('updated_at', fiveMinutesAgo);
      
      if (error) throw error;
      
      if (recentUpdates?.length) {
        logger.debug('Detected database changes', { 
          count: recentUpdates.length 
        });
        
        for (const update of recentUpdates) {
          await this.processInvalidationTrigger('database_change', {
            table: 'unified_picks',
            operation: 'UPDATE',
            record: update
          });
        }
      }
      
    } catch (error) {
      logger.error('Database change polling failed', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Start invalidation queue processor
   */
  private startInvalidationProcessor(): void {
    // Process invalidation queue every 5 seconds
    setInterval(() => {
      this.processInvalidationQueue();
    }, 5 * 1000);
    
    // Daily metrics cleanup
    setInterval(() => {
      this.cleanupMetrics();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Process queued invalidations
   */
  private async processInvalidationQueue(): Promise<void> {
    if (this.isProcessing || this.invalidationQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const now = Date.now();
      const readyItems = this.invalidationQueue.filter(
        item => item.scheduledTime <= now
      );
      
      if (readyItems.length === 0) {
        return;
      }
      
      // Remove processed items from queue
      this.invalidationQueue = this.invalidationQueue.filter(
        item => item.scheduledTime > now
      );
      
      // Process items by priority
      const sortedItems = readyItems.sort((a, b) => {
        const ruleA = this.rules.get(a.ruleId);
        const ruleB = this.rules.get(b.ruleId);
        return (ruleB?.priority || 0) - (ruleA?.priority || 0);
      });
      
      for (const item of sortedItems) {
        await this.executeInvalidation(item.ruleId, item.data);
      }
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute cache invalidation based on rule
   */
  private async executeInvalidation(ruleId: string, data: any): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) {
      return;
    }
    
    const startTime = Date.now();
    
    try {
      // Check conditions if specified
      if (rule.conditions && !this.checkConditions(rule.conditions, data)) {
        logger.debug('Invalidation conditions not met', { ruleId, data });
        return;
      }
      
      await this.invalidateByScope(rule.scope, data);
      
      const processingTime = Date.now() - startTime;
      this.recordMetrics(ruleId, rule.scope.type, processingTime, true);
      
      // Emit success event
      this.emit('invalidation', {
        ruleId,
        trigger: rule.triggers[0]?.event,
        scope: rule.scope.type,
        timestamp: new Date(),
        processingTime,
        success: true
      } as InvalidationEvent);
      
      logger.debug('Cache invalidation completed', {
        ruleId,
        ruleName: rule.name,
        processingTime
      });
      
    } catch (error) {
      this.metrics.errors++;
      this.recordMetrics(ruleId, rule.scope.type, Date.now() - startTime, false);
      
      // Emit error event
      this.emit('invalidation', {
        ruleId,
        trigger: rule.triggers[0]?.event,
        scope: rule.scope.type,
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      } as InvalidationEvent);
      
      logger.error('Cache invalidation failed', {
        ruleId,
        ruleName: rule.name,
        error: (error as Error).message
      });
    }
  }

  /**
   * Invalidate cache based on scope configuration
   */
  private async invalidateByScope(scope: InvalidationScope, data: any): Promise<void> {
    switch (scope.type) {
      case 'specific':
        await this.invalidateSpecific(scope.target as string, data);
        break;
        
      case 'pattern':
        await this.invalidatePattern(scope.target as string, data);
        break;
        
      case 'cascade':
        await this.invalidateCascade(scope, data);
        break;
        
      case 'global':
        await this.invalidateGlobal();
        break;
        
      default:
        throw new Error(`Unknown invalidation scope: ${scope.type}`);
    }
  }

  /**
   * Invalidate specific cache keys
   */
  private async invalidateSpecific(target: string, data: any): Promise<void> {
    const key = this.interpolateKey(target, data);
    
    // Clear from L1 and L2 caches
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.warn('Failed to invalidate from Redis', { 
        key, 
        error: (error as Error).message 
      });
    }
  }

  /**
   * Invalidate cache keys matching pattern
   */
  private async invalidatePattern(pattern: string, data: any): Promise<void> {
    const keyPattern = this.interpolateKey(pattern, data);
    
    // In a real implementation, this would use Redis SCAN with pattern
    // For now, we'll clear known related keys
    const commonPatterns = [
      'unified_picks:picks_list',
      'unified_picks:user_picks',
      'unified_picks:published_picks',
      'unified_picks:daily_picks'
    ];
    
    for (const basePattern of commonPatterns) {
      if (keyPattern.includes(basePattern) || keyPattern === '*') {
        try {
          // Clear related cache entries
          await this.redis.del(`${basePattern}:*`);
        } catch (error) {
          logger.warn('Failed to clear pattern', { 
            pattern: basePattern, 
            error: (error as Error).message 
          });
        }
      }
    }
  }

  /**
   * Invalidate with cascade to related caches
   */
  private async invalidateCascade(scope: InvalidationScope, data: any): Promise<void> {
    // Invalidate primary target
    await this.invalidateSpecific(scope.target as string, data);
    
    // Invalidate cascading targets
    if (scope.cascade?.related) {
      for (const relatedTarget of scope.cascade.related) {
        await this.invalidatePattern(relatedTarget, data);
      }
    }
  }

  /**
   * Invalidate all caches (emergency use)
   */
  private async invalidateGlobal(): Promise<void> {
    logger.warn('Global cache invalidation triggered');
    
    try {
      await this.cacheService.clearAllCaches();
    } catch (error) {
      logger.error('Global cache clear failed', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Interpolate variables in cache key template
   */
  private interpolateKey(template: string, data: any): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] || data[this.toCamelCase(key)] || data[this.toSnakeCase(key)] || match;
    });
  }

  /**
   * Check if conditions are met for invalidation
   */
  private checkConditions(conditions: InvalidationCondition[], data: any): boolean {
    return conditions.every(condition => {
      const value = data[condition.field] || data[this.toCamelCase(condition.field)];
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'not_equals':
          return value !== condition.value;
        case 'contains':
          return Array.isArray(value) ? value.includes(condition.value) : String(value).includes(condition.value);
        case 'gt':
          return Number(value) > Number(condition.value);
        case 'lt':
          return Number(value) < Number(condition.value);
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(value);
        default:
          return false;
      }
    });
  }

  /**
   * Record metrics for invalidation
   */
  private recordMetrics(ruleId: string, scopeType: string, processingTime: number, success: boolean): void {
    this.metrics.totalInvalidations++;
    this.metrics.lastInvalidation = new Date();
    
    // Update rule metrics
    const ruleCount = this.metrics.byRule.get(ruleId) || 0;
    this.metrics.byRule.set(ruleId, ruleCount + 1);
    
    // Update scope metrics
    const scopeCount = this.metrics.byScope.get(scopeType) || 0;
    this.metrics.byScope.set(scopeType, scopeCount + 1);
    
    // Update processing time
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }
    
    this.metrics.averageProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    
    if (!success) {
      this.metrics.errors++;
    }
  }

  /**
   * Clean up old metrics
   */
  private cleanupMetrics(): void {
    // Reset daily metrics
    this.metrics.totalInvalidations = Math.floor(this.metrics.totalInvalidations * 0.9);
    this.metrics.errors = Math.floor(this.metrics.errors * 0.9);
    
    // Clear processing times older than 24 hours
    this.processingTimes = this.processingTimes.slice(-100);
    
    logger.debug('Metrics cleanup completed');
  }

  /**
   * Utility functions
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  // Public API Methods

  /**
   * Manually trigger invalidation
   */
  public async triggerInvalidation(
    trigger: string, 
    data: any = {}, 
    immediate = false
  ): Promise<void> {
    await this.processInvalidationTrigger('api_call', { 
      event: trigger, 
      ...data 
    }, immediate);
  }

  /**
   * Process invalidation trigger
   */
  public async processInvalidationTrigger(
    triggerType: InvalidationTrigger['type'],
    data: any,
    immediate = false
  ): Promise<void> {
    // Find matching rules
    const matchingRules = Array.from(this.rules.entries())
      .filter(([, rule]) => 
        rule.enabled && 
        rule.triggers.some(trigger => 
          trigger.type === triggerType && 
          (trigger.event === data.event || trigger.table === data.table)
        )
      );
    
    if (matchingRules.length === 0) {
      logger.debug('No matching invalidation rules', { triggerType, data });
      return;
    }
    
    for (const [ruleId, rule] of matchingRules) {
      const delay = immediate ? 0 : (rule.delay || 0);
      const scheduledTime = Date.now() + delay;
      
      this.invalidationQueue.push({
        ruleId,
        data,
        scheduledTime
      });
      
      this.metrics.pendingInvalidations = this.invalidationQueue.length;
      
      logger.debug('Invalidation queued', {
        ruleId,
        ruleName: rule.name,
        delay,
        scheduledTime: new Date(scheduledTime)
      });
    }
    
    // Process immediately if no delay
    if (immediate) {
      await this.processInvalidationQueue();
    }
  }

  /**
   * Add custom invalidation rule
   */
  public addRule(rule: InvalidationRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule already exists: ${rule.id}`);
    }
    
    this.rules.set(rule.id, rule);
    
    logger.info('Custom invalidation rule added', {
      ruleId: rule.id,
      ruleName: rule.name
    });
  }

  /**
   * Update existing rule
   */
  public updateRule(ruleId: string, updates: Partial<InvalidationRule>): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
    
    const updated = { ...rule, ...updates };
    this.rules.set(ruleId, updated);
    
    logger.info('Invalidation rule updated', { ruleId, updates });
  }

  /**
   * Delete rule
   */
  public deleteRule(ruleId: string): void {
    if (!this.rules.has(ruleId)) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
    
    this.rules.delete(ruleId);
    logger.info('Invalidation rule deleted', { ruleId });
  }

  /**
   * Get all rules
   */
  public getRules(): InvalidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule by ID
   */
  public getRule(ruleId: string): InvalidationRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get invalidation metrics
   */
  public getMetrics(): InvalidationMetrics {
    return {
      ...this.metrics,
      byRule: new Map(this.metrics.byRule),
      byTrigger: new Map(this.metrics.byTrigger),
      byScope: new Map(this.metrics.byScope),
      pendingInvalidations: this.invalidationQueue.length
    };
  }

  /**
   * Health check for invalidation service
   */
  public healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  } {
    const enabledRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled).length;
    const queueSize = this.invalidationQueue.length;
    const errorRate = this.metrics.totalInvalidations > 0 
      ? (this.metrics.errors / this.metrics.totalInvalidations) * 100 
      : 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (queueSize > 100) {
      status = 'degraded';
    }
    
    if (errorRate > 25 || queueSize > 500) {
      status = 'unhealthy';
    }
    
    return {
      status,
      details: {
        enabledRules,
        queueSize,
        errorRate: Math.round(errorRate * 100) / 100,
        metrics: this.metrics,
        processingStats: {
          averageTime: this.metrics.averageProcessingTime,
          samples: this.processingTimes.length
        }
      }
    };
  }
}

// Export singleton instance
export const cacheInvalidationService = CacheInvalidationService.getInstance();