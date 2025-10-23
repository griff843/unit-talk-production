"use strict";
/**
 * Advanced Memory Monitor and Leak Detection System
 * Comprehensive memory monitoring with leak detection, alerts, and automatic remediation
 * Production-ready memory management for Node.js applications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryMonitor = void 0;
exports.initializeMemoryMonitor = initializeMemoryMonitor;
exports.getMemoryMonitor = getMemoryMonitor;
const logger_1 = require("../utils/logger");
const events_1 = require("events");
const logger = (0, logger_1.createLogger)('MemoryMonitor');
class MemoryMonitor extends events_1.EventEmitter {
    constructor(thresholds = {}) {
        super();
        this.metrics = [];
        this.gcMetrics = [];
        this.isMonitoring = false;
        this.alertHistory = [];
        this.maxHistorySize = 1000;
        this.thresholds = {
            warningMB: 512, // 512MB warning
            criticalMB: 1024, // 1GB critical
            heapUtilization: 0.85, // 85% heap utilization
            leakDetectionWindow: 5 * 60 * 1000, // 5 minutes
            leakThresholdMB: 50, // 50MB increase = potential leak
            ...thresholds
        };
        this.setupGCMonitoring();
    }
    /**
     * Start memory monitoring
     */
    start(intervalMs = 30000) {
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
    stop() {
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
    collectMetrics() {
        const memUsage = process.memoryUsage();
        const metrics = {
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
    analyzeMemoryTrends() {
        if (this.metrics.length < 10)
            return; // Need at least 10 data points
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
    detectMemoryLeaks() {
        if (this.metrics.length < 2)
            return;
        const now = Date.now();
        const windowStart = now - this.thresholds.leakDetectionWindow;
        // Get metrics within the detection window
        const windowMetrics = this.metrics.filter(m => m.timestamp >= windowStart);
        if (windowMetrics.length < 2)
            return;
        const startMemory = windowMetrics[0].heapUsed;
        const endMemory = windowMetrics[windowMetrics.length - 1].heapUsed;
        const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB
        if (memoryIncrease > this.thresholds.leakThresholdMB) {
            const alert = {
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
    checkThresholds() {
        if (this.metrics.length === 0)
            return;
        const current = this.metrics[this.metrics.length - 1];
        const heapUsedMB = current.heapUsed / 1024 / 1024;
        const rssMB = current.rss / 1024 / 1024;
        // Check critical threshold
        if (heapUsedMB > this.thresholds.criticalMB || rssMB > this.thresholds.criticalMB * 1.5) {
            const alert = {
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
            const alert = {
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
    setupGCMonitoring() {
        try {
            // Use performance hooks to monitor GC
            const { PerformanceObserver, performance } = require('perf_hooks');
            this.gcObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                for (const entry of entries) {
                    if (entry.entryType === 'gc') {
                        const gcMetric = {
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
        }
        catch (error) {
            logger.warn('GC monitoring not available', error);
        }
    }
    /**
     * Check for garbage collection pressure
     */
    checkGCPressure() {
        if (this.gcMetrics.length < 10)
            return;
        const recent = this.gcMetrics.slice(-10);
        const totalGCTime = recent.reduce((sum, gc) => sum + gc.gcTime, 0);
        const avgGCTime = totalGCTime / recent.length;
        // If average GC time is high, we have GC pressure
        if (avgGCTime > 50) { // 50ms average GC time
            const alert = {
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
    triggerEmergencyGC() {
        try {
            if (global.gc) {
                logger.warn('🚨 Triggering emergency garbage collection');
                global.gc();
                // Collect metrics after GC
                setTimeout(() => {
                    this.collectMetrics();
                }, 1000);
            }
            else {
                logger.warn('⚠️ Garbage collection not available (run with --expose-gc)');
            }
        }
        catch (error) {
            logger.error('Failed to trigger garbage collection', error);
        }
    }
    /**
     * Emit memory alert
     */
    emitAlert(alert) {
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
    calculateTrend(values) {
        if (values.length < 2)
            return 0;
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
    getCurrentStatus() {
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
    getStatistics() {
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
    forceGC() {
        try {
            if (global.gc) {
                global.gc();
                logger.info('🗑️ Manual garbage collection triggered');
                return true;
            }
            return false;
        }
        catch (error) {
            logger.error('Failed to force garbage collection', error);
            return false;
        }
    }
    /**
     * Generate memory report
     */
    generateReport() {
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
exports.MemoryMonitor = MemoryMonitor;
// Export singleton instance
let memoryMonitor = null;
function initializeMemoryMonitor(thresholds) {
    if (!memoryMonitor) {
        memoryMonitor = new MemoryMonitor(thresholds);
    }
    return memoryMonitor;
}
function getMemoryMonitor() {
    return memoryMonitor;
}
