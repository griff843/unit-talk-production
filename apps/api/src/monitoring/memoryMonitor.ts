/**
 * Advanced Memory Monitor and Leak Detection System
 * Comprehensive memory monitoring with leak detection, alerts, and automatic remediation
 * Production-ready memory management for Node.js applications
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('MemoryMonitor');

export interface MemoryMetrics {
  rss: number;           // Resident Set Size
  heapTotal: number;     // Total heap size
  heapUsed: number;      // Used heap size
  external: number;      // External memory usage
  arrayBuffers: number;  // ArrayBuffer memory usage
  timestamp: number;
  heapUtilization: number; // heapUsed / heapTotal
}

export interface MemoryThresholds {
  warningMB: number;     // Warning threshold
  criticalMB: number;    // Critical threshold
  heapUtilization: number; // Heap utilization warning (0-1)
  leakDetectionWindow: number; // Time window for leak detection (ms)
  leakThresholdMB: number; // Memory increase threshold for leak detection
}

export interface MemoryAlert {
  type: 'warning' | 'critical' | 'leak_detected' | 'gc_pressure';
  message: string;
  metrics: MemoryMetrics;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface GCMetrics {
  gcCount: number;
  gcTime: number;
  gcType: string;
  timestamp: number;
}

export class MemoryMonitor extends EventEmitter {
  private metrics: MemoryMetrics[] = [];
  private gcMetrics: GCMetrics[] = [];
  private thresholds: MemoryThresholds;
  private monitoringInterval?: NodeJS.Timeout;
  private gcObserver?: any;
  private isMonitoring = false;
  private alertHistory: MemoryAlert[] = [];
  private maxHistorySize = 1000;

  constructor(thresholds: Partial<MemoryThresholds> = {}) {
    super();
    
    this.thresholds = {
      warningMB: 512,        // 512MB warning
      criticalMB: 1024,      // 1GB critical
      heapUtilization: 0.85, // 85% heap utilization
      leakDetectionWindow: 5 * 60 * 1000, // 5 minutes
      leakThresholdMB: 50,   // 50MB increase = potential leak
      ...thresholds
    };

    this.setupGCMonitoring();
  }

  /**
   * Start memory monitoring
   */
  start(intervalMs = 30000): void { // Default: 30 seconds
    if (this.isMonitoring) {
      logger.warn('Memory monitoring already started');
      return;
    }

    logger.info('🔍 Starting memory monitoring', {
      intervalMs,
      thresholds: this.thresholds
    });

    this.isMonitoring = true;
    
    // Initial measurement
    this.collectMetrics();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeMemoryTrends();
      this.detectMemoryLeaks();
      this.checkThresholds();
    }, intervalMs);

    this.emit('monitoring_started');
  }

  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('🛑 Stopping memory monitoring');

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }

    this.emit('monitoring_stopped');
  }

  /**
   * Collect current memory metrics
   */
  private collectMetrics(): void {
    const memUsage = process.memoryUsage();
    
    const metrics: MemoryMetrics = {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      timestamp: Date.now(),
      heapUtilization: memUsage.heapUsed / memUsage.heapTotal
    };

    this.metrics.push(metrics);

    // Keep only recent metrics (last 1000 measurements)
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics = this.metrics.slice(-this.maxHistorySize);
    }

    this.emit('metrics_collected', metrics);
  }

  /**
   * Analyze memory trends
   */
  private analyzeMemoryTrends(): void {
    if (this.metrics.length < 10) return; // Need at least 10 data points

    const recent = this.metrics.slice(-10);
    const trend = this.calculateTrend(recent.map(m => m.heapUsed));

    if (trend > 0.1) { // Increasing trend
      logger.debug('📈 Memory usage trending upward', {
        trend: trend.toFixed(3),
        currentHeapMB: (recent[recent.length - 1].heapUsed / 1024 / 1024).toFixed(2)
      });
    }
  }

  /**
   * Detect potential memory leaks
   */
  private detectMemoryLeaks(): void {
    if (this.metrics.length < 2) return;

    const now = Date.now();
    const windowStart = now - this.thresholds.leakDetectionWindow;
    
    // Get metrics within the detection window
    const windowMetrics = this.metrics.filter(m => m.timestamp >= windowStart);
    
    if (windowMetrics.length < 2) return;

    const startMemory = windowMetrics[0].heapUsed;
    const endMemory = windowMetrics[windowMetrics.length - 1].heapUsed;
    const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB

    if (memoryIncrease > this.thresholds.leakThresholdMB) {
      const alert: MemoryAlert = {
        type: 'leak_detected',
        message: `Potential memory leak detected: ${memoryIncrease.toFixed(2)}MB increase over ${this.thresholds.leakDetectionWindow / 1000}s`,
        metrics: windowMetrics[windowMetrics.length - 1],
        timestamp: now,
        severity: memoryIncrease > this.thresholds.leakThresholdMB * 2 ? 'critical' : 'high'
      };

      this.emitAlert(alert);
    }
  }

  /**
   * Check memory thresholds
   */
  private checkThresholds(): void {
    if (this.metrics.length === 0) return;

    const current = this.metrics[this.metrics.length - 1];
    const heapUsedMB = current.heapUsed / 1024 / 1024;
    const rssMB = current.rss / 1024 / 1024;

    // Check critical threshold
    if (heapUsedMB > this.thresholds.criticalMB || rssMB > this.thresholds.criticalMB * 1.5) {
      const alert: MemoryAlert = {
        type: 'critical',
        message: `Critical memory usage: Heap ${heapUsedMB.toFixed(2)}MB, RSS ${rssMB.toFixed(2)}MB`,
        metrics: current,
        timestamp: Date.now(),
        severity: 'critical'
      };

      this.emitAlert(alert);
      this.triggerEmergencyGC();
    }
    // Check warning threshold
    else if (heapUsedMB > this.thresholds.warningMB || current.heapUtilization > this.thresholds.heapUtilization) {
      const alert: MemoryAlert = {
        type: 'warning',
        message: `High memory usage: Heap ${heapUsedMB.toFixed(2)}MB (${(current.heapUtilization * 100).toFixed(1)}% utilization)`,
        metrics: current,
        timestamp: Date.now(),
        severity: 'medium'
      };

      this.emitAlert(alert);
    }
  }

  /**
   * Setup garbage collection monitoring
   */
  private setupGCMonitoring(): void {
    try {
      // Use performance hooks to monitor GC
      const { PerformanceObserver, performance } = require('perf_hooks');
      
      this.gcObserver = new PerformanceObserver((list: any) => {
        const entries = list.getEntries();
        
        for (const entry of entries) {
          if (entry.entryType === 'gc') {
            const gcMetric: GCMetrics = {
              gcCount: 1,
              gcTime: entry.duration,
              gcType: entry.detail?.kind || 'unknown',
              timestamp: Date.now()
            };

            this.gcMetrics.push(gcMetric);

            // Keep only recent GC metrics
            if (this.gcMetrics.length > 100) {
              this.gcMetrics = this.gcMetrics.slice(-100);
            }

            // Check for GC pressure
            this.checkGCPressure();

            this.emit('gc_event', gcMetric);
          }
        }
      });

      this.gcObserver.observe({ entryTypes: ['gc'] });
      
    } catch (error) {
      logger.warn('GC monitoring not available', error);
    }
  }

  /**
   * Check for garbage collection pressure
   */
  private checkGCPressure(): void {
    if (this.gcMetrics.length < 10) return;

    const recent = this.gcMetrics.slice(-10);
    const totalGCTime = recent.reduce((sum, gc) => sum + gc.gcTime, 0);
    const avgGCTime = totalGCTime / recent.length;

    // If average GC time is high, we have GC pressure
    if (avgGCTime > 50) { // 50ms average GC time
      const alert: MemoryAlert = {
        type: 'gc_pressure',
        message: `High GC pressure detected: ${avgGCTime.toFixed(2)}ms average GC time`,
        metrics: this.metrics[this.metrics.length - 1],
        timestamp: Date.now(),
        severity: avgGCTime > 100 ? 'high' : 'medium'
      };

      this.emitAlert(alert);
    }
  }

  /**
   * Trigger emergency garbage collection
   */
  private triggerEmergencyGC(): void {
    try {
      if (global.gc) {
        logger.warn('🚨 Triggering emergency garbage collection');
        global.gc();
        
        // Collect metrics after GC
        setTimeout(() => {
          this.collectMetrics();
        }, 1000);
      } else {
        logger.warn('⚠️ Garbage collection not available (run with --expose-gc)');
      }
    } catch (error) {
      logger.error('Failed to trigger garbage collection', error);
    }
  }

  /**
   * Emit memory alert
   */
  private emitAlert(alert: MemoryAlert): void {
    this.alertHistory.push(alert);

    // Keep alert history manageable
    if (this.alertHistory.length > 100) {
      this.alertHistory = this.alertHistory.slice(-100);
    }

    logger.warn(`🚨 Memory Alert: ${alert.message}`, {
      type: alert.type,
      severity: alert.severity,
      heapUsedMB: (alert.metrics.heapUsed / 1024 / 1024).toFixed(2),
      heapUtilization: (alert.metrics.heapUtilization * 100).toFixed(1) + '%'
    });

    this.emit('memory_alert', alert);
  }

  /**
   * Calculate trend from data points
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squared indices

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope / (sumY / n); // Normalize by average value
  }

  /**
   * Get current memory status
   */
  getCurrentStatus(): {
    metrics: MemoryMetrics | null;
    alerts: MemoryAlert[];
    gcMetrics: GCMetrics[];
    isHealthy: boolean;
  } {
    const current = this.metrics[this.metrics.length - 1] || null;
    const recentAlerts = this.alertHistory.slice(-10);
    const recentGC = this.gcMetrics.slice(-10);
    
    const isHealthy = current ? 
      (current.heapUsed / 1024 / 1024) < this.thresholds.warningMB &&
      current.heapUtilization < this.thresholds.heapUtilization : false;

    return {
      metrics: current,
      alerts: recentAlerts,
      gcMetrics: recentGC,
      isHealthy
    };
  }

  /**
   * Get memory statistics
   */
  getStatistics(): {
    avgHeapUsageMB: number;
    peakHeapUsageMB: number;
    avgHeapUtilization: number;
    totalAlerts: number;
    totalGCEvents: number;
    avgGCTime: number;
  } {
    if (this.metrics.length === 0) {
      return {
        avgHeapUsageMB: 0,
        peakHeapUsageMB: 0,
        avgHeapUtilization: 0,
        totalAlerts: 0,
        totalGCEvents: 0,
        avgGCTime: 0
      };
    }

    const heapUsages = this.metrics.map(m => m.heapUsed / 1024 / 1024);
    const utilizations = this.metrics.map(m => m.heapUtilization);
    const gcTimes = this.gcMetrics.map(gc => gc.gcTime);

    return {
      avgHeapUsageMB: heapUsages.reduce((sum, val) => sum + val, 0) / heapUsages.length,
      peakHeapUsageMB: Math.max(...heapUsages),
      avgHeapUtilization: utilizations.reduce((sum, val) => sum + val, 0) / utilizations.length,
      totalAlerts: this.alertHistory.length,
      totalGCEvents: this.gcMetrics.length,
      avgGCTime: gcTimes.length > 0 ? gcTimes.reduce((sum, val) => sum + val, 0) / gcTimes.length : 0
    };
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): boolean {
    try {
      if (global.gc) {
        global.gc();
        logger.info('🗑️ Manual garbage collection triggered');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to force garbage collection', error);
      return false;
    }
  }

  /**
   * Generate memory report
   */
  generateReport(): string {
    const status = this.getCurrentStatus();
    const stats = this.getStatistics();

    return `
Memory Monitor Report
====================
Current Status: ${status.isHealthy ? '✅ Healthy' : '⚠️ Issues Detected'}

Current Metrics:
- Heap Used: ${status.metrics ? (status.metrics.heapUsed / 1024 / 1024).toFixed(2) : 'N/A'}MB
- Heap Utilization: ${status.metrics ? (status.metrics.heapUtilization * 100).toFixed(1) : 'N/A'}%
- RSS: ${status.metrics ? (status.metrics.rss / 1024 / 1024).toFixed(2) : 'N/A'}MB

Statistics:
- Average Heap Usage: ${stats.avgHeapUsageMB.toFixed(2)}MB
- Peak Heap Usage: ${stats.peakHeapUsageMB.toFixed(2)}MB
- Average Heap Utilization: ${(stats.avgHeapUtilization * 100).toFixed(1)}%
- Total Alerts: ${stats.totalAlerts}
- Total GC Events: ${stats.totalGCEvents}
- Average GC Time: ${stats.avgGCTime.toFixed(2)}ms

Recent Alerts: ${status.alerts.length}
Recent GC Events: ${status.gcMetrics.length}
    `.trim();
  }
}

// Export singleton instance
let memoryMonitor: MemoryMonitor | null = null;

export function initializeMemoryMonitor(thresholds?: Partial<MemoryThresholds>): MemoryMonitor {
  if (!memoryMonitor) {
    memoryMonitor = new MemoryMonitor(thresholds);
  }
  return memoryMonitor;
}

export function getMemoryMonitor(): MemoryMonitor | null {
  return memoryMonitor;
}
