"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BottleneckDetector = void 0;
class BottleneckDetector {
    constructor(logger) {
        this.detectionHistory = new Map();
        this.logger = logger;
        // Performance thresholds
        this.thresholds = {
            cpu: { warning: 0.7, critical: 0.9 },
            memory: { warning: 0.8, critical: 0.95 },
            disk: { warning: 0.8, critical: 0.95 },
            network: { warning: 100, critical: 300 }, // ms
            database: { warning: 200, critical: 500 }, // ms
            cache: { warning: 0.6, critical: 0.4 }, // hit rate (lower is worse)
            errorRate: { warning: 0.05, critical: 0.1 },
            throughput: { warning: 10, critical: 5 } // requests/sec (lower is worse)
        };
    }
    async initialize() {
        this.logger.info('🔍 Initializing BottleneckDetector');
        this.logger.info('✅ BottleneckDetector initialized');
    }
    async detectBottlenecks(metrics) {
        const bottlenecks = [];
        const timestamp = new Date();
        // CPU bottleneck detection
        if (metrics.cpu >= this.thresholds.cpu.warning) {
            const bottleneck = this.createBottleneck('cpu', metrics.cpu, timestamp, {
                currentUsage: metrics.cpu,
                threshold: this.thresholds.cpu.warning
            });
            bottlenecks.push(bottleneck);
        }
        // Memory bottleneck detection
        if (metrics.memory >= this.thresholds.memory.warning) {
            const bottleneck = this.createBottleneck('memory', metrics.memory, timestamp, {
                currentUsage: metrics.memory,
                threshold: this.thresholds.memory.warning
            });
            bottlenecks.push(bottleneck);
        }
        // Disk bottleneck detection
        if (metrics.disk >= this.thresholds.disk.warning) {
            const bottleneck = this.createBottleneck('disk', metrics.disk, timestamp, {
                currentUsage: metrics.disk,
                threshold: this.thresholds.disk.warning
            });
            bottlenecks.push(bottleneck);
        }
        // Network bottleneck detection
        if (metrics.network >= this.thresholds.network.warning) {
            const bottleneck = this.createBottleneck('network', metrics.network, timestamp, {
                currentLatency: metrics.network,
                threshold: this.thresholds.network.warning
            });
            bottlenecks.push(bottleneck);
        }
        // Database bottleneck detection
        if (metrics.database >= this.thresholds.database.warning) {
            const bottleneck = this.createBottleneck('database', metrics.database, timestamp, {
                currentQueryTime: metrics.database,
                threshold: this.thresholds.database.warning
            });
            bottlenecks.push(bottleneck);
        }
        // Cache bottleneck detection (inverse logic - lower is worse)
        if (metrics.cache <= this.thresholds.cache.critical) {
            const bottleneck = this.createBottleneck('cache', metrics.cache, timestamp, {
                currentHitRate: metrics.cache,
                threshold: this.thresholds.cache.warning
            });
            bottlenecks.push(bottleneck);
        }
        // Error rate bottleneck detection
        if (metrics.errorRate >= this.thresholds.errorRate.warning) {
            const bottleneck = this.createBottleneck('agent', metrics.errorRate, timestamp, {
                currentErrorRate: metrics.errorRate,
                threshold: this.thresholds.errorRate.warning
            });
            bottleneck.component = 'error_handling';
            bottleneck.description = `High error rate detected: ${(metrics.errorRate * 100).toFixed(2)}%`;
            bottlenecks.push(bottleneck);
        }
        // Throughput bottleneck detection (inverse logic - lower is worse)
        if (metrics.throughput <= this.thresholds.throughput.critical) {
            const bottleneck = this.createBottleneck('agent', metrics.throughput, timestamp, {
                currentThroughput: metrics.throughput,
                threshold: this.thresholds.throughput.warning
            });
            bottleneck.component = 'throughput';
            bottleneck.description = `Low throughput detected: ${metrics.throughput.toFixed(1)} req/s`;
            bottlenecks.push(bottleneck);
        }
        // Composite bottleneck detection (multiple metrics)
        const compositeBottleneck = this.detectCompositeBottlenecks(metrics, timestamp);
        if (compositeBottleneck) {
            bottlenecks.push(compositeBottleneck);
        }
        // Update detection history
        for (const bottleneck of bottlenecks) {
            this.detectionHistory.set(bottleneck.id, timestamp);
        }
        return bottlenecks;
    }
    createBottleneck(type, value, timestamp, metrics) {
        const threshold = this.thresholds[type];
        const severity = this.determineSeverity(type, value, threshold);
        const impact = this.calculateImpact(type, value, threshold);
        return {
            id: `${type}_bottleneck_${timestamp.getTime()}`,
            type,
            severity,
            component: type,
            description: this.generateDescription(type, value, severity),
            impact,
            detectedAt: timestamp,
            metrics,
            recommendations: this.generateRecommendations(type, severity, value)
        };
    }
    determineSeverity(type, value, threshold) {
        // Special handling for inverse metrics (cache hit rate, throughput)
        if (type === 'cache' || type === 'throughput') {
            if (value <= threshold.critical)
                return 'critical';
            if (value <= threshold.warning)
                return 'high';
            return 'medium';
        }
        // Normal metrics (higher is worse)
        if (value >= threshold.critical)
            return 'critical';
        if (value >= threshold.warning)
            return 'high';
        if (value >= threshold.warning * 0.8)
            return 'medium';
        return 'low';
    }
    calculateImpact(type, value, threshold) {
        // Impact scale: 0-1 where 1 is maximum impact
        let impact;
        if (type === 'cache' || type === 'throughput') {
            // Inverse metrics
            const normalizedValue = Math.max(0, Math.min(1, value / threshold.warning));
            impact = 1 - normalizedValue;
        }
        else {
            // Normal metrics
            const normalizedValue = Math.min(1, value / threshold.critical);
            impact = normalizedValue;
        }
        // Apply type-specific impact multipliers
        const impactMultipliers = {
            cpu: 0.9,
            memory: 1.0,
            disk: 0.7,
            network: 0.6,
            database: 0.8,
            cache: 0.5,
            errorRate: 1.0,
            throughput: 0.8
        };
        return Math.min(1, impact * (impactMultipliers[type] || 1.0));
    }
    generateDescription(type, value, severity) {
        const descriptions = {
            cpu: (v, s) => `High CPU usage detected: ${(v * 100).toFixed(1)}% (${s} level)`,
            memory: (v, s) => `High memory usage detected: ${(v * 100).toFixed(1)}% (${s} level)`,
            disk: (v, s) => `High disk usage detected: ${(v * 100).toFixed(1)}% (${s} level)`,
            network: (v, s) => `High network latency detected: ${v.toFixed(1)}ms (${s} level)`,
            database: (v, s) => `Slow database queries detected: ${v.toFixed(1)}ms avg (${s} level)`,
            cache: (v, s) => `Low cache hit rate detected: ${(v * 100).toFixed(1)}% (${s} level)`,
            errorRate: (v, s) => `High error rate detected: ${(v * 100).toFixed(2)}% (${s} level)`,
            throughput: (v, s) => `Low throughput detected: ${v.toFixed(1)} req/s (${s} level)`
        };
        const generator = descriptions[type];
        return generator ? generator(value, severity) : `Performance issue in ${type}: ${value}`;
    }
    generateRecommendations(type, severity, _value) {
        const recommendationMap = {
            cpu: [
                'Consider optimizing CPU-intensive operations',
                'Review process scheduling and worker allocation',
                'Implement CPU throttling or load balancing',
                'Scale horizontally to distribute CPU load'
            ],
            memory: [
                'Force garbage collection to free up memory',
                'Review memory leaks in application code',
                'Optimize data structures and caching strategies',
                'Consider increasing available memory or scaling'
            ],
            disk: [
                'Clean up temporary files and logs',
                'Optimize disk I/O operations',
                'Consider using faster storage (SSD)',
                'Implement data compression or archiving'
            ],
            network: [
                'Optimize network connection pooling',
                'Enable compression for data transfers',
                'Review DNS resolution times',
                'Consider CDN or edge computing solutions'
            ],
            database: [
                'Optimize slow queries and add indexes',
                'Review connection pool settings',
                'Enable query caching',
                'Consider database scaling or sharding'
            ],
            cache: [
                'Review cache key strategies and TTL settings',
                'Increase cache memory allocation',
                'Optimize cache invalidation policies',
                'Consider distributed caching solutions'
            ],
            errorRate: [
                'Review error logs to identify root causes',
                'Implement better error handling and retries',
                'Add circuit breakers for external services',
                'Improve input validation and sanitization'
            ],
            throughput: [
                'Optimize request processing pipeline',
                'Review bottlenecks in application logic',
                'Implement asynchronous processing',
                'Consider horizontal scaling or load balancing'
            ]
        };
        const baseRecommendations = recommendationMap[type] || ['Review performance metrics and optimize accordingly'];
        // Add severity-specific recommendations
        if (severity === 'critical') {
            return [
                'URGENT: Immediate action required',
                ...baseRecommendations,
                'Consider emergency scaling or failover procedures'
            ];
        }
        return baseRecommendations;
    }
    detectCompositeBottlenecks(metrics, timestamp) {
        // Detect system-wide performance degradation
        const degradationScore = this.calculateSystemDegradationScore(metrics);
        if (degradationScore >= 0.7) {
            return {
                id: `system_degradation_${timestamp.getTime()}`,
                type: 'agent',
                severity: degradationScore >= 0.9 ? 'critical' : 'high',
                component: 'system',
                description: `System-wide performance degradation detected (score: ${(degradationScore * 100).toFixed(1)}%)`,
                impact: degradationScore,
                detectedAt: timestamp,
                metrics: {
                    degradationScore,
                    cpuUsage: metrics.cpu,
                    memoryUsage: metrics.memory,
                    errorRate: metrics.errorRate
                },
                recommendations: [
                    'Review all system components for performance issues',
                    'Consider emergency scaling procedures',
                    'Implement comprehensive monitoring and alerting',
                    'Prepare for potential system failover'
                ]
            };
        }
        return null;
    }
    calculateSystemDegradationScore(metrics) {
        let professional_score = 0;
        let factorCount = 0;
        // CPU factor
        if (metrics.cpu >= this.thresholds.cpu.warning) {
            professional_score += Math.min(1, metrics.cpu / this.thresholds.cpu.critical) * 0.2;
            factorCount++;
        }
        // Memory factor
        if (metrics.memory >= this.thresholds.memory.warning) {
            professional_score += Math.min(1, metrics.memory / this.thresholds.memory.critical) * 0.2;
            factorCount++;
        }
        // Error rate factor
        if (metrics.errorRate >= this.thresholds.errorRate.warning) {
            professional_score += Math.min(1, metrics.errorRate / this.thresholds.errorRate.critical) * 0.3;
            factorCount++;
        }
        // Database factor
        if (metrics.database >= this.thresholds.database.warning) {
            professional_score += Math.min(1, metrics.database / this.thresholds.database.critical) * 0.15;
            factorCount++;
        }
        // Cache factor (inverse)
        if (metrics.cache <= this.thresholds.cache.warning) {
            professional_score += (1 - Math.max(0, metrics.cache / this.thresholds.cache.warning)) * 0.15;
            factorCount++;
        }
        // Amplify professional_score if multiple factors are present
        if (factorCount >= 3) {
            professional_score *= 1.2; // 20% amplification for multiple issues
        }
        return Math.min(1, professional_score);
    }
    async isHealthy() {
        return true; // BottleneckDetector is always considered healthy
    }
    async cleanup() {
        // Clean up old detection history (keep last 24 hours)
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        for (const [id, detectionTime] of this.detectionHistory) {
            if (detectionTime < cutoffTime) {
                this.detectionHistory.delete(id);
            }
        }
        this.logger.info('🧹 BottleneckDetector cleanup completed');
    }
}
exports.BottleneckDetector = BottleneckDetector;
