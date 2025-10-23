"use strict";
/**
 * Correlation Manager
 *
 * Professional-grade correlation analysis and management for betting portfolios.
 * Implements game, player, sport, and time-based correlation tracking with
 * real-time correlation limits and portfolio concentration management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrelationManager = void 0;
const logger_1 = require("../../utils/logger");
class CorrelationManager {
    constructor(config) {
        this.logger = (0, logger_1.createLogger)('CorrelationManager');
        // Correlation data storage
        this.positions = new Map();
        this.clusters = [];
        this.lastUpdate = new Date();
        // Correlation calculation parameters
        this.CORRELATION_THRESHOLDS = {
            SAME_PLAYER: 0.95, // Same player = 95% correlation
            SAME_GAME: 0.70, // Same game = 70% correlation
            SAME_SPORT_SAME_DAY: 0.40, // Same sport, same day = 40% correlation
            SAME_SPORT_DIFFERENT_DAY: 0.25, // Same sport, different day = 25% correlation
            SAME_POSITION_GROUP: 0.60, // Similar positions (QB props) = 60% correlation
            WEATHER_RELATED: 0.50, // Weather-affected games = 50% correlation
            RELATED_PLAYERS: 0.35, // Team-related players = 35% correlation
            DIFFERENT_SPORTS: 0.10 // Different sports = 10% correlation
        };
        this.config = config;
        this.correlationMatrix = this.initializeEmptyMatrix();
        this.logger.info('Correlation Manager initialized', {
            calculationMethod: config.calculationMethod,
            windowSize: config.windowSize,
            significanceThreshold: config.significanceThreshold
        });
    }
    /**
     * Assess correlation risk for a new proposition
     */
    async assessCorrelationRisk(prop, existingPositions) {
        const startTime = Date.now();
        try {
            // Calculate correlations with all existing positions
            const correlations = await this.calculateAllCorrelations(prop, existingPositions);
            // Identify highest correlation and correlated positions
            const maxCorrelation = Math.max(...Object.values(correlations.overall));
            const correlatedPositions = Object.entries(correlations.overall)
                .filter(([, corr]) => corr > this.config.significanceThreshold)
                .map(([positionId]) => positionId);
            // Calculate overall risk score
            const overallRisk = this.calculateCorrelationRiskScore(correlations, existingPositions);
            // Identify specific risk factors
            const riskFactors = this.identifyCorrelationRiskFactors(correlations, prop);
            // Calculate recommended position size adjustment
            const recommendedAdjustment = this.calculateStakeAdjustment(overallRisk, maxCorrelation);
            const assessment = {
                propId: prop.propId,
                overallRisk,
                maxCorrelation,
                correlatedPositions,
                riskFactors,
                recommendedAdjustment,
                gameCorrelations: correlations.byGame,
                playerCorrelations: correlations.byPlayer,
                sportCorrelations: correlations.bySport,
                timeCorrelations: correlations.byTime,
                marketTypeCorrelations: correlations.byMarketType
            };
            this.logger.debug('Correlation risk assessment completed', {
                propId: prop.propId,
                overallRisk,
                maxCorrelation: maxCorrelation.toFixed(3),
                correlatedPositions: correlatedPositions.length,
                processingTime: Date.now() - startTime
            });
            return assessment;
        }
        catch (error) {
            this.logger.error('Correlation risk assessment failed', {
                propId: prop.propId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return this.createFallbackAssessment(prop);
        }
    }
    /**
     * Add new position to correlation tracking
     */
    async addPosition(position) {
        this.positions.set(position.id, position);
        // Update correlation matrix
        await this.updateCorrelationMatrix();
        // Update clusters if enabled
        if (this.config.clusteringEnabled) {
            await this.updateCorrelationClusters();
        }
        this.lastUpdate = new Date();
        this.logger.info('Position added to correlation tracking', {
            positionId: position.id,
            propId: position.propId,
            totalPositions: this.positions.size
        });
    }
    /**
     * Remove position from correlation tracking
     */
    async removePosition(position) {
        this.positions.delete(position.id);
        // Update correlation matrix
        await this.updateCorrelationMatrix();
        // Update clusters
        if (this.config.clusteringEnabled) {
            await this.updateCorrelationClusters();
        }
        this.lastUpdate = new Date();
        this.logger.info('Position removed from correlation tracking', {
            positionId: position.id,
            totalPositions: this.positions.size
        });
    }
    /**
     * Get current correlation matrix
     */
    getCorrelationMatrix() {
        return { ...this.correlationMatrix };
    }
    /**
     * Get comprehensive portfolio correlation analysis
     */
    async getPortfolioCorrelationAnalysis() {
        const positions = Array.from(this.positions.values());
        // Update matrix if stale
        if (this.isMatrixStale()) {
            await this.updateCorrelationMatrix();
        }
        // Identify risk hotspots
        const riskHotspots = await this.identifyRiskHotspots(positions);
        // Calculate diversification score
        const diversificationScore = this.calculateDiversificationScore(positions);
        // Generate concentration warnings
        const concentrationWarnings = this.generateConcentrationWarnings(positions);
        return {
            matrix: this.correlationMatrix,
            clusters: this.clusters,
            riskHotspots,
            diversificationScore,
            concentrationWarnings
        };
    }
    /**
     * Calculate correlation between two positions
     */
    calculatePairwiseCorrelation(pos1, pos2) {
        // Same player = highest correlation
        if (pos1.player === pos2.player) {
            return this.CORRELATION_THRESHOLDS.SAME_PLAYER;
        }
        // Same game = high correlation
        if (pos1.gameId && pos2.gameId && pos1.gameId === pos2.gameId) {
            return this.CORRELATION_THRESHOLDS.SAME_GAME;
        }
        // Same sport correlations
        if (pos1.sport === pos2.sport) {
            const timeDiff = this.calculateTimeDifference(pos1.gameTime, pos2.gameTime);
            if (timeDiff <= 24) { // Same day
                return this.CORRELATION_THRESHOLDS.SAME_SPORT_SAME_DAY;
            }
            else {
                return this.CORRELATION_THRESHOLDS.SAME_SPORT_DIFFERENT_DAY;
            }
        }
        // Related market types (e.g., QB passing yards and team total)
        if (this.areMarketTypesRelated(pos1.marketType, pos2.marketType)) {
            return this.CORRELATION_THRESHOLDS.SAME_POSITION_GROUP;
        }
        // Weather-related games
        if (this.areWeatherRelated(pos1, pos2)) {
            return this.CORRELATION_THRESHOLDS.WEATHER_RELATED;
        }
        // Team-related players (teammates)
        if (this.areTeammates(pos1, pos2)) {
            return this.CORRELATION_THRESHOLDS.RELATED_PLAYERS;
        }
        // Different sports = minimal correlation
        return this.CORRELATION_THRESHOLDS.DIFFERENT_SPORTS;
    }
    /**
     * Update correlation configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('Correlation configuration updated', {
            changes: Object.keys(newConfig)
        });
    }
    // ========================================
    // Private Helper Methods
    // ========================================
    /**
     * Calculate all types of correlations for a proposition
     */
    async calculateAllCorrelations(prop, positions) {
        const correlations = {
            overall: {},
            byGame: {},
            byPlayer: {},
            bySport: {},
            byTime: {},
            byMarketType: {}
        };
        for (const position of positions) {
            const correlation = this.calculatePropPositionCorrelation(prop, position);
            correlations.overall[position.id] = correlation;
            // Categorize correlations
            if (prop.gameId && position.gameId && prop.gameId === position.gameId) {
                correlations.byGame[position.id] = correlation;
            }
            if (prop.player === position.player) {
                correlations.byPlayer[position.id] = correlation;
            }
            if (prop.sport === position.sport) {
                correlations.bySport[position.id] = correlation;
            }
            if (this.isSameTimeWindow(prop.gameTime, position.gameTime)) {
                correlations.byTime[position.id] = correlation;
            }
            if (this.areMarketTypesRelated(prop.marketType, position.marketType)) {
                correlations.byMarketType[position.id] = correlation;
            }
        }
        return correlations;
    }
    /**
     * Calculate correlation between a prop and a position
     */
    calculatePropPositionCorrelation(prop, position) {
        // Convert position to prop-like object for correlation calculation
        const positionAsProp = {
            propId: position.propId,
            sport: position.sport,
            player: position.player,
            gameId: position.gameId,
            marketType: position.marketType,
            gameTime: position.gameTime
        };
        return this.calculatePairwiseCorrelation(prop, positionAsProp);
    }
    /**
     * Calculate correlation risk score (0-10)
     */
    calculateCorrelationRiskScore(correlations, positions) {
        let riskScore = 0;
        // Highest correlation risk
        const maxCorrelation = Math.max(...Object.values(correlations.overall));
        if (maxCorrelation > 0.8)
            riskScore += 4;
        else if (maxCorrelation > 0.6)
            riskScore += 3;
        else if (maxCorrelation > 0.4)
            riskScore += 2;
        else if (maxCorrelation > 0.3)
            riskScore += 1;
        // Number of correlated positions
        const correlatedCount = Object.values(correlations.overall)
            .filter(corr => corr > this.config.significanceThreshold).length;
        riskScore += Math.min(3, correlatedCount);
        // Concentration risk
        const gameCorrelations = Object.values(correlations.byGame);
        if (gameCorrelations.length > 0)
            riskScore += 2;
        const playerCorrelations = Object.values(correlations.byPlayer);
        if (playerCorrelations.length > 0)
            riskScore += 3;
        return Math.min(10, riskScore);
    }
    /**
     * Identify specific correlation risk factors
     */
    identifyCorrelationRiskFactors(correlations, prop) {
        const factors = [];
        const maxCorrelation = Math.max(...Object.values(correlations.overall));
        if (maxCorrelation > 0.8) {
            factors.push(`High correlation (${(maxCorrelation * 100).toFixed(0)}%) with existing position`);
        }
        if (Object.keys(correlations.byPlayer).length > 0) {
            factors.push(`Same player as ${Object.keys(correlations.byPlayer).length} existing position(s)`);
        }
        if (Object.keys(correlations.byGame).length > 2) {
            factors.push(`High concentration in single game (${Object.keys(correlations.byGame).length} positions)`);
        }
        if (Object.keys(correlations.bySport).length > 5) {
            factors.push(`High sport concentration (${Object.keys(correlations.bySport).length} ${prop.sport} positions)`);
        }
        if (Object.keys(correlations.byTime).length > 3) {
            factors.push(`High time correlation (${Object.keys(correlations.byTime).length} positions in same window)`);
        }
        return factors;
    }
    /**
     * Calculate recommended stake adjustment based on correlation risk
     */
    calculateStakeAdjustment(riskScore, maxCorrelation) {
        let adjustment = 1.0;
        // Risk score adjustment
        if (riskScore >= 8)
            adjustment *= 0.4; // 60% reduction
        else if (riskScore >= 6)
            adjustment *= 0.6; // 40% reduction
        else if (riskScore >= 4)
            adjustment *= 0.8; // 20% reduction
        else if (riskScore >= 2)
            adjustment *= 0.9; // 10% reduction
        // Maximum correlation adjustment
        if (maxCorrelation > 0.8)
            adjustment *= 0.5;
        else if (maxCorrelation > 0.6)
            adjustment *= 0.7;
        else if (maxCorrelation > 0.4)
            adjustment *= 0.85;
        return Math.max(0.1, adjustment); // Minimum 10% of original size
    }
    /**
     * Update the correlation matrix with current positions
     */
    async updateCorrelationMatrix() {
        const positions = Array.from(this.positions.values());
        const matrix = {};
        // Calculate pairwise correlations
        for (let i = 0; i < positions.length; i++) {
            const pos1 = positions[i];
            matrix[pos1.id] = {};
            for (let j = 0; j < positions.length; j++) {
                const pos2 = positions[j];
                if (i === j) {
                    matrix[pos1.id][pos2.id] = 1.0; // Perfect correlation with self
                }
                else {
                    matrix[pos1.id][pos2.id] = this.calculatePairwiseCorrelation(pos1, pos2);
                }
            }
        }
        // Calculate statistics
        const stats = this.calculateCorrelationStats(matrix);
        this.correlationMatrix = {
            matrix,
            methodology: this.config.calculationMethod,
            windowSize: this.config.windowSize,
            lastUpdated: new Date().toISOString(),
            stats
        };
    }
    /**
     * Calculate correlation matrix statistics
     */
    calculateCorrelationStats(matrix) {
        const correlations = [];
        // Extract all correlation values (excluding diagonal)
        Object.keys(matrix).forEach(pos1 => {
            Object.keys(matrix[pos1]).forEach(pos2 => {
                if (pos1 !== pos2) {
                    correlations.push(matrix[pos1][pos2]);
                }
            });
        });
        if (correlations.length === 0) {
            return {
                averageCorrelation: 0,
                maxCorrelation: 0,
                minCorrelation: 0,
                significantCorrelations: 0,
                clusters: []
            };
        }
        const averageCorrelation = correlations.reduce((sum, corr) => sum + corr, 0) / correlations.length;
        const maxCorrelation = Math.max(...correlations);
        const minCorrelation = Math.min(...correlations);
        const significantCorrelations = correlations.filter(corr => corr > this.config.significanceThreshold).length;
        return {
            averageCorrelation,
            maxCorrelation,
            minCorrelation,
            significantCorrelations,
            clusters: this.clusters // Will be populated by clustering algorithm
        };
    }
    /**
     * Update correlation clusters
     */
    async updateCorrelationClusters() {
        // Simple clustering algorithm based on correlation thresholds
        const positions = Array.from(this.positions.values());
        const clusters = [];
        const assigned = new Set();
        for (const position of positions) {
            if (assigned.has(position.id))
                continue;
            const cluster = {
                id: `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                positions: [position.id],
                averageCorrelation: 0,
                riskContribution: 0
            };
            // Find highly correlated positions
            for (const otherPosition of positions) {
                if (position.id === otherPosition.id || assigned.has(otherPosition.id))
                    continue;
                const correlation = this.calculatePairwiseCorrelation(position, otherPosition);
                if (correlation > this.config.significanceThreshold) {
                    cluster.positions.push(otherPosition.id);
                    assigned.add(otherPosition.id);
                }
            }
            if (cluster.positions.length > 1) {
                // Calculate cluster statistics
                cluster.averageCorrelation = this.calculateClusterAverageCorrelation(cluster.positions);
                cluster.riskContribution = this.calculateClusterRiskContribution(cluster.positions);
                clusters.push(cluster);
            }
            assigned.add(position.id);
        }
        this.clusters = clusters;
    }
    /**
     * Calculate average correlation within a cluster
     */
    calculateClusterAverageCorrelation(positionIds) {
        const positions = positionIds.map(id => this.positions.get(id)).filter(Boolean);
        let totalCorrelation = 0;
        let count = 0;
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                totalCorrelation += this.calculatePairwiseCorrelation(positions[i], positions[j]);
                count++;
            }
        }
        return count > 0 ? totalCorrelation / count : 0;
    }
    /**
     * Calculate cluster risk contribution
     */
    calculateClusterRiskContribution(positionIds) {
        const positions = positionIds.map(id => this.positions.get(id)).filter(Boolean);
        const totalStake = positions.reduce((sum, pos) => sum + pos.stake, 0);
        const clusterSize = positions.length;
        // Risk increases with cluster size and total exposure
        return (clusterSize - 1) * Math.log(1 + totalStake);
    }
    /**
     * Identify portfolio risk hotspots
     */
    async identifyRiskHotspots(positions) {
        const hotspots = [];
        // Game concentration hotspots
        const gameExposures = this.calculateGameExposures(positions);
        Object.entries(gameExposures).forEach(([gameId, exposure]) => {
            if (exposure.amount > 1000 && exposure.positions.length > 2) { // Arbitrary thresholds
                hotspots.push({
                    type: 'GAME',
                    identifier: gameId,
                    exposureAmount: exposure.amount,
                    correlationRisk: exposure.positions.length * 2, // Simple risk calculation
                    affectedPositions: exposure.positions
                });
            }
        });
        // Player concentration hotspots
        const playerExposures = this.calculatePlayerExposures(positions);
        Object.entries(playerExposures).forEach(([player, exposure]) => {
            if (exposure.amount > 500 && exposure.positions.length > 1) {
                hotspots.push({
                    type: 'PLAYER',
                    identifier: player,
                    exposureAmount: exposure.amount,
                    correlationRisk: exposure.positions.length * 3, // Higher risk for player concentration
                    affectedPositions: exposure.positions
                });
            }
        });
        // Sport concentration hotspots
        const sportExposures = this.calculateSportExposures(positions);
        Object.entries(sportExposures).forEach(([sport, exposure]) => {
            if (exposure.amount > 2000 && exposure.positions.length > 5) {
                hotspots.push({
                    type: 'SPORT',
                    identifier: sport,
                    exposureAmount: exposure.amount,
                    correlationRisk: Math.log(exposure.positions.length),
                    affectedPositions: exposure.positions
                });
            }
        });
        return hotspots.sort((a, b) => b.correlationRisk - a.correlationRisk);
    }
    /**
     * Calculate diversification score (0-100)
     */
    calculateDiversificationScore(positions) {
        if (positions.length === 0)
            return 100;
        const uniqueSports = new Set(positions.map(p => p.sport)).size;
        const uniquePlayers = new Set(positions.map(p => p.player)).size;
        const uniqueGames = new Set(positions.map(p => p.gameId).filter(Boolean)).size;
        // Simple diversification score
        const sportScore = Math.min(100, (uniqueSports / Math.max(1, positions.length / 5)) * 100);
        const playerScore = Math.min(100, (uniquePlayers / positions.length) * 100);
        const gameScore = Math.min(100, (uniqueGames / Math.max(1, positions.length / 3)) * 100);
        return (sportScore + playerScore + gameScore) / 3;
    }
    /**
     * Generate concentration warnings
     */
    generateConcentrationWarnings(positions) {
        const warnings = [];
        // Check game concentration
        const gameExposures = this.calculateGameExposures(positions);
        Object.entries(gameExposures).forEach(([gameId, exposure]) => {
            if (exposure.positions.length > 3) {
                warnings.push(`High game concentration: ${exposure.positions.length} positions in game ${gameId}`);
            }
        });
        // Check player concentration
        const playerExposures = this.calculatePlayerExposures(positions);
        Object.entries(playerExposures).forEach(([player, exposure]) => {
            if (exposure.positions.length > 1) {
                warnings.push(`Player concentration: ${exposure.positions.length} positions on ${player}`);
            }
        });
        // Check correlation clustering
        const highCorrelationClusters = this.clusters.filter(cluster => cluster.averageCorrelation > 0.6 && cluster.positions.length > 2);
        if (highCorrelationClusters.length > 0) {
            warnings.push(`${highCorrelationClusters.length} high-correlation cluster(s) detected`);
        }
        return warnings;
    }
    // Helper methods for exposure calculations
    calculateGameExposures(positions) {
        const exposures = {};
        positions.forEach(pos => {
            if (pos.gameId) {
                if (!exposures[pos.gameId]) {
                    exposures[pos.gameId] = { amount: 0, positions: [] };
                }
                exposures[pos.gameId].amount += pos.stake;
                exposures[pos.gameId].positions.push(pos.id);
            }
        });
        return exposures;
    }
    calculatePlayerExposures(positions) {
        const exposures = {};
        positions.forEach(pos => {
            if (!exposures[pos.player]) {
                exposures[pos.player] = { amount: 0, positions: [] };
            }
            exposures[pos.player].amount += pos.stake;
            exposures[pos.player].positions.push(pos.id);
        });
        return exposures;
    }
    calculateSportExposures(positions) {
        const exposures = {};
        positions.forEach(pos => {
            if (!exposures[pos.sport]) {
                exposures[pos.sport] = { amount: 0, positions: [] };
            }
            exposures[pos.sport].amount += pos.stake;
            exposures[pos.sport].positions.push(pos.id);
        });
        return exposures;
    }
    // Utility methods
    calculateTimeDifference(time1, time2) {
        try {
            const date1 = new Date(time1);
            const date2 = new Date(time2);
            return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60); // Hours
        }
        catch {
            return 24; // Default to 24 hours if parsing fails
        }
    }
    areMarketTypesRelated(type1, type2) {
        // Define related market types
        const relatedGroups = [
            ['passing_yards', 'passing_tds', 'completions'],
            ['rushing_yards', 'rushing_tds', 'carries'],
            ['receiving_yards', 'receiving_tds', 'receptions'],
            ['points', 'assists', 'rebounds'], // Basketball
            ['goals', 'assists', 'shots'] // Hockey
        ];
        return relatedGroups.some(group => group.includes(type1.toLowerCase()) && group.includes(type2.toLowerCase()));
    }
    areWeatherRelated(pos1, pos2) {
        // Check if both are outdoor sports on the same day
        const outdoorSports = ['NFL', 'MLB', 'MLS'];
        return outdoorSports.includes(pos1.sport) &&
            outdoorSports.includes(pos2.sport) &&
            this.isSameTimeWindow(pos1.gameTime, pos2.gameTime, 6); // 6-hour window
    }
    areTeammates(pos1, pos2) {
        // This would require team information to be stored in positions
        // For now, simplified implementation
        return false;
    }
    isSameTimeWindow(time1, time2, windowHours = 24) {
        const timeDiff = this.calculateTimeDifference(time1, time2);
        return timeDiff <= windowHours;
    }
    isMatrixStale() {
        const hoursSinceUpdate = (Date.now() - this.lastUpdate.getTime()) / (1000 * 60 * 60);
        return hoursSinceUpdate > this.config.updateFrequency;
    }
    initializeEmptyMatrix() {
        return {
            matrix: {},
            methodology: this.config.calculationMethod,
            windowSize: this.config.windowSize,
            lastUpdated: new Date().toISOString(),
            stats: {
                averageCorrelation: 0,
                maxCorrelation: 0,
                minCorrelation: 0,
                significantCorrelations: 0,
                clusters: []
            }
        };
    }
    createFallbackAssessment(prop) {
        return {
            propId: prop.propId,
            overallRisk: 5, // Medium risk as fallback
            maxCorrelation: 0.3,
            correlatedPositions: [],
            riskFactors: ['Correlation assessment failed - using conservative estimate'],
            recommendedAdjustment: 0.8, // 20% reduction for safety
            gameCorrelations: {},
            playerCorrelations: {},
            sportCorrelations: {},
            timeCorrelations: {},
            marketTypeCorrelations: {}
        };
    }
}
exports.CorrelationManager = CorrelationManager;
