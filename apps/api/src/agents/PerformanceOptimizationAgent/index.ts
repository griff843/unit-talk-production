import { redisCache } from '../../cache/enhanced-cache';
import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';

import { BottleneckDetector } from './bottleneckDetector';
import { PerformanceOptimizer } from './performanceOptimizer';
import { ResourceManager } from './resourceManager';
import { SystemMonitor } from './systemMonitor';

interface PerformanceMetrics extends BaseMetrics {
  systemCpuUsage: number;
  systemMemoryUsage: number;
  systemDiskUsage: number;
  networkLatency: number;
  agentResponseTime: number;
  databaseQueryTime: number;
  cacheHitRate: number;
  errorRate: number;
  throughput: number;
  bottlenecksDetected: number;
  optimizationsApplied: number;
  resourceUtilization: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  score: number;
  professional_score?: number;
  components: ComponentHealth[];
  bottlenecks: PerformanceBottleneck[];
  recommendations: OptimizationRecommendation[];
  lastUpdated: Date;
}

interface ComponentHealth {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  metrics: Record<string, number>;
  lastCheck: Date;
  issues?: string[];
}

interface PerformanceBottleneck {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'database' | 'cache' | 'agent';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  impact: number;
  detectedAt: Date;
  metrics: Record<string, number>;
  recommendations: string[];
}

interface OptimizationRecommendation {
  id: string;
  type: 'resource' | 'configuration' | 'scaling' | 'caching' | 'query' | 'code';
  priority: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  title: string;
  description: string;
  expectedImpact: number;
  implementationCost: 'low' | 'medium' | 'high';
  actions: OptimizationAction[];
  estimatedTimeToImplement: number;
  metrics: Record<string, number>;
}

interface OptimizationAction {
  action: string;
  parameters: Record<string, any>;
  automated: boolean;
  safetyRating: number;
}

interface PerformanceReport {
  timestamp: Date;
  systemHealth: SystemHealth;
  performanceTrends: PerformanceTrend[];
  optimizationResults: OptimizationResult[];
  resourcePredictions: ResourcePrediction[];
  alertsSent: number;
  summaryInsights: string[];
}

interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'degrading' | 'stable';
  changePercentage: number;
  timeframe: string;
  significance: number;
}

interface OptimizationResult {
  recommendationId: string;
  status: 'applied' | 'failed' | 'pending' | 'skipped';
  appliedAt?: Date;
  impact?: number;
  beforeMetrics: Record<string, number>;
  afterMetrics?: Record<string, number>;
  notes?: string;
}

interface ResourcePrediction {
  resource: string;
  currentUsage: number;
  predictedUsage: number;
  timeHorizon: number;
  confidence: number;
  warningThreshold: number;
  criticalThreshold: number;
}

export class PerformanceOptimizationAgent extends BaseAgent {
  private systemMonitor: SystemMonitor;
  private performanceOptimizer: PerformanceOptimizer;
  private bottleneckDetector: BottleneckDetector;
  private resourceManager: ResourceManager;
  private performanceMetrics: PerformanceMetrics;
  private systemHealth: SystemHealth;
  private activeBottlenecks: Map<string, PerformanceBottleneck> = new Map();
  private optimizationHistory: OptimizationResult[] = [];
  private performanceBaseline: Record<string, number> = {};

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    
    this.performanceMetrics = {
      ...this.metrics,
      systemCpuUsage: 0,
      systemMemoryUsage: 0,
      systemDiskUsage: 0,
      networkLatency: 0,
      agentResponseTime: 0,
      databaseQueryTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      throughput: 0,
      bottlenecksDetected: 0,
      optimizationsApplied: 0,
      resourceUtilization: 0
    };

    this.systemHealth = {
      status: 'healthy',
      score: 100,
      components: [],
      bottlenecks: [],
      recommendations: [],
      lastUpdated: new Date()
    };

    // Initialize subsystems
    this.systemMonitor = new SystemMonitor(this.logger);
    this.performanceOptimizer = new PerformanceOptimizer(this.logger);
    this.bottleneckDetector = new BottleneckDetector(this.logger);
    this.resourceManager = new ResourceManager(this.logger);
  }

  protected async initialize(): Promise<void> {
    this.logger.info('⚡ PerformanceOptimizationAgent initializing...');

    // Initialize all subsystems
    await Promise.all([
      this.systemMonitor.initialize(),
      this.performanceOptimizer.initialize(),
      this.bottleneckDetector.initialize(),
      this.resourceManager.initialize()
    ]);

    // Load historical data
    await this.loadPerformanceBaseline();
    await this.loadOptimizationHistory();
    await this.loadActiveBottlenecks();

    this.logger.info('✅ PerformanceOptimizationAgent initialized successfully');
  }

  protected async process(): Promise<void> {
    this.logger.info('🔄 Running PerformanceOptimizationAgent cycle...');
    
    const cycleStartTime = Date.now();

    try {
      // 1. Collect system metrics
      await this.collectSystemMetrics();
      
      // 2. Monitor component health
      await this.monitorComponentHealth();
      
      // 3. Detect performance bottlenecks
      await this.detectBottlenecks();
      
      // 4. Generate optimization recommendations
      await this.generateOptimizationRecommendations();
      
      // 5. Apply automated optimizations
      await this.applyAutomatedOptimizations();
      
      // 6. Update resource predictions
      await this.updateResourcePredictions();
      
      // 7. Generate performance report
      await this.generatePerformanceReport();

    } catch (error) {
      this.logger.error('❌ Error in performance optimization cycle', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }

    const cycleTime = Date.now() - cycleStartTime;
    this.performanceMetrics.processingTimeMs = cycleTime;

    this.logger.info('✅ PerformanceOptimizationAgent cycle completed', {
      cycleTimeMs: cycleTime,
      systemHealthScore: this.systemHealth.professional_score,
      bottlenecksDetected: this.performanceMetrics.bottlenecksDetected,
      optimizationsApplied: this.performanceMetrics.optimizationsApplied
    });
  }

  // Core Processing Methods
  private async collectSystemMetrics(): Promise<void> {
    this.logger.debug('📊 Collecting system metrics...');

    try {
      const metrics = await this.systemMonitor.collectMetrics();
      
      // Update performance metrics
      this.performanceMetrics.systemCpuUsage = metrics.cpu.usage;
      this.performanceMetrics.systemMemoryUsage = metrics.memory.usage;
      this.performanceMetrics.systemDiskUsage = metrics.disk.usage;
      this.performanceMetrics.networkLatency = metrics.network.latency;
      this.performanceMetrics.databaseQueryTime = metrics.database.avgQueryTime;
      this.performanceMetrics.cacheHitRate = metrics.cache.hitRate;
      this.performanceMetrics.errorRate = metrics.application.errorRate;
      this.performanceMetrics.throughput = metrics.application.throughput;
      
      // Calculate resource utilization
      this.performanceMetrics.resourceUtilization = 
        (metrics.cpu.usage + metrics.memory.usage + metrics.disk.usage) / 3;

      // Store metrics for trend analysis
      await this.storeMetricsForTrendAnalysis(metrics);

      this.logger.debug('✅ System metrics collected', {
        cpu: metrics.cpu.usage,
        memory: metrics.memory.usage,
        disk: metrics.disk.usage,
        cacheHitRate: metrics.cache.hitRate
      });

    } catch (error) {
      this.logger.error('❌ Failed to collect system metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async monitorComponentHealth(): Promise<void> {
    this.logger.debug('🏥 Monitoring component health...');

    try {
      const componentChecks = await Promise.allSettled([
        this.systemMonitor.checkDatabaseHealth(),
        this.systemMonitor.checkCacheHealth(),
        this.systemMonitor.checkAgentHealth(),
        this.systemMonitor.checkNetworkHealth(),
        this.systemMonitor.checkStorageHealth()
      ]);

      const components: ComponentHealth[] = [];
      let overallScore = 100;
      
      componentChecks.forEach((check, index) => {
        const componentNames = ['database', 'cache', 'agents', 'network', 'storage'];
        const componentName = componentNames[index];
        
        if (check.status === 'fulfilled') {
          const health = check.value;
          components.push({
            name: componentName,
            status: health.status,
            metrics: health.metrics,
            lastCheck: new Date(),
            issues: health.issues
          });
          
          // Update overall professional_score
          if (health.status === 'warning') overallScore -= 10;
          else if (health.status === 'critical') overallScore -= 25;
        } else {
          components.push({
            name: componentName,
            status: 'critical',
            metrics: {},
            lastCheck: new Date(),
            issues: ['Health check failed']
          });
          overallScore -= 25;
        }
      });

      // Update system health
      this.systemHealth.components = components;
      this.systemHealth.professional_score = Math.max(0, overallScore);
      this.systemHealth.status = this.determineOverallStatus(overallScore);
      this.systemHealth.lastUpdated = new Date();

      this.logger.debug('✅ Component health monitoring completed', {
        overallScore,
        status: this.systemHealth.status,
        components: components.length
      });

    } catch (error) {
      this.logger.error('❌ Failed to monitor component health', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async detectBottlenecks(): Promise<void> {
    this.logger.debug('🔍 Detecting performance bottlenecks...');

    try {
      const detectedBottlenecks = await this.bottleneckDetector.detectBottlenecks({
        cpu: this.performanceMetrics.systemCpuUsage,
        memory: this.performanceMetrics.systemMemoryUsage,
        disk: this.performanceMetrics.systemDiskUsage,
        network: this.performanceMetrics.networkLatency,
        database: this.performanceMetrics.databaseQueryTime,
        cache: this.performanceMetrics.cacheHitRate,
        errorRate: this.performanceMetrics.errorRate,
        throughput: this.performanceMetrics.throughput
      });

      let newBottlenecks = 0;
      let resolvedBottlenecks = 0;

      // Process new bottlenecks
      for (const bottleneck of detectedBottlenecks) {
        if (!this.activeBottlenecks.has(bottleneck.id)) {
          this.activeBottlenecks.set(bottleneck.id, bottleneck);
          newBottlenecks++;
          
          if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
            await this.sendBottleneckAlert(bottleneck);
          }
        }
      }

      // Check for resolved bottlenecks
      const currentBottleneckIds = new Set(detectedBottlenecks.map(b => b.id));
      for (const [id, bottleneck] of this.activeBottlenecks) {
        if (!currentBottleneckIds.has(id)) {
          this.activeBottlenecks.delete(id);
          resolvedBottlenecks++;
          await this.logBottleneckResolution(bottleneck);
        }
      }

      this.performanceMetrics.bottlenecksDetected = this.activeBottlenecks.size;
      this.systemHealth.bottlenecks = Array.from(this.activeBottlenecks.values());

      this.logger.debug('✅ Bottleneck detection completed', {
        activeBottlenecks: this.activeBottlenecks.size,
        newBottlenecks,
        resolvedBottlenecks
      });

    } catch (error) {
      this.logger.error('❌ Failed to detect bottlenecks', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async generateOptimizationRecommendations(): Promise<void> {
    this.logger.debug('💡 Generating optimization recommendations...');

    try {
      const recommendations = await this.performanceOptimizer.generateRecommendations({
        metrics: this.performanceMetrics,
        bottlenecks: Array.from(this.activeBottlenecks.values()),
        systemHealth: this.systemHealth,
        baseline: this.performanceBaseline
      });

      // Prioritize recommendations
      const prioritizedRecommendations = recommendations.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      this.systemHealth.recommendations = prioritizedRecommendations;

      // Log high priority recommendations
      const highPriorityRecs = prioritizedRecommendations.filter(r => 
        r.priority === 'critical' || r.priority === 'high'
      );

      for (const rec of highPriorityRecs) {
        this.logger.warn('⚠️ High priority optimization recommendation', {
          type: rec.type,
          component: rec.component,
          title: rec.title,
          expectedImpact: rec.expectedImpact
        });
      }

      this.logger.debug('✅ Optimization recommendations generated', {
        totalRecommendations: recommendations.length,
        highPriority: highPriorityRecs.length
      });

    } catch (error) {
      this.logger.error('❌ Failed to generate optimization recommendations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async applyAutomatedOptimizations(): Promise<void> {
    this.logger.debug('🔧 Applying automated optimizations...');

    try {
      let optimizationsApplied = 0;
      
      for (const recommendation of this.systemHealth.recommendations) {
        // Only apply safe, automated optimizations
        const automatedActions = recommendation.actions.filter(a => 
          a.automated && a.safetyRating >= 0.8
        );

        if (automatedActions.length > 0 && recommendation.priority !== 'low') {
          const result = await this.performanceOptimizer.applyOptimization(recommendation);
          
          this.optimizationHistory.push(result);
          
          if (result.status === 'applied') {
            optimizationsApplied++;
            this.logger.info('✅ Optimization applied successfully', {
              recommendationId: recommendation.id,
              component: recommendation.component,
              impact: result.impact
            });
          } else {
            this.logger.warn('⚠️ Optimization failed', {
              recommendationId: recommendation.id,
              status: result.status,
              notes: result.notes
            });
          }
        }
      }

      this.performanceMetrics.optimizationsApplied += optimizationsApplied;

      // Clean up old optimization history
      if (this.optimizationHistory.length > 100) {
        this.optimizationHistory = this.optimizationHistory.slice(-100);
      }

      this.logger.debug('✅ Automated optimizations completed', {
        optimizationsApplied
      });

    } catch (error) {
      this.logger.error('❌ Failed to apply automated optimizations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async updateResourcePredictions(): Promise<void> {
    this.logger.debug('🔮 Updating resource predictions...');

    try {
      const predictions = await this.resourceManager.generatePredictions({
        currentMetrics: this.performanceMetrics,
        historicalData: await this.getHistoricalMetrics(),
        timeHorizons: [60, 180, 720] // 1 hour, 3 hours, 12 hours
      });

      // Check for predicted resource exhaustion
      for (const prediction of predictions) {
        if (prediction.predictedUsage > prediction.warningThreshold) {
          await this.sendResourceWarning(prediction);
        }
      }

      // Cache predictions for dashboard
      await redisCache.set(
        'performance:resource_predictions',
        JSON.stringify(predictions),
        1800 // 30 minutes TTL
      );

    } catch (error) {
      this.logger.error('❌ Failed to update resource predictions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async generatePerformanceReport(): Promise<void> {
    this.logger.debug('📈 Generating performance report...');

    try {
      const trends = await this.analyzePerformanceTrends();
      const predictions = await this.getResourcePredictions();
      
      const report: PerformanceReport = {
        timestamp: new Date(),
        systemHealth: this.systemHealth,
        performanceTrends: trends,
        optimizationResults: this.optimizationHistory.slice(-10),
        resourcePredictions: predictions,
        alertsSent: await this.getAlertCount(),
        summaryInsights: await this.generateSummaryInsights()
      };

      // Store report
      await withCircuitBreaker.supabase(
        async () => {
          if (this.hasSupabase()) {
            await this.requireSupabase()
              .from('performance_reports')
              .insert({
                timestamp: report.timestamp.toISOString(),
                system_health_score: report.systemHealth.professional_score,
                bottlenecks_count: report.systemHealth.bottlenecks.length,
                recommendations_count: report.systemHealth.recommendations.length,
                report_data: report
              });
          }
        },
        async () => {
          this.logger.warn('⚠️ Failed to store performance report, Supabase circuit breaker open');
        }
      );

      // Cache for dashboard
      await redisCache.set(
        'performance:latest_report',
        JSON.stringify(report),
        1800 // 30 minutes TTL
      );

      this.logger.debug('✅ Performance report generated', {
        healthScore: report.systemHealth.professional_score,
        trends: report.performanceTrends.length,
        recommendations: report.systemHealth.recommendations.length
      });

    } catch (error) {
      this.logger.error('❌ Failed to generate performance report', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Helper Methods
  private determineOverallStatus(score: number): 'healthy' | 'degraded' | 'critical' | 'down' {
    if (score >= 80) return 'healthy';
    if (score >= 60) return 'degraded';
    if (score >= 20) return 'critical';
    return 'down';
  }

  private async sendBottleneckAlert(bottleneck: PerformanceBottleneck): Promise<void> {
    this.logger.warn('🚨 Performance bottleneck detected', {
      type: bottleneck.type,
      component: bottleneck.component,
      severity: bottleneck.severity,
      description: bottleneck.description,
      impact: bottleneck.impact
    });
    
    // This would integrate with alerting system
  }

  private async logBottleneckResolution(bottleneck: PerformanceBottleneck): Promise<void> {
    this.logger.info('✅ Performance bottleneck resolved', {
      type: bottleneck.type,
      component: bottleneck.component,
      resolvedAfter: Date.now() - bottleneck.detectedAt.getTime()
    });
  }

  private async sendResourceWarning(prediction: ResourcePrediction): Promise<void> {
    this.logger.warn('⚠️ Resource capacity warning', {
      resource: prediction.resource,
      currentUsage: prediction.currentUsage,
      predictedUsage: prediction.predictedUsage,
      timeHorizon: prediction.timeHorizon,
      confidence: prediction.confidence
    });
  }

  private async storeMetricsForTrendAnalysis(metrics: any): Promise<void> {
    const timestamp = Date.now();
    await redisCache.set(
      `performance:metrics:${timestamp}`,
      JSON.stringify({
        timestamp,
        cpu: metrics.cpu.usage,
        memory: metrics.memory.usage,
        disk: metrics.disk.usage,
        network: metrics.network.latency,
        database: metrics.database.avgQueryTime,
        cache: metrics.cache.hitRate,
        errorRate: metrics.application.errorRate,
        throughput: metrics.application.throughput
      }),
      86400 // 24 hours TTL
    );
  }

  private async getHistoricalMetrics(): Promise<any[]> {
    const pattern = 'performance:metrics:*';
    const cached = await redisCache.getPattern(pattern);
    return Array.from(cached.values()).map(data => JSON.parse(data as string));
  }

  private async analyzePerformanceTrends(): Promise<PerformanceTrend[]> {
    const historical = await this.getHistoricalMetrics();
    const trends: PerformanceTrend[] = [];
    
    if (historical.length < 2) return trends;
    
    const metrics = ['cpu', 'memory', 'disk', 'network', 'database', 'cache', 'errorRate', 'throughput'];
    
    for (const metric of metrics) {
      const values = historical.map(h => h[metric]).filter(v => v !== undefined);
      if (values.length >= 2) {
        const recent = values.slice(-10);
        const older = values.slice(-20, -10);
        
        const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const olderAvg = older.length > 0 ? older.reduce((sum, val) => sum + val, 0) / older.length : recentAvg;
        
        const changePercentage = olderAvg !== 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
        
        trends.push({
          metric,
          direction: changePercentage > 2 ? 'improving' : changePercentage < -2 ? 'degrading' : 'stable',
          changePercentage: Math.abs(changePercentage),
          timeframe: '1h',
          significance: Math.min(1, Math.abs(changePercentage) / 10)
        });
      }
    }
    
    return trends;
  }

  private async getResourcePredictions(): Promise<ResourcePrediction[]> {
    const cached = await redisCache.get('performance:resource_predictions');
    return cached ? JSON.parse(cached) : [];
  }

  private async getAlertCount(): Promise<number> {
    // This would track actual alerts sent
    return this.activeBottlenecks.size;
  }

  private async generateSummaryInsights(): Promise<string[]> {
    const insights: string[] = [];
    
    const score = this.systemHealth.professional_score ?? this.systemHealth.score;
    if (score >= 90) {
      insights.push('System performance is excellent with no major issues detected');
    } else if (score >= 70) {
      insights.push('System performance is good with minor optimization opportunities');
    } else if (score >= 50) {
      insights.push('System performance is degraded - active monitoring and optimization needed');
    } else {
      insights.push('System performance is critical - immediate attention required');
    }
    
    if (this.activeBottlenecks.size > 0) {
      insights.push(`${this.activeBottlenecks.size} active performance bottlenecks detected`);
    }
    
    if (this.systemHealth.recommendations.length > 0) {
      const highPriority = this.systemHealth.recommendations.filter(r => r.priority === 'high' || r.priority === 'critical').length;
      insights.push(`${this.systemHealth.recommendations.length} optimization recommendations available (${highPriority} high priority)`);
    }
    
    return insights;
  }

  private async loadPerformanceBaseline(): Promise<void> {
    try {
      const cached = await redisCache.get('performance:baseline');
      if (cached) {
        this.performanceBaseline = JSON.parse(cached);
      } else {
        // Set default baseline values
        this.performanceBaseline = {
          cpu: 0.3,
          memory: 0.5,
          disk: 0.4,
          network: 50,
          database: 100,
          cache: 0.8,
          errorRate: 0.01,
          throughput: 100
        };
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load performance baseline');
    }
  }

  private async loadOptimizationHistory(): Promise<void> {
    try {
      const cached = await redisCache.get('performance:optimization_history');
      if (cached) {
        this.optimizationHistory = JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load optimization history');
    }
  }

  private async loadActiveBottlenecks(): Promise<void> {
    try {
      const cached = await redisCache.getPattern('performance:bottleneck:*');
      for (const [_key, data] of cached) {
        const bottleneck = JSON.parse(data as string);
        bottleneck.detectedAt = new Date(bottleneck.detectedAt);
        this.activeBottlenecks.set(bottleneck.id, bottleneck);
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load active bottlenecks');
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 PerformanceOptimizationAgent cleanup...');
    
    // Save performance baseline
    await redisCache.set(
      'performance:baseline',
      JSON.stringify(this.performanceBaseline),
      86400 // 24 hours TTL
    );
    
    // Save optimization history
    await redisCache.set(
      'performance:optimization_history',
      JSON.stringify(this.optimizationHistory),
      86400 // 24 hours TTL
    );
    
    // Save active bottlenecks
    for (const [id, bottleneck] of this.activeBottlenecks) {
      await redisCache.set(
        `performance:bottleneck:${id}`,
        JSON.stringify(bottleneck),
        86400 // 24 hours TTL
      );
    }
    
    await Promise.all([
      this.systemMonitor.cleanup(),
      this.performanceOptimizer.cleanup(),
      this.bottleneckDetector.cleanup(),
      this.resourceManager.cleanup()
    ]);
    
    this.activeBottlenecks.clear();
    this.optimizationHistory.length = 0;
    
    this.logger.info('✅ PerformanceOptimizationAgent cleanup complete');
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      ...this.performanceMetrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  public async checkHealth(): Promise<any> {
    const checks: Array<{
      component: string;
      status: 'healthy' | 'unhealthy';
    }> = [];

    // Check subsystem health
    checks.push({
      component: 'system_monitor',
      status: await this.systemMonitor.isHealthy() ? 'healthy' : 'unhealthy'
    });

    checks.push({
      component: 'performance_optimizer',
      status: await this.performanceOptimizer.isHealthy() ? 'healthy' : 'unhealthy'
    });

    checks.push({
      component: 'bottleneck_detector',
      status: await this.bottleneckDetector.isHealthy() ? 'healthy' : 'unhealthy'
    });

    checks.push({
      component: 'resource_manager',
      status: await this.resourceManager.isHealthy() ? 'healthy' : 'unhealthy'
    });

    const healthyComponents = checks.filter(c => c.status === 'healthy').length;
    const overallStatus = healthyComponents === checks.length ? 'healthy' : 
                         healthyComponents >= checks.length / 2 ? 'degraded' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      details: {
        checks,
        systemHealth: this.systemHealth,
        metrics: this.performanceMetrics,
        activeBottlenecks: this.activeBottlenecks.size,
        optimizationHistory: this.optimizationHistory.length
      }
    };
  }

  public async getSystemHealth(): Promise<SystemHealth> {
    return this.systemHealth;
  }

  public async getActiveBottlenecks(): Promise<PerformanceBottleneck[]> {
    return Array.from(this.activeBottlenecks.values());
  }

  public async getOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    return this.systemHealth.recommendations;
  }
}