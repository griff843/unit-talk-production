import { CacheFirstUnifiedPicksService } from './CacheFirstUnifiedPicksService';
import { requireSupabase } from '../utils/supabaseUtils';
import { toCamelKeys } from '@unit-talk/shared-utils';
import { logger } from '../utils/logger';
import { UnifiedPick } from '../db/unifiedPicksRepo';

export interface WarmupStrategy {
  name: string;
  enabled: boolean;
  priority: number; // 1-10, higher = more important
  frequency: 'startup' | 'hourly' | 'daily' | 'on-demand';
  conditions?: {
    timeOfDay?: string[]; // ['08:00', '18:00']
    daysOfWeek?: number[]; // [0-6, Sunday=0]
    minimumAge?: number; // Minutes since last warmup
  };
}

export interface WarmupMetrics {
  strategiesExecuted: number;
  totalItemsWarmed: number;
  totalTimeMs: number;
  avgTimePerItem: number;
  errors: number;
  lastWarmup: Date;
  successfulStrategies: string[];
  failedStrategies: string[];
}

/**
 * Cache Warming Service
 * Intelligently preloads frequently accessed data to maintain >90% cache hit rates
 * Supports multiple warming strategies based on usage patterns and time
 */
export class CacheWarmingService {
  private static instance: CacheWarmingService;
  private cacheService: CacheFirstUnifiedPicksService;
  
  private strategies: Map<string, WarmupStrategy> = new Map();
  private metrics: WarmupMetrics = {
    strategiesExecuted: 0,
    totalItemsWarmed: 0,
    totalTimeMs: 0,
    avgTimePerItem: 0,
    errors: 0,
    lastWarmup: new Date(),
    successfulStrategies: [],
    failedStrategies: []
  };
  
  private isWarmupRunning = false;
  private warmupQueue: string[] = [];
  
  private constructor() {
    this.cacheService = CacheFirstUnifiedPicksService.getInstance();
    this.initializeStrategies();
    this.startPeriodicWarmup();
    
    logger.info('CacheWarmingService initialized', {
      strategies: Array.from(this.strategies.keys())
    });
  }

  public static getInstance(): CacheWarmingService {
    if (!CacheWarmingService.instance) {
      CacheWarmingService.instance = new CacheWarmingService();
    }
    return CacheWarmingService.instance;
  }

  /**
   * Initialize default warming strategies
   */
  private initializeStrategies(): void {
    // High-priority: Published picks (accessed frequently)
    this.strategies.set('published_picks', {
      name: 'Published Picks',
      enabled: true,
      priority: 10,
      frequency: 'hourly',
      conditions: {
        minimumAge: 30 // 30 minutes
      }
    });
    
    // High-priority: Today's picks (time-sensitive)
    this.strategies.set('todays_picks', {
      name: "Today's Picks",
      enabled: true,
      priority: 9,
      frequency: 'hourly',
      conditions: {
        timeOfDay: ['06:00', '12:00', '18:00', '21:00'],
        minimumAge: 15 // 15 minutes
      }
    });
    
    // Medium-priority: Recent picks by top cappers
    this.strategies.set('top_capper_picks', {
      name: 'Top Capper Picks',
      enabled: true,
      priority: 8,
      frequency: 'daily',
      conditions: {
        timeOfDay: ['07:00', '19:00'],
        minimumAge: 120 // 2 hours
      }
    });
    
    // Medium-priority: Popular picks (high engagement)
    this.strategies.set('popular_picks', {
      name: 'Popular Picks',
      enabled: true,
      priority: 7,
      frequency: 'daily',
      conditions: {
        minimumAge: 180 // 3 hours
      }
    });
    
    // Low-priority: User-specific frequently accessed picks
    this.strategies.set('user_favorites', {
      name: 'User Favorites',
      enabled: true,
      priority: 5,
      frequency: 'daily',
      conditions: {
        timeOfDay: ['08:00'],
        minimumAge: 360 // 6 hours
      }
    });
    
    // Low-priority: Historical picks for analysis
    this.strategies.set('historical_analysis', {
      name: 'Historical Analysis Data',
      enabled: false, // Disabled by default
      priority: 3,
      frequency: 'daily',
      conditions: {
        timeOfDay: ['02:00'], // Off-peak hours
        minimumAge: 1440 // 24 hours
      }
    });
  }

  /**
   * Start periodic warmup based on strategies
   */
  private startPeriodicWarmup(): void {
    // Check every 15 minutes for warmup opportunities
    setInterval(() => {
      this.evaluateWarmupStrategies();
    }, 15 * 60 * 1000);
    
    // Daily cleanup and optimization at 3 AM
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 3 && now.getMinutes() === 0) {
        this.optimizeStrategies();
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Evaluate which strategies should run now
   */
  private async evaluateWarmupStrategies(): Promise<void> {
    if (this.isWarmupRunning) {
      logger.debug('Warmup already running, skipping evaluation');
      return;
    }
    
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM
    const currentDay = now.getDay();
    
    for (const [strategyId, strategy] of this.strategies.entries()) {
      if (!strategy.enabled) continue;
      
      // Check time-based conditions
      if (strategy.conditions?.timeOfDay) {
        const shouldRun = strategy.conditions.timeOfDay.some(time => {
          // Allow 5-minute window around target time
          const targetTime = new Date(`1970-01-01T${time}:00`);
          const currentTimeDate = new Date(`1970-01-01T${currentTime}:00`);
          const diffMinutes = Math.abs(targetTime.getTime() - currentTimeDate.getTime()) / (1000 * 60);
          return diffMinutes <= 5;
        });
        
        if (!shouldRun) continue;
      }
      
      // Check day of week
      if (strategy.conditions?.daysOfWeek) {
        if (!strategy.conditions.daysOfWeek.includes(currentDay)) continue;
      }
      
      // Check minimum age since last warmup
      if (strategy.conditions?.minimumAge) {
        const lastWarmupAge = (now.getTime() - this.metrics.lastWarmup.getTime()) / (1000 * 60);
        if (lastWarmupAge < strategy.conditions.minimumAge) continue;
      }
      
      // Add to warmup queue if not already queued
      if (!this.warmupQueue.includes(strategyId)) {
        this.warmupQueue.push(strategyId);
        logger.info('Strategy queued for warmup', { 
          strategy: strategy.name, 
          priority: strategy.priority 
        });
      }
    }
    
    // Execute warmup if strategies are queued
    if (this.warmupQueue.length > 0) {
      await this.executeWarmup();
    }
  }

  /**
   * Execute warmup for queued strategies
   */
  private async executeWarmup(): Promise<void> {
    if (this.isWarmupRunning) return;
    
    this.isWarmupRunning = true;
    const startTime = Date.now();
    
    try {
      logger.info('Starting cache warmup', { 
        strategiesQueued: this.warmupQueue.length 
      });
      
      // Sort by priority (highest first)
      const sortedStrategies = this.warmupQueue
        .map(id => ({ id, strategy: this.strategies.get(id)! }))
        .sort((a, b) => b.strategy.priority - a.strategy.priority);
      
      let totalItemsWarmed = 0;
      const successfulStrategies: string[] = [];
      const failedStrategies: string[] = [];
      
      for (const { id, strategy } of sortedStrategies) {
        try {
          const itemsWarmed = await this.executeStrategy(id, strategy);
          totalItemsWarmed += itemsWarmed;
          successfulStrategies.push(strategy.name);
          
          logger.info('Strategy completed successfully', {
            strategy: strategy.name,
            itemsWarmed
          });
          
        } catch (error) {
          failedStrategies.push(strategy.name);
          this.metrics.errors++;
          
          logger.error('Strategy failed', {
            strategy: strategy.name,
            error: (error as Error).message
          });
        }
      }
      
      // Update metrics
      const totalTime = Date.now() - startTime;
      this.metrics.strategiesExecuted += sortedStrategies.length;
      this.metrics.totalItemsWarmed += totalItemsWarmed;
      this.metrics.totalTimeMs += totalTime;
      this.metrics.avgTimePerItem = totalItemsWarmed > 0 
        ? this.metrics.totalTimeMs / this.metrics.totalItemsWarmed 
        : 0;
      this.metrics.lastWarmup = new Date();
      this.metrics.successfulStrategies = successfulStrategies;
      this.metrics.failedStrategies = failedStrategies;
      
      logger.info('Cache warmup completed', {
        totalTime,
        strategiesExecuted: sortedStrategies.length,
        itemsWarmed: totalItemsWarmed,
        successful: successfulStrategies.length,
        failed: failedStrategies.length
      });
      
    } finally {
      this.isWarmupRunning = false;
      this.warmupQueue = [];
    }
  }

  /**
   * Execute individual warmup strategy
   */
  private async executeStrategy(strategyId: string, strategy: WarmupStrategy): Promise<number> {
    const startTime = Date.now();
    let itemsWarmed = 0;
    
    switch (strategyId) {
      case 'published_picks':
        itemsWarmed = await this.warmPublishedPicks();
        break;
        
      case 'todays_picks':
        itemsWarmed = await this.warmTodaysPicks();
        break;
        
      case 'top_capper_picks':
        itemsWarmed = await this.warmTopCapperPicks();
        break;
        
      case 'popular_picks':
        itemsWarmed = await this.warmPopularPicks();
        break;
        
      case 'user_favorites':
        itemsWarmed = await this.warmUserFavorites();
        break;
        
      case 'historical_analysis':
        itemsWarmed = await this.warmHistoricalAnalysis();
        break;
        
      default:
        logger.warn('Unknown warmup strategy', { strategyId });
        return 0;
    }
    
    const duration = Date.now() - startTime;
    logger.debug('Strategy execution completed', {
      strategy: strategy.name,
      itemsWarmed,
      durationMs: duration
    });
    
    return itemsWarmed;
  }

  /**
   * Warm up published picks
   */
  private async warmPublishedPicks(): Promise<number> {
    await this.cacheService.getPublishedPicks(100);
    return 1; // 1 cache entry warmed
  }

  /**
   * Warm up today's picks
   */
  private async warmTodaysPicks(): Promise<number> {
    await this.cacheService.getTodaysPicks();
    return 1; // 1 cache entry warmed
  }

  /**
   * Warm up top capper picks
   */
  private async warmTopCapperPicks(): Promise<number> {
    try {
      const supabase = requireSupabase();
      
      // Get top cappers based on recent performance
      const { data: topCappers, error: cappersError } = await supabase
        .from('users')
        .select('id, username')
        .eq('tier', 'S')
        .limit(10);
      
      if (cappersError) throw cappersError;
      if (!topCappers?.length) return 0;
      
      let itemsWarmed = 0;
      for (const capper of topCappers) {
        await this.cacheService.listPicks({ 
          userId: capper.id, 
          published: true, 
          limit: 20 
        });
        itemsWarmed++;
      }
      
      return itemsWarmed;
      
    } catch (error) {
      logger.error('Failed to warm top capper picks', { 
        error: (error as Error).message 
      });
      return 0;
    }
  }

  /**
   * Warm up popular picks (based on engagement)
   */
  private async warmPopularPicks(): Promise<number> {
    try {
      const supabase = requireSupabase();
      
      // Get picks with high engagement (this would need engagement tracking)
      const { data: popularPicks, error } = await supabase
        .from('unified_picks')
        .select('id')
        .eq('published', true)
        .order('placed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      if (!popularPicks?.length) return 0;
      
      let itemsWarmed = 0;
      for (const pick of popularPicks.slice(0, 20)) { // Limit to avoid overloading
        await this.cacheService.getPick(pick.id);
        itemsWarmed++;
      }
      
      return itemsWarmed;
      
    } catch (error) {
      logger.error('Failed to warm popular picks', { 
        error: (error as Error).message 
      });
      return 0;
    }
  }

  /**
   * Warm up user favorites (this would require user behavior tracking)
   */
  private async warmUserFavorites(): Promise<number> {
    // This would require analytics data to identify frequently accessed picks
    // For now, warm up recent picks from active users
    try {
      await this.cacheService.listPicks({ 
        published: true, 
        limit: 30 
      });
      return 1;
      
    } catch (error) {
      logger.error('Failed to warm user favorites', { 
        error: (error as Error).message 
      });
      return 0;
    }
  }

  /**
   * Warm up historical analysis data
   */
  private async warmHistoricalAnalysis(): Promise<number> {
    try {
      const supabase = requireSupabase();
      
      // Get picks from last 30 days for analysis
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: historicalPicks, error } = await supabase
        .from('unified_picks')
        .select('id')
        .gte('placed_at', thirtyDaysAgo.toISOString())
        .eq('status', 'won')
        .limit(100);
      
      if (error) throw error;
      if (!historicalPicks?.length) return 0;
      
      // Warm up in batches to avoid overloading
      const batchSize = 10;
      let itemsWarmed = 0;
      
      for (let i = 0; i < historicalPicks.length; i += batchSize) {
        const batch = historicalPicks.slice(i, i + batchSize);
        await Promise.all(
          batch.map(pick => this.cacheService.getPick(pick.id))
        );
        itemsWarmed += batch.length;
        
        // Small delay between batches
        if (i + batchSize < historicalPicks.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return itemsWarmed;
      
    } catch (error) {
      logger.error('Failed to warm historical analysis data', { 
        error: (error as Error).message 
      });
      return 0;
    }
  }

  /**
   * Optimize strategies based on usage patterns
   */
  private async optimizeStrategies(): Promise<void> {
    logger.info('Starting strategy optimization...');
    
    try {
      // Analyze cache hit rates and adjust strategies
      const cacheMetrics = this.cacheService.getMetrics();
      
      if (cacheMetrics.hitRatio < 85) {
        logger.warn('Cache hit ratio below target, adjusting strategies', {
          hitRatio: cacheMetrics.hitRatio
        });
        
        // Increase frequency of high-priority strategies
        const highPriorityStrategies = Array.from(this.strategies.entries())
          .filter(([, strategy]) => strategy.priority >= 8);
        
        for (const [id, strategy] of highPriorityStrategies) {
          if (strategy.conditions?.minimumAge && strategy.conditions.minimumAge > 15) {
            strategy.conditions.minimumAge = Math.max(15, strategy.conditions.minimumAge - 15);
            logger.info('Reduced minimum age for strategy', {
              strategy: strategy.name,
              newMinimumAge: strategy.conditions.minimumAge
            });
          }
        }
      }
      
      // Reset error counts
      this.metrics.errors = 0;
      
      logger.info('Strategy optimization completed');
      
    } catch (error) {
      logger.error('Strategy optimization failed', { 
        error: (error as Error).message 
      });
    }
  }

  // Public API Methods

  /**
   * Manually trigger warmup for specific strategy
   */
  public async warmupStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyId}`);
    }
    
    if (this.isWarmupRunning) {
      throw new Error('Warmup already running');
    }
    
    logger.info('Manual warmup triggered', { strategy: strategy.name });
    
    try {
      this.isWarmupRunning = true;
      const itemsWarmed = await this.executeStrategy(strategyId, strategy);
      
      logger.info('Manual warmup completed', {
        strategy: strategy.name,
        itemsWarmed
      });
      
    } finally {
      this.isWarmupRunning = false;
    }
  }

  /**
   * Trigger immediate warmup for all enabled strategies
   */
  public async warmupAll(): Promise<void> {
    if (this.isWarmupRunning) {
      throw new Error('Warmup already running');
    }
    
    // Queue all enabled strategies
    for (const [id, strategy] of this.strategies.entries()) {
      if (strategy.enabled && !this.warmupQueue.includes(id)) {
        this.warmupQueue.push(id);
      }
    }
    
    await this.executeWarmup();
  }

  /**
   * Get warmup strategies
   */
  public getStrategies(): WarmupStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Update strategy configuration
   */
  public updateStrategy(strategyId: string, updates: Partial<WarmupStrategy>): void {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyId}`);
    }
    
    const updated = { ...strategy, ...updates };
    this.strategies.set(strategyId, updated);
    
    logger.info('Strategy updated', {
      strategyId,
      strategy: updated.name,
      updates
    });
  }

  /**
   * Add custom strategy
   */
  public addStrategy(strategyId: string, strategy: WarmupStrategy): void {
    if (this.strategies.has(strategyId)) {
      throw new Error(`Strategy already exists: ${strategyId}`);
    }
    
    this.strategies.set(strategyId, strategy);
    
    logger.info('Custom strategy added', {
      strategyId,
      strategy: strategy.name
    });
  }

  /**
   * Get warmup metrics
   */
  public getMetrics(): WarmupMetrics {
    return { ...this.metrics };
  }

  /**
   * Health check for warmup service
   */
  public healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  } {
    const now = Date.now();
    const timeSinceLastWarmup = now - this.metrics.lastWarmup.getTime();
    const enabledStrategies = Array.from(this.strategies.values())
      .filter(s => s.enabled).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Check if warmup is stuck
    if (this.isWarmupRunning && timeSinceLastWarmup > 30 * 60 * 1000) {
      status = 'unhealthy';
    }
    
    // Check error rate
    const errorRate = this.metrics.strategiesExecuted > 0 
      ? (this.metrics.errors / this.metrics.strategiesExecuted) * 100 
      : 0;
    
    if (errorRate > 25) {
      status = status === 'healthy' ? 'degraded' : 'unhealthy';
    }
    
    return {
      status,
      details: {
        isWarmupRunning: this.isWarmupRunning,
        enabledStrategies,
        queueLength: this.warmupQueue.length,
        timeSinceLastWarmup: Math.floor(timeSinceLastWarmup / (1000 * 60)), // minutes
        metrics: this.metrics,
        errorRate: Math.round(errorRate * 100) / 100
      }
    };
  }
}

// Export singleton instance
export const cacheWarmingService = CacheWarmingService.getInstance();