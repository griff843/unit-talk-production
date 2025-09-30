/**
 * Performance Monitor for Syndicate-Grade Testing
 * 
 * Provides comprehensive performance monitoring capabilities:
 * - Real-time metrics collection and analysis
 * - Performance baseline establishment
 * - Threshold monitoring and alerting
 * - Resource utilization tracking
 * - Performance regression detection
 * - Detailed performance reporting
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    user: number;
    system: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  eventLoop: {
    lag: number;
    utilization: number;
  };
  gc: {
    count: number;
    duration: number;
    type: string;
  }[];
  network: {
    requestCount: number;
    responseTime: number;
    errorRate: number;
  };
  database: {
    queryCount: number;
    queryTime: number;
    connectionCount: number;
  };
  custom: Record<string, any>;
}

export interface PerformanceThresholds {
  maxCPUUsage: number;
  maxMemoryUsage: number;
  maxEventLoopLag: number;
  maxGCDuration: number;
  maxResponseTime: number;
  maxErrorRate: number;
  maxDatabaseQueryTime: number;
}

export interface PerformanceBaseline {
  cpu: number;
  memory: number;
  eventLoopLag: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
}

export class PerformanceMonitor extends EventEmitter {
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private performanceObserver?: PerformanceObserver;
  private metrics: PerformanceMetrics[] = [];
  private thresholds: PerformanceThresholds;
  private baseline?: PerformanceBaseline;
  private gcMetrics: any[] = [];
  private networkMetrics: any[] = [];
  private databaseMetrics: any[] = [];
  private customMetrics: Map<string, any[]> = new Map();
  
  constructor(thresholds?: Partial<PerformanceThresholds>) {
    super();
    
    this.thresholds = {
      maxCPUUsage: 80, // 80%
      maxMemoryUsage: 2048 * 1024 * 1024, // 2GB
      maxEventLoopLag: 100, // 100ms
      maxGCDuration: 50, // 50ms
      maxResponseTime: 1000, // 1 second
      maxErrorRate: 0.05, // 5%
      maxDatabaseQueryTime: 500, // 500ms
      ...thresholds
    };
    
    this.setupPerformanceObserver();
  }
  
  /**
   * Start performance monitoring
   */
  start(intervalMs: number = 1000): void {
    if (this.isMonitoring) {
      return;
    }
    
    console.log('📊 Starting performance monitoring');
    
    this.isMonitoring = true;
    this.metrics = [];
    this.gcMetrics = [];
    this.networkMetrics = [];
    this.databaseMetrics = [];
    
    // Start performance observer
    if (this.performanceObserver) {
      this.performanceObserver.observe({ entryTypes: ['gc', 'measure', 'mark'] });
    }
    
    // Start metrics collection
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
    
    this.emit('monitoring_started', { timestamp: Date.now() });
  }
  
  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    console.log('🛑 Stopping performance monitoring');
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    this.emit('monitoring_stopped', { 
      timestamp: Date.now(),
      metricsCollected: this.metrics.length
    });
  }
  
  /**
   * Establish performance baseline
   */
  async establishBaseline(durationMs: number = 30000): Promise<PerformanceBaseline> {
    console.log(`📈 Establishing performance baseline over ${durationMs/1000}s`);
    
    const baselineMetrics: PerformanceMetrics[] = [];
    
    const baselineInterval = setInterval(() => {
      const metrics = this.collectMetricsSnapshot();
      baselineMetrics.push(metrics);
    }, 1000);
    
    await new Promise(resolve => setTimeout(resolve, durationMs));
    clearInterval(baselineInterval);
    
    // Calculate baseline averages
    this.baseline = {
      cpu: this.calculateAverage(baselineMetrics, m => m.cpu.usage),
      memory: this.calculateAverage(baselineMetrics, m => m.memory.heapUsed),
      eventLoopLag: this.calculateAverage(baselineMetrics, m => m.eventLoop.lag),
      responseTime: this.calculateAverage(baselineMetrics, m => m.network.responseTime),
      throughput: this.calculateAverage(baselineMetrics, m => m.network.requestCount),
      errorRate: this.calculateAverage(baselineMetrics, m => m.network.errorRate)
    };
    
    console.log('✅ Performance baseline established:', this.baseline);
    
    this.emit('baseline_established', this.baseline);
    
    return this.baseline;
  }
  
  /**
   * Collect current performance metrics
   */
  private collectMetrics(): void {
    const metrics = this.collectMetricsSnapshot();
    this.metrics.push(metrics);
    
    // Check thresholds
    this.checkThresholds(metrics);
    
    this.emit('metrics_collected', metrics);
  }
  
  /**
   * Collect a snapshot of current metrics
   */
  private collectMetricsSnapshot(): PerformanceMetrics {
    const now = Date.now();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: now,
      cpu: {
        usage: this.calculateCPUUsage(cpuUsage),
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      },
      eventLoop: {
        lag: this.measureEventLoopLag(),
        utilization: this.calculateEventLoopUtilization()
      },
      gc: this.getRecentGCMetrics(),
      network: this.getNetworkMetrics(),
      database: this.getDatabaseMetrics(),
      custom: this.getCustomMetrics()
    };
  }
  
  /**
   * Check if metrics exceed thresholds
   */
  private checkThresholds(metrics: PerformanceMetrics): void {
    const violations: string[] = [];
    
    if (metrics.cpu.usage > this.thresholds.maxCPUUsage) {
      violations.push(`CPU usage: ${metrics.cpu.usage.toFixed(2)}% > ${this.thresholds.maxCPUUsage}%`);
    }
    
    if (metrics.memory.heapUsed > this.thresholds.maxMemoryUsage) {
      violations.push(`Memory usage: ${(metrics.memory.heapUsed/1024/1024).toFixed(2)}MB > ${(this.thresholds.maxMemoryUsage/1024/1024).toFixed(2)}MB`);
    }
    
    if (metrics.eventLoop.lag > this.thresholds.maxEventLoopLag) {
      violations.push(`Event loop lag: ${metrics.eventLoop.lag.toFixed(2)}ms > ${this.thresholds.maxEventLoopLag}ms`);
    }
    
    if (metrics.network.responseTime > this.thresholds.maxResponseTime) {
      violations.push(`Response time: ${metrics.network.responseTime.toFixed(2)}ms > ${this.thresholds.maxResponseTime}ms`);
    }
    
    if (metrics.network.errorRate > this.thresholds.maxErrorRate) {
      violations.push(`Error rate: ${(metrics.network.errorRate * 100).toFixed(2)}% > ${(this.thresholds.maxErrorRate * 100).toFixed(2)}%`);
    }
    
    if (metrics.database.queryTime > this.thresholds.maxDatabaseQueryTime) {
      violations.push(`Database query time: ${metrics.database.queryTime.toFixed(2)}ms > ${this.thresholds.maxDatabaseQueryTime}ms`);
    }
    
    const gcViolations = metrics.gc.filter(gc => gc.duration > this.thresholds.maxGCDuration);
    if (gcViolations.length > 0) {
      violations.push(`GC duration violations: ${gcViolations.length} events > ${this.thresholds.maxGCDuration}ms`);
    }
    
    if (violations.length > 0) {
      this.emit('threshold_violation', {
        timestamp: metrics.timestamp,
        violations
      });
    }
  }
  
  /**
   * Get performance summary
   */
  getPerformanceSummary(): any {
    if (this.metrics.length === 0) {
      return null;
    }
    
    const summary = {
      duration: this.metrics[this.metrics.length - 1].timestamp - this.metrics[0].timestamp,
      dataPoints: this.metrics.length,
      cpu: {
        avg: this.calculateAverage(this.metrics, m => m.cpu.usage),
        max: Math.max(...this.metrics.map(m => m.cpu.usage)),
        min: Math.min(...this.metrics.map(m => m.cpu.usage))
      },
      memory: {
        avg: this.calculateAverage(this.metrics, m => m.memory.heapUsed) / 1024 / 1024,
        max: Math.max(...this.metrics.map(m => m.memory.heapUsed)) / 1024 / 1024,
        min: Math.min(...this.metrics.map(m => m.memory.heapUsed)) / 1024 / 1024
      },
      eventLoop: {
        avg: this.calculateAverage(this.metrics, m => m.eventLoop.lag),
        max: Math.max(...this.metrics.map(m => m.eventLoop.lag)),
        min: Math.min(...this.metrics.map(m => m.eventLoop.lag))
      },
      network: {
        avgResponseTime: this.calculateAverage(this.metrics, m => m.network.responseTime),
        totalRequests: this.metrics.reduce((sum, m) => sum + m.network.requestCount, 0),
        avgErrorRate: this.calculateAverage(this.metrics, m => m.network.errorRate)
      },
      database: {
        avgQueryTime: this.calculateAverage(this.metrics, m => m.database.queryTime),
        totalQueries: this.metrics.reduce((sum, m) => sum + m.database.queryCount, 0),
        avgConnections: this.calculateAverage(this.metrics, m => m.database.connectionCount)
      },
      gc: {
        totalEvents: this.gcMetrics.length,
        avgDuration: this.gcMetrics.length > 0 ? 
          this.gcMetrics.reduce((sum, gc) => sum + gc.duration, 0) / this.gcMetrics.length : 0,
        maxDuration: this.gcMetrics.length > 0 ? 
          Math.max(...this.gcMetrics.map(gc => gc.duration)) : 0
      },
      comparison: undefined as any
    };
    
    // Compare with baseline if available
    if (this.baseline) {
      summary.comparison = {
        cpu: (summary.cpu.avg / this.baseline.cpu - 1) * 100,
        memory: (summary.memory.avg / (this.baseline.memory / 1024 / 1024) - 1) * 100,
        eventLoop: (summary.eventLoop.avg / this.baseline.eventLoopLag - 1) * 100,
        responseTime: (summary.network.avgResponseTime / this.baseline.responseTime - 1) * 100,
        errorRate: summary.network.avgErrorRate - this.baseline.errorRate
      };
    }
    
    return summary;
  }
  
  /**
   * Get detailed performance report
   */
  generatePerformanceReport(): any {
    const summary = this.getPerformanceSummary();
    if (!summary) {
      return null;
    }
    
    return {
      summary,
      thresholds: this.thresholds,
      baseline: this.baseline,
      metrics: this.metrics,
      gcMetrics: this.gcMetrics,
      networkMetrics: this.networkMetrics,
      databaseMetrics: this.databaseMetrics,
      customMetrics: Object.fromEntries(this.customMetrics),
      recommendations: this.generateRecommendations(summary)
    };
  }
  
  /**
   * Add custom metric
   */
  addCustomMetric(name: string, value: any): void {
    if (!this.customMetrics.has(name)) {
      this.customMetrics.set(name, []);
    }
    
    this.customMetrics.get(name)!.push({
      timestamp: Date.now(),
      value
    });
  }
  
  /**
   * Record network operation
   */
  recordNetworkOperation(responseTime: number, success: boolean): void {
    this.networkMetrics.push({
      timestamp: Date.now(),
      responseTime,
      success
    });
  }
  
  /**
   * Record database operation
   */
  recordDatabaseOperation(queryTime: number, success: boolean): void {
    this.databaseMetrics.push({
      timestamp: Date.now(),
      queryTime,
      success
    });
  }
  
  /**
   * Clear collected metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.gcMetrics = [];
    this.networkMetrics = [];
    this.databaseMetrics = [];
    this.customMetrics.clear();
  }
  
  // Private helper methods
  
  private setupPerformanceObserver(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'gc') {
          this.gcMetrics.push({
            timestamp: Date.now(),
            duration: entry.duration,
            type: (entry as any).detail?.kind || 'unknown'
          });
        }
      }
    });
  }
  
  private calculateCPUUsage(cpuUsage: NodeJS.CpuUsage): number {
    // This is a simplified CPU usage calculation
    // In a real implementation, you'd track the delta over time
    const totalUsage = cpuUsage.user + cpuUsage.system;
    return Math.min(100, (totalUsage / 1000000) / 10); // Rough approximation
  }
  
  private measureEventLoopLag(): number {
    const start = process.hrtime.bigint();
    return new Promise<number>((resolve) => {
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        resolve(lag);
      });
    }) as any;
  }
  
  private calculateEventLoopUtilization(): number {
    // This would require a more sophisticated implementation
    // For now, return a placeholder
    return Math.random() * 100;
  }
  
  private getRecentGCMetrics(): any[] {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return this.gcMetrics.filter(gc => gc.timestamp > fiveMinutesAgo);
  }
  
  private getNetworkMetrics(): any {
    const recentMetrics = this.networkMetrics.filter(m => 
      m.timestamp > Date.now() - 60000 // Last minute
    );
    
    return {
      requestCount: recentMetrics.length,
      responseTime: recentMetrics.length > 0 ? 
        recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length : 0,
      errorRate: recentMetrics.length > 0 ? 
        recentMetrics.filter(m => !m.success).length / recentMetrics.length : 0
    };
  }
  
  private getDatabaseMetrics(): any {
    const recentMetrics = this.databaseMetrics.filter(m => 
      m.timestamp > Date.now() - 60000 // Last minute
    );
    
    return {
      queryCount: recentMetrics.length,
      queryTime: recentMetrics.length > 0 ? 
        recentMetrics.reduce((sum, m) => sum + m.queryTime, 0) / recentMetrics.length : 0,
      connectionCount: 10 // Placeholder - would query actual connection pool
    };
  }
  
  private getCustomMetrics(): Record<string, any> {
    const customMetrics: Record<string, any> = {};
    
    for (const [name, values] of this.customMetrics) {
      const recentValues = values.filter(v => v.timestamp > Date.now() - 60000);
      if (recentValues.length > 0) {
        customMetrics[name] = {
          count: recentValues.length,
          latest: recentValues[recentValues.length - 1].value,
          average: recentValues.reduce((sum, v) => sum + (typeof v.value === 'number' ? v.value : 0), 0) / recentValues.length
        };
      }
    }
    
    return customMetrics;
  }
  
  private calculateAverage(metrics: PerformanceMetrics[], getter: (m: PerformanceMetrics) => number): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + getter(m), 0) / metrics.length;
  }
  
  private generateRecommendations(summary: any): string[] {
    const recommendations: string[] = [];
    
    if (summary.cpu.avg > 70) {
      recommendations.push('Consider optimizing CPU-intensive operations or scaling horizontally');
    }
    
    if (summary.memory.avg > 1024) {
      recommendations.push('Monitor memory usage for potential leaks or optimize memory allocation');
    }
    
    if (summary.eventLoop.avg > 50) {
      recommendations.push('Reduce blocking operations to improve event loop responsiveness');
    }
    
    if (summary.network.avgResponseTime > 500) {
      recommendations.push('Optimize network operations or implement caching strategies');
    }
    
    if (summary.database.avgQueryTime > 200) {
      recommendations.push('Review database queries for optimization opportunities');
    }
    
    if (summary.gc.avgDuration > 30) {
      recommendations.push('Consider tuning garbage collection settings or reducing allocation pressure');
    }
    
    if (this.baseline && summary.comparison) {
      if (summary.comparison.cpu > 50) {
        recommendations.push('CPU usage has increased significantly from baseline - investigate recent changes');
      }
      
      if (summary.comparison.memory > 30) {
        recommendations.push('Memory usage has grown from baseline - check for memory leaks');
      }
      
      if (summary.comparison.responseTime > 100) {
        recommendations.push('Response times have degraded significantly - review performance impact of recent changes');
      }
    }
    
    return recommendations;
  }
}

export default PerformanceMonitor;