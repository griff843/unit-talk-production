"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceManager = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
class ResourceManager {
    constructor(logger) {
        this.resourceTrends = new Map();
        this.predictionHistory = new Map();
        this.logger = logger;
        // Resource usage thresholds
        this.resourceThresholds = {
            cpu: { warning: 0.7, critical: 0.9 },
            memory: { warning: 0.8, critical: 0.95 },
            disk: { warning: 0.8, critical: 0.95 },
            network: { warning: 100, critical: 300 }, // ms latency
            connections: { warning: 80, critical: 95 }, // % of max connections
            cache: { warning: 0.8, critical: 0.95 }, // memory usage
            queue: { warning: 100, critical: 500 } // queue length
        };
    }
    async initialize() {
        this.logger.info('🔮 Initializing ResourceManager');
        await this.loadResourceTrends();
        await this.loadPredictionHistory();
        this.logger.info('✅ ResourceManager initialized');
    }
    async generatePredictions(context) {
        const predictions = [];
        const resources = ['cpu', 'memory', 'disk', 'network', 'cache'];
        for (const resource of resources) {
            for (const timeHorizon of context.timeHorizons) {
                const prediction = await this.predictResourceUsage(resource, timeHorizon, context);
                if (prediction) {
                    predictions.push(prediction);
                }
            }
        }
        // Update prediction history
        await this.updatePredictionHistory(predictions);
        return predictions;
    }
    async predictResourceUsage(resource, timeHorizon, context) {
        try {
            const currentUsage = this.getCurrentResourceUsage(resource, context.currentMetrics);
            const trend = await this.calculateResourceTrend(resource, context.historicalData);
            // Simple linear prediction based on trend
            const trendRate = trend.rate / 60; // Convert to per-minute rate
            const predictedUsage = Math.max(0, Math.min(1, currentUsage + (trendRate * timeHorizon)));
            // Calculate confidence based on trend stability and data availability
            const confidence = this.calculatePredictionConfidence(trend, context.historicalData.length);
            const thresholds = this.resourceThresholds[resource] || { warning: 0.8, critical: 0.9 };
            return {
                resource,
                currentUsage,
                predictedUsage,
                timeHorizon,
                confidence,
                warningThreshold: thresholds.warning,
                criticalThreshold: thresholds.critical
            };
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to predict resource usage', {
                resource,
                timeHorizon,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    getCurrentResourceUsage(resource, metrics) {
        const resourceMap = {
            cpu: 'systemCpuUsage',
            memory: 'systemMemoryUsage',
            disk: 'systemDiskUsage',
            network: 'networkLatency',
            cache: 'cacheHitRate'
        };
        const metricKey = resourceMap[resource];
        if (!metricKey || metrics[metricKey] === undefined) {
            return 0.5; // Default usage if metric not available
        }
        let usage = metrics[metricKey];
        // Normalize different metric types to 0-1 scale
        switch (resource) {
            case 'network':
                // Convert latency to usage scale (0ms = 0, 500ms = 1)
                usage = Math.min(1, usage / 500);
                break;
            case 'cache':
                // Cache hit rate is inverse (1 = good, 0 = bad), so invert for usage
                usage = 1 - usage;
                break;
            default:
                // CPU, memory, disk are already 0-1 scale
                break;
        }
        return Math.max(0, Math.min(1, usage));
    }
    async calculateResourceTrend(resource, historicalData) {
        if (historicalData.length < 2) {
            return {
                resource,
                direction: 'stable',
                rate: 0,
                confidence: 0.1,
                lastUpdated: new Date()
            };
        }
        // Extract resource values from historical data
        const values = historicalData
            .map(data => this.getCurrentResourceUsage(resource, data))
            .filter(value => value !== undefined);
        if (values.length < 2) {
            return {
                resource,
                direction: 'stable',
                rate: 0,
                confidence: 0.1,
                lastUpdated: new Date()
            };
        }
        // Calculate linear regression to determine trend
        const { slope, rSquared } = this.calculateLinearRegression(values);
        // Determine direction and rate
        const direction = slope > 0.001 ? 'increasing' : slope < -0.001 ? 'decreasing' : 'stable';
        const rate = Math.abs(slope) * 100; // Convert to percentage per time unit
        const confidence = Math.max(0.1, Math.min(1, rSquared));
        const trend = {
            resource,
            direction,
            rate,
            confidence,
            lastUpdated: new Date()
        };
        // Store trend for future reference
        this.resourceTrends.set(resource, trend);
        return trend;
    }
    calculateLinearRegression(values) {
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);
        // Calculate means
        const xMean = x.reduce((sum, val) => sum + val, 0) / n;
        const yMean = values.reduce((sum, val) => sum + val, 0) / n;
        // Calculate slope and correlation
        let numerator = 0;
        let denominatorX = 0;
        let denominatorY = 0;
        for (let i = 0; i < n; i++) {
            const xDiff = x[i] - xMean;
            const yDiff = values[i] - yMean;
            numerator += xDiff * yDiff;
            denominatorX += xDiff * xDiff;
            denominatorY += yDiff * yDiff;
        }
        const slope = denominatorX !== 0 ? numerator / denominatorX : 0;
        const correlation = (denominatorX !== 0 && denominatorY !== 0) ?
            numerator / Math.sqrt(denominatorX * denominatorY) : 0;
        const rSquared = correlation * correlation;
        return { slope, rSquared };
    }
    calculatePredictionConfidence(trend, dataPoints) {
        let confidence = trend.confidence;
        // Adjust confidence based on data availability
        if (dataPoints < 10) {
            confidence *= 0.5; // Reduce confidence with limited data
        }
        else if (dataPoints > 50) {
            confidence = Math.min(1, confidence * 1.1); // Increase confidence with more data
        }
        // Adjust confidence based on trend stability
        if (trend.direction === 'stable') {
            confidence *= 0.8; // Stable trends are easier to predict
        }
        else if (trend.rate > 0.1) {
            confidence *= 0.7; // High rate of change reduces confidence
        }
        return Math.max(0.1, Math.min(1, confidence));
    }
    async assessResourceHealth() {
        const healthStatus = {};
        for (const [resource, _trend] of this.resourceTrends) {
            const threshold = this.resourceThresholds[resource];
            if (!threshold)
                continue;
            // Get recent predictions for this resource
            const recentPredictions = this.predictionHistory.get(resource) || [];
            const shortTermPrediction = recentPredictions.find(p => p.timeHorizon <= 60); // 1 hour
            if (shortTermPrediction) {
                if (shortTermPrediction.predictedUsage >= threshold.critical) {
                    healthStatus[resource] = 'critical';
                }
                else if (shortTermPrediction.predictedUsage >= threshold.warning) {
                    healthStatus[resource] = 'warning';
                }
                else {
                    healthStatus[resource] = 'healthy';
                }
            }
            else {
                healthStatus[resource] = 'healthy'; // Default if no prediction available
            }
        }
        return healthStatus;
    }
    async getResourceTrends() {
        return Array.from(this.resourceTrends.values());
    }
    async optimizeResourceAllocation(_constraints) {
        // Simple resource allocation optimization
        const allocation = {};
        const resources = ['cpu', 'memory', 'disk', 'network'];
        // Get current trends
        const trends = await this.getResourceTrends();
        for (const resource of resources) {
            const trend = trends.find(t => t.resource === resource);
            const baseAllocation = 0.5; // 50% base allocation
            if (trend) {
                if (trend.direction === 'increasing' && trend.rate > 0.05) {
                    // Increase allocation for increasing usage
                    allocation[resource] = Math.min(0.8, baseAllocation + trend.rate);
                }
                else if (trend.direction === 'decreasing' && trend.rate > 0.05) {
                    // Decrease allocation for decreasing usage
                    allocation[resource] = Math.max(0.2, baseAllocation - trend.rate);
                }
                else {
                    // Stable usage
                    allocation[resource] = baseAllocation;
                }
            }
            else {
                allocation[resource] = baseAllocation;
            }
        }
        return allocation;
    }
    async updatePredictionHistory(predictions) {
        for (const prediction of predictions) {
            const history = this.predictionHistory.get(prediction.resource) || [];
            history.push(prediction);
            // Keep only recent predictions (last 24 hours worth)
            const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
            const filteredHistory = history.filter(p => {
                // Assuming predictions have implicit timestamps
                return Date.now() - (p.timeHorizon * 60 * 1000) > cutoffTime;
            });
            // Keep maximum 100 predictions per resource
            if (filteredHistory.length > 100) {
                filteredHistory.splice(0, filteredHistory.length - 100);
            }
            this.predictionHistory.set(prediction.resource, filteredHistory);
        }
    }
    async loadResourceTrends() {
        try {
            const cached = await enhanced_cache_1.redisCache.getPattern('resource_manager:trend:*');
            for (const [key, data] of cached) {
                const resource = key.split(':').pop();
                if (resource) {
                    const trend = JSON.parse(data);
                    trend.lastUpdated = new Date(trend.lastUpdated);
                    this.resourceTrends.set(resource, trend);
                }
            }
            this.logger.info(`📊 Loaded trends for ${this.resourceTrends.size} resources`);
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load resource trends');
        }
    }
    async loadPredictionHistory() {
        try {
            const cached = await enhanced_cache_1.redisCache.getPattern('resource_manager:predictions:*');
            for (const [key, data] of cached) {
                const resource = key.split(':').pop();
                if (resource) {
                    this.predictionHistory.set(resource, JSON.parse(data));
                }
            }
            this.logger.info(`📊 Loaded prediction history for ${this.predictionHistory.size} resources`);
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load prediction history');
        }
    }
    async isHealthy() {
        return this.resourceTrends.size >= 0; // Always healthy
    }
    async cleanup() {
        // Save resource trends
        for (const [resource, trend] of this.resourceTrends) {
            await enhanced_cache_1.redisCache.set(`resource_manager:trend:${resource}`, JSON.stringify(trend), 86400 // 24 hours TTL
            );
        }
        // Save prediction history
        for (const [resource, history] of this.predictionHistory) {
            await enhanced_cache_1.redisCache.set(`resource_manager:predictions:${resource}`, JSON.stringify(history.slice(-50)), // Keep last 50 predictions
            86400 // 24 hours TTL
            );
        }
        this.resourceTrends.clear();
        this.predictionHistory.clear();
        this.logger.info('🧹 ResourceManager cleanup completed');
    }
}
exports.ResourceManager = ResourceManager;
