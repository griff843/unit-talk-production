"use strict";
/**
 * Material Change Detection System
 *
 * Monitors for material changes that require immediate re-scoring of props.
 * Implements sophisticated change detection algorithms with thresholds,
 * state management, and audit trails. Designed for 30-second response times
 * to material events affecting 8K+ simultaneous props.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterialChangeDetector = exports.MaterialChangeType = void 0;
const events_1 = require("events");
const logger_1 = require("../../../utils/logger");
var MaterialChangeType;
(function (MaterialChangeType) {
    // Market Changes
    MaterialChangeType["ODDS_SHIFT"] = "odds_shift";
    MaterialChangeType["LINE_MOVEMENT"] = "line_movement";
    MaterialChangeType["STEAM_MOVE"] = "steam_move";
    MaterialChangeType["VOLUME_SPIKE"] = "volume_spike";
    MaterialChangeType["MARKET_SUSPENSION"] = "market_suspension";
    // Player Changes
    MaterialChangeType["INJURY_NEWS"] = "injury_news";
    MaterialChangeType["LINEUP_CHANGE"] = "lineup_change";
    MaterialChangeType["USAGE_CHANGE"] = "usage_change";
    MaterialChangeType["PERFORMANCE_ANOMALY"] = "performance_anomaly";
    // Game Changes
    MaterialChangeType["WEATHER_CHANGE"] = "weather_change";
    MaterialChangeType["VENUE_CHANGE"] = "venue_change";
    MaterialChangeType["OFFICIAL_CHANGE"] = "official_change";
    MaterialChangeType["GAME_TIME_CHANGE"] = "game_time_change";
    // External Factors
    MaterialChangeType["NEWS_BREAK"] = "news_break";
    MaterialChangeType["SUSPENSION"] = "suspension";
    MaterialChangeType["TRADE_NEWS"] = "trade_news";
    // System Changes
    MaterialChangeType["MODEL_UPDATE"] = "model_update";
    MaterialChangeType["DATA_CORRECTION"] = "data_correction";
    MaterialChangeType["CALCULATION_ERROR"] = "calculation_error"; // Detected calculation issues
})(MaterialChangeType || (exports.MaterialChangeType = MaterialChangeType = {}));
class MaterialChangeDetector extends events_1.EventEmitter {
    constructor(featureStore) {
        super();
        this.logger = (0, logger_1.createLogger)('MaterialChangeDetector');
        // State management
        this.propStates = new Map();
        this.changeQueue = [];
        this.processingInterval = null;
        // Configuration
        this.PROCESSING_INTERVAL_MS = 5000; // Process every 5 seconds
        this.MAX_QUEUE_SIZE = 10000;
        this.STATE_CLEANUP_INTERVAL = 3600000; // 1 hour
        // Thresholds by sport and change type
        this.changeThresholds = [
            // NFL Thresholds
            { changeType: MaterialChangeType.ODDS_SHIFT, sport: 'NFL', threshold: 15, timeWindow: 300000, minConfidence: 0.8 },
            { changeType: MaterialChangeType.LINE_MOVEMENT, sport: 'NFL', threshold: 2.5, timeWindow: 300000, minConfidence: 0.7 },
            { changeType: MaterialChangeType.INJURY_NEWS, sport: 'NFL', threshold: 0.1, timeWindow: 1800000, minConfidence: 0.9 },
            { changeType: MaterialChangeType.WEATHER_CHANGE, sport: 'NFL', threshold: 0.3, timeWindow: 3600000, minConfidence: 0.8 },
            // NBA Thresholds
            { changeType: MaterialChangeType.ODDS_SHIFT, sport: 'NBA', threshold: 10, timeWindow: 180000, minConfidence: 0.8 },
            { changeType: MaterialChangeType.LINE_MOVEMENT, sport: 'NBA', threshold: 1.5, timeWindow: 180000, minConfidence: 0.7 },
            { changeType: MaterialChangeType.LINEUP_CHANGE, sport: 'NBA', threshold: 0.1, timeWindow: 900000, minConfidence: 0.9 },
            { changeType: MaterialChangeType.USAGE_CHANGE, sport: 'NBA', threshold: 5.0, timeWindow: 1800000, minConfidence: 0.7 },
            // MLB Thresholds
            { changeType: MaterialChangeType.ODDS_SHIFT, sport: 'MLB', threshold: 12, timeWindow: 300000, minConfidence: 0.8 },
            { changeType: MaterialChangeType.LINE_MOVEMENT, sport: 'MLB', threshold: 0.5, timeWindow: 300000, minConfidence: 0.7 },
            { changeType: MaterialChangeType.WEATHER_CHANGE, sport: 'MLB', threshold: 0.2, timeWindow: 1800000, minConfidence: 0.8 },
            { changeType: MaterialChangeType.LINEUP_CHANGE, sport: 'MLB', threshold: 0.1, timeWindow: 3600000, minConfidence: 0.9 },
            // NHL Thresholds
            { changeType: MaterialChangeType.ODDS_SHIFT, sport: 'NHL', threshold: 12, timeWindow: 240000, minConfidence: 0.8 },
            { changeType: MaterialChangeType.LINE_MOVEMENT, sport: 'NHL', threshold: 1.0, timeWindow: 240000, minConfidence: 0.7 },
            { changeType: MaterialChangeType.INJURY_NEWS, sport: 'NHL', threshold: 0.1, timeWindow: 1800000, minConfidence: 0.9 },
            // Universal Thresholds
            { changeType: MaterialChangeType.STEAM_MOVE, sport: '*', threshold: 0.6, timeWindow: 60000, minConfidence: 0.8 },
            { changeType: MaterialChangeType.VOLUME_SPIKE, sport: '*', threshold: 200, timeWindow: 300000, minConfidence: 0.7 },
            { changeType: MaterialChangeType.MARKET_SUSPENSION, sport: '*', threshold: 0.1, timeWindow: 0, minConfidence: 1.0 },
            { changeType: MaterialChangeType.NEWS_BREAK, sport: '*', threshold: 0.1, timeWindow: 1800000, minConfidence: 0.8 }
        ];
        this.featureStore = featureStore;
        this.startProcessing();
        this.startStateCleanup();
        this.logger.info('MaterialChangeDetector initialized', {
            thresholds: this.changeThresholds.length,
            processingInterval: this.PROCESSING_INTERVAL_MS,
            maxQueueSize: this.MAX_QUEUE_SIZE
        });
    }
    /**
     * Register a prop for change monitoring
     */
    registerProp(propId, sport, watchedFactors = [], initialValues = {}) {
        const state = {
            propId,
            lastValues: initialValues,
            lastUpdate: Date.now(),
            changeHistory: [],
            watchedFactors: watchedFactors.length > 0 ? watchedFactors : this.getDefaultWatchedFactors(sport)
        };
        this.propStates.set(propId, state);
        this.logger.debug('Prop registered for change monitoring', {
            propId,
            sport,
            watchedFactors: state.watchedFactors.length,
            initialValues: Object.keys(initialValues).length
        });
    }
    /**
     * Update prop values and detect changes
     */
    async updatePropValues(propId, newValues, source = 'unknown') {
        const state = this.propStates.get(propId);
        if (!state) {
            this.logger.warn('Attempting to update unregistered prop', { propId });
            return [];
        }
        const detectedChanges = [];
        const now = Date.now();
        // Check each watched factor for material changes
        for (const factor of state.watchedFactors) {
            const oldValue = state.lastValues[factor];
            const newValue = newValues[factor];
            if (oldValue !== undefined && newValue !== undefined) {
                const change = await this.detectMaterialChange(propId, factor, oldValue, newValue, source, now);
                if (change) {
                    detectedChanges.push(change);
                    // Add to change history
                    state.changeHistory.push(change);
                    // Limit history size
                    if (state.changeHistory.length > 50) {
                        state.changeHistory = state.changeHistory.slice(-50);
                    }
                }
            }
        }
        // Update state
        state.lastValues = { ...state.lastValues, ...newValues };
        state.lastUpdate = now;
        // Add changes to processing queue
        if (detectedChanges.length > 0) {
            this.addChangesToQueue(detectedChanges);
            this.logger.info('Material changes detected', {
                propId,
                changesCount: detectedChanges.length,
                changeTypes: detectedChanges.map(c => c.changeType),
                source
            });
        }
        return detectedChanges;
    }
    /**
     * Batch update multiple props
     */
    async batchUpdateProps(updates) {
        const results = new Map();
        // Process updates in parallel for performance
        const updatePromises = updates.map(async ({ propId, newValues, source }) => {
            try {
                const changes = await this.updatePropValues(propId, newValues, source);
                results.set(propId, changes);
            }
            catch (error) {
                this.logger.error('Batch update failed for prop', {
                    propId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                results.set(propId, []);
            }
        });
        await Promise.all(updatePromises);
        this.logger.debug('Batch update completed', {
            propsUpdated: updates.length,
            totalChanges: Array.from(results.values()).flat().length
        });
        return results;
    }
    /**
     * Get change history for a prop
     */
    getChangeHistory(propId, since, changeTypes) {
        const state = this.propStates.get(propId);
        if (!state) {
            return [];
        }
        let history = state.changeHistory;
        // Filter by timestamp if provided
        if (since) {
            history = history.filter(change => change.timestamp >= since);
        }
        // Filter by change types if provided
        if (changeTypes && changeTypes.length > 0) {
            history = history.filter(change => changeTypes.includes(change.changeType));
        }
        return history.sort((a, b) => b.timestamp - a.timestamp);
    }
    /**
     * Get aggregated change statistics
     */
    getChangeStatistics(timeWindow = 3600000 // Default: 1 hour
    ) {
        const since = Date.now() - timeWindow;
        const allChanges = [];
        // Collect all changes from all props
        this.propStates.forEach(state => {
            const recentChanges = state.changeHistory.filter(c => c.timestamp >= since);
            allChanges.push(...recentChanges);
        });
        // Calculate statistics
        const changesByType = {};
        const changesBySeverity = {};
        let totalImpact = 0;
        const affectedProps = new Set();
        allChanges.forEach(change => {
            // Count by type
            changesByType[change.changeType] = (changesByType[change.changeType] || 0) + 1;
            // Count by severity
            changesBySeverity[change.severity] = (changesBySeverity[change.severity] || 0) + 1;
            // Accumulate impact
            totalImpact += change.impact;
            // Track affected props
            affectedProps.add(change.propId);
        });
        return {
            totalChanges: allChanges.length,
            changesByType,
            changesBySeverity,
            avgImpact: allChanges.length > 0 ? totalImpact / allChanges.length : 0,
            propsAffected: affectedProps.size
        };
    }
    /**
     * Manually trigger change detection for a factor
     */
    async forceChangeDetection(propId, factor, newValue, source = 'manual') {
        const state = this.propStates.get(propId);
        if (!state) {
            return null;
        }
        const oldValue = state.lastValues[factor];
        if (oldValue === undefined) {
            this.logger.warn('Cannot force detection - no previous value', {
                propId,
                factor
            });
            return null;
        }
        return await this.detectMaterialChange(propId, factor, oldValue, newValue, source, Date.now());
    }
    /**
     * Clean up old prop states
     */
    cleanup(olderThan = 86400000) {
        const cutoff = Date.now() - olderThan;
        let removedCount = 0;
        this.propStates.forEach((state, propId) => {
            if (state.lastUpdate < cutoff) {
                this.propStates.delete(propId);
                removedCount++;
            }
        });
        this.logger.info('Cleanup completed', {
            removedStates: removedCount,
            remainingStates: this.propStates.size
        });
        return removedCount;
    }
    // ========================================
    // PRIVATE METHODS
    // ========================================
    async detectMaterialChange(propId, factor, oldValue, newValue, source, timestamp) {
        // Determine change type from factor name
        const changeType = this.getChangeTypeFromFactor(factor);
        if (!changeType) {
            return null;
        }
        // Get sport from propId (assuming format includes sport)
        const sport = this.extractSportFromPropId(propId);
        // Find applicable threshold
        const threshold = this.findThreshold(changeType, sport);
        if (!threshold) {
            return null;
        }
        // Calculate change magnitude
        const changeMagnitude = this.calculateChangeMagnitude(oldValue, newValue, changeType);
        // Check if change exceeds threshold
        if (changeMagnitude < threshold.threshold) {
            return null;
        }
        // Calculate confidence based on change characteristics
        const confidence = this.calculateChangeConfidence(oldValue, newValue, changeType, source);
        if (confidence < threshold.minConfidence) {
            return null;
        }
        // Determine severity and impact
        const severity = this.determineSeverity(changeMagnitude, changeType);
        const impact = this.calculateImpact(changeMagnitude, changeType, severity);
        // Find correlated changes
        const correlatedChanges = await this.findCorrelatedChanges(propId, changeType, timestamp);
        const change = {
            propId,
            changeType,
            severity,
            impact,
            timestamp,
            previousValue: oldValue,
            newValue,
            threshold: threshold.threshold,
            sport,
            source,
            confidence,
            correlatedChanges
        };
        this.logger.debug('Material change detected', {
            propId,
            changeType,
            severity,
            impact,
            changeMagnitude,
            confidence
        });
        return change;
    }
    getChangeTypeFromFactor(factor) {
        const factorMap = {
            'odds': MaterialChangeType.ODDS_SHIFT,
            'line': MaterialChangeType.LINE_MOVEMENT,
            'steam': MaterialChangeType.STEAM_MOVE,
            'volume': MaterialChangeType.VOLUME_SPIKE,
            'injury': MaterialChangeType.INJURY_NEWS,
            'lineup': MaterialChangeType.LINEUP_CHANGE,
            'usage': MaterialChangeType.USAGE_CHANGE,
            'weather': MaterialChangeType.WEATHER_CHANGE,
            'venue': MaterialChangeType.VENUE_CHANGE,
            'official': MaterialChangeType.OFFICIAL_CHANGE,
            'news': MaterialChangeType.NEWS_BREAK
        };
        // Check if factor name contains any of the mapped keys
        for (const [key, changeType] of Object.entries(factorMap)) {
            if (factor.toLowerCase().includes(key)) {
                return changeType;
            }
        }
        return null;
    }
    extractSportFromPropId(propId) {
        // Assuming propId format like "NFL:2024-01-15:propId" or similar
        const parts = propId.split(':');
        return parts[0] || 'UNKNOWN';
    }
    findThreshold(changeType, sport) {
        // First try to find sport-specific threshold
        let threshold = this.changeThresholds.find(t => t.changeType === changeType && t.sport === sport);
        // Fall back to universal threshold
        if (!threshold) {
            threshold = this.changeThresholds.find(t => t.changeType === changeType && t.sport === '*');
        }
        return threshold || null;
    }
    calculateChangeMagnitude(oldValue, newValue, changeType) {
        switch (changeType) {
            case MaterialChangeType.ODDS_SHIFT:
                // Calculate percentage change in odds
                const oldOdds = Math.abs(Number(oldValue) || 100);
                const newOdds = Math.abs(Number(newValue) || 100);
                return Math.abs((newOdds - oldOdds) / oldOdds) * 100;
            case MaterialChangeType.LINE_MOVEMENT:
                // Calculate absolute line movement
                return Math.abs(Number(newValue) - Number(oldValue));
            case MaterialChangeType.VOLUME_SPIKE:
                // Calculate volume increase percentage
                const oldVolume = Number(oldValue) || 1;
                const newVolume = Number(newValue) || 1;
                return ((newVolume - oldVolume) / oldVolume) * 100;
            case MaterialChangeType.USAGE_CHANGE:
                // Calculate usage rate change
                return Math.abs(Number(newValue) - Number(oldValue));
            case MaterialChangeType.WEATHER_CHANGE:
                // Weather severity scale 0-1
                return Math.abs(Number(newValue) - Number(oldValue));
            case MaterialChangeType.STEAM_MOVE:
                // Steam confidence 0-1
                return Number(newValue) || 0;
            default:
                // For binary changes (injury, lineup, etc.), return 1 if changed, 0 if not
                return oldValue !== newValue ? 1 : 0;
        }
    }
    calculateChangeConfidence(oldValue, newValue, changeType, source) {
        let confidence = 0.7; // Base confidence
        // Adjust based on source reliability
        const sourceConfidence = {
            'official_data': 1.0,
            'primary_feed': 0.9,
            'secondary_feed': 0.7,
            'news_feed': 0.6,
            'social_media': 0.4,
            'manual': 0.8,
            'unknown': 0.5
        };
        confidence *= sourceConfidence[source] || 0.5;
        // Adjust based on change magnitude for continuous variables
        if (changeType === MaterialChangeType.ODDS_SHIFT ||
            changeType === MaterialChangeType.LINE_MOVEMENT) {
            const magnitude = this.calculateChangeMagnitude(oldValue, newValue, changeType);
            if (magnitude > 50)
                confidence *= 1.2; // Very large changes are likely real
            else if (magnitude < 5)
                confidence *= 0.8; // Small changes might be noise
        }
        return Math.min(1.0, Math.max(0.0, confidence));
    }
    determineSeverity(magnitude, changeType) {
        // Define severity thresholds by change type
        const severityThresholds = {
            [MaterialChangeType.ODDS_SHIFT]: [5, 15, 30],
            [MaterialChangeType.LINE_MOVEMENT]: [0.5, 2, 5],
            [MaterialChangeType.VOLUME_SPIKE]: [50, 150, 300],
            [MaterialChangeType.INJURY_NEWS]: [0.1, 0.3, 0.7],
            [MaterialChangeType.WEATHER_CHANGE]: [0.2, 0.5, 0.8],
            [MaterialChangeType.STEAM_MOVE]: [0.6, 0.8, 0.95],
        };
        const thresholds = severityThresholds[changeType] || [10, 25, 50];
        const [low, medium, high] = thresholds;
        if (magnitude >= high)
            return 'critical';
        if (magnitude >= medium)
            return 'high';
        if (magnitude >= low)
            return 'medium';
        return 'low';
    }
    calculateImpact(magnitude, changeType, severity) {
        // Base impact by severity
        const severityImpact = {
            'low': 25,
            'medium': 50,
            'high': 75,
            'critical': 95
        };
        let impact = severityImpact[severity];
        // Adjust by change type importance
        const changeTypeMultipliers = {
            [MaterialChangeType.INJURY_NEWS]: 1.5,
            [MaterialChangeType.LINEUP_CHANGE]: 1.4,
            [MaterialChangeType.STEAM_MOVE]: 1.3,
            [MaterialChangeType.LINE_MOVEMENT]: 1.2,
            [MaterialChangeType.ODDS_SHIFT]: 1.1,
            [MaterialChangeType.VOLUME_SPIKE]: 1.0,
        };
        const multiplier = changeTypeMultipliers[changeType] || 1.0;
        impact *= multiplier;
        // Apply magnitude scaling
        impact += Math.min(20, magnitude / 5);
        return Math.min(100, Math.max(0, Math.round(impact)));
    }
    async findCorrelatedChanges(propId, changeType, timestamp) {
        const correlatedProps = [];
        const timeWindow = 300000; // 5 minutes
        // Look for similar changes in related props within time window
        this.propStates.forEach((state, otherPropId) => {
            if (otherPropId === propId)
                return;
            const recentChanges = state.changeHistory.filter(change => change.changeType === changeType &&
                Math.abs(change.timestamp - timestamp) < timeWindow);
            if (recentChanges.length > 0) {
                correlatedProps.push(otherPropId);
            }
        });
        return correlatedProps;
    }
    getDefaultWatchedFactors(sport) {
        const basefactors = [
            'odds', 'line', 'volume', 'steam_confidence',
            'injury_severity', 'weather_severity'
        ];
        const sportSpecificFactors = {
            'NFL': [...basefactors, 'weather_impact', 'injury_report'],
            'NBA': [...basefactors, 'lineup_changes', 'usage_rate'],
            'MLB': [...basefactors, 'weather_impact', 'pitcher_change'],
            'NHL': [...basefactors, 'injury_report', 'goalie_change']
        };
        return sportSpecificFactors[sport] || basefactors;
    }
    addChangesToQueue(changes) {
        this.changeQueue.push(...changes);
        // Limit queue size
        if (this.changeQueue.length > this.MAX_QUEUE_SIZE) {
            const overflow = this.changeQueue.length - this.MAX_QUEUE_SIZE;
            this.changeQueue = this.changeQueue.slice(-this.MAX_QUEUE_SIZE);
            this.logger.warn('Change queue overflow', {
                removed: overflow,
                remaining: this.changeQueue.length
            });
        }
        // Emit events for immediate handling
        changes.forEach(change => {
            this.emit('materialChange', change);
            if (change.severity === 'critical') {
                this.emit('criticalChange', change);
            }
        });
    }
    startProcessing() {
        this.processingInterval = setInterval(async () => {
            if (this.changeQueue.length === 0)
                return;
            const batch = this.changeQueue.splice(0, 100); // Process 100 changes at a time
            try {
                await this.processBatch(batch);
            }
            catch (error) {
                this.logger.error('Batch processing failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    batchSize: batch.length
                });
                // Re-queue failed changes (up to a limit)
                if (batch.length < 20) { // Only re-queue small batches
                    this.changeQueue.unshift(...batch);
                }
            }
        }, this.PROCESSING_INTERVAL_MS);
    }
    async processBatch(changes) {
        // Group changes by prop for efficient processing
        const changesByProp = new Map();
        changes.forEach(change => {
            const propChanges = changesByProp.get(change.propId) || [];
            propChanges.push(change);
            changesByProp.set(change.propId, propChanges);
        });
        // Invalidate feature cache for affected props
        changesByProp.forEach((propChanges, propId) => {
            const changedFactors = propChanges.map(c => c.changeType);
            this.featureStore.invalidateFeatures(propId, changedFactors);
        });
        this.logger.debug('Processed change batch', {
            changes: changes.length,
            propsAffected: changesByProp.size,
            criticalChanges: changes.filter(c => c.severity === 'critical').length
        });
        // Emit batch processed event
        this.emit('batchProcessed', {
            changes,
            propsAffected: changesByProp.size
        });
    }
    startStateCleanup() {
        setInterval(() => {
            this.cleanup();
        }, this.STATE_CLEANUP_INTERVAL);
    }
    /**
     * Get current status for monitoring
     */
    getStatus() {
        const hourAgo = Date.now() - 3600000;
        let totalChanges = 0;
        this.propStates.forEach(state => {
            totalChanges += state.changeHistory.length;
        });
        const recentChanges = this.changeQueue.filter(c => c.timestamp > hourAgo).length;
        return {
            trackedProps: this.propStates.size,
            queuedChanges: this.changeQueue.length,
            totalChangesDetected: totalChanges,
            avgChangesPerHour: recentChanges
        };
    }
    /**
     * Export configuration for debugging
     */
    exportConfig() {
        return {
            thresholds: this.changeThresholds,
            processingInterval: this.PROCESSING_INTERVAL_MS,
            maxQueueSize: this.MAX_QUEUE_SIZE
        };
    }
    /**
     * Shutdown cleanup
     */
    shutdown() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        this.removeAllListeners();
        this.propStates.clear();
        this.changeQueue.length = 0;
        this.logger.info('MaterialChangeDetector shutdown completed');
    }
}
exports.MaterialChangeDetector = MaterialChangeDetector;
