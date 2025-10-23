/**
 * Advanced Memory Monitor and Leak Detection System
 * Comprehensive memory monitoring with leak detection, alerts, and automatic remediation
 * Production-ready memory management for Node.js applications
 */
import { EventEmitter } from 'events';
export interface MemoryMetrics {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
    timestamp: number;
    heapUtilization: number;
}
export interface MemoryThresholds {
    warningMB: number;
    criticalMB: number;
    heapUtilization: number;
    leakDetectionWindow: number;
    leakThresholdMB: number;
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
export declare class MemoryMonitor extends EventEmitter {
    private metrics;
    private gcMetrics;
    private thresholds;
    private monitoringInterval?;
    private gcObserver?;
    private isMonitoring;
    private alertHistory;
    private maxHistorySize;
    constructor(thresholds?: Partial<MemoryThresholds>);
    /**
     * Start memory monitoring
     */
    start(intervalMs?: number): void;
    /**
     * Stop memory monitoring
     */
    stop(): void;
    /**
     * Collect current memory metrics
     */
    private collectMetrics;
    /**
     * Analyze memory trends
     */
    private analyzeMemoryTrends;
    /**
     * Detect potential memory leaks
     */
    private detectMemoryLeaks;
    /**
     * Check memory thresholds
     */
    private checkThresholds;
    /**
     * Setup garbage collection monitoring
     */
    private setupGCMonitoring;
    /**
     * Check for garbage collection pressure
     */
    private checkGCPressure;
    /**
     * Trigger emergency garbage collection
     */
    private triggerEmergencyGC;
    /**
     * Emit memory alert
     */
    private emitAlert;
    /**
     * Calculate trend from data points
     */
    private calculateTrend;
    /**
     * Get current memory status
     */
    getCurrentStatus(): {
        metrics: MemoryMetrics | null;
        alerts: MemoryAlert[];
        gcMetrics: GCMetrics[];
        isHealthy: boolean;
    };
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
    };
    /**
     * Force garbage collection (if available)
     */
    forceGC(): boolean;
    /**
     * Generate memory report
     */
    generateReport(): string;
}
export declare function initializeMemoryMonitor(thresholds?: Partial<MemoryThresholds>): MemoryMonitor;
export declare function getMemoryMonitor(): MemoryMonitor | null;
//# sourceMappingURL=memoryMonitor.d.ts.map