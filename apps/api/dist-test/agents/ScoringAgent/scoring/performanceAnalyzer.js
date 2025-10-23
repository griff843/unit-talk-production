"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceAnalyzer = void 0;
/**
 * Fortune 100 Performance Analytics System
 * Tracks and analyzes grading performance with advanced metrics
 */
class PerformanceAnalyzer {
    constructor() {
        this.betHistory = [];
        this.performanceCache = new Map();
        this.lastCacheUpdate = new Date().toISOString();
        // Initialize performance analyzer
    }
    /**
     * Record a bet result for performance tracking
     */
    async recordBetResult(betResult) {
        this.betHistory.push(betResult);
        // Clear cache to force recalculation
        this.performanceCache.clear();
        // Log performance milestone
        if (this.betHistory.length % 100 === 0) {
            console.log(`📊 Performance milestone: ${this.betHistory.length}
} bets recorded`);
            const metrics = await this.getPerformanceMetrics();
            console.log(`Current ROI: ${metrics.roi.toFixed(2)}%, Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`);
        }
    }
    /**
     * Get comprehensive performance metrics
     */
    async getPerformanceMetrics(timeframe = 'all') {
        const cacheKey = `metrics_${timeframe}
}`;
        // Check cache
        if (this.performanceCache.has(cacheKey) &&
            (Date.now() - new Date(this.lastCacheUpdate).getTime()) < 5 * 60 * 1000) { // 5 min cache
            return this.performanceCache.get(cacheKey);
        }
        // Filter bets based on timeframe
        let filteredBets = this.betHistory;
        if (timeframe !== 'all') {
            const cutoffDate = new Date();
            const days = timeframe === '30d' ? 30 : 7;
            cutoffDate.setDate(cutoffDate.getDate() - days);
            filteredBets = this.betHistory.filter(bet => new Date(bet.timestamp) >= cutoffDate);
        }
        if (filteredBets.length === 0) {
            return this.getDefaultMetrics();
        }
        // Calculate metrics
        const totalBets = filteredBets.length;
        const wins = filteredBets.filter(bet => bet.result > 0).length;
        const winRate = wins / totalBets;
        const totalProfit = filteredBets.reduce((sum, bet) => sum + bet.profit, 0);
        const totalStake = filteredBets.reduce((sum, bet) => sum + bet.positionSize, 0);
        const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
        const avgStake = totalStake / totalBets;
        // Risk-adjusted metrics
        const returns = filteredBets.map(bet => bet.profit / bet.positionSize);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const volatility = this.calculateVolatility(returns);
        const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;
        const maxDrawdown = this.calculateMaxDrawdown(filteredBets);
        const profitFactor = this.calculateProfitFactor(filteredBets);
        // Tier analysis
        const tierPerformance = this.analyzeTierPerformance(filteredBets);
        const bestTier = Object.entries(tierPerformance)
            .sort((a, b) => b[1].roi - a[1].roi)[0]?.[0] || 'N/A';
        const worstTier = Object.entries(tierPerformance)
            .sort((a, b) => a[1].roi - b[1].roi)[0]?.[0] || 'N/A';
        // Recent form (last 10 bets)
        const recentBets = filteredBets.slice(-10);
        const recentWins = recentBets.filter(bet => bet.result > 0).length;
        const recentForm = recentBets.length > 0 ? recentWins / recentBets.length : 0;
        // Sport analysis
        const sportPerformance = this.analyzeSportPerformance(filteredBets);
        // Market analysis
        const marketPerformance = this.analyzeMarketPerformance(filteredBets);
        const metrics = {
            totalBets,
            winRate,
            roi,
            totalProfit,
            maxDrawdown,
            sharpeRatio,
            profitFactor,
            avgStake,
            bestTier,
            worstTier,
            recentForm,
            byTier: tierPerformance,
            bySport: sportPerformance,
            byMarket: marketPerformance
        };
        // Cache results
        this.performanceCache.set(cacheKey, metrics);
        this.lastCacheUpdate = new Date().toISOString();
        return metrics;
    }
    /**
     * Get historical accuracy for model validation
     */
    async getHistoricalAccuracy(modelType) {
        let bets = this.betHistory;
        if (modelType) {
            bets = bets.filter(bet => bet.modelUsed === modelType);
        }
        if (bets.length === 0) {
            return {
                overall: 0,
                byTier: {},
                byConfidence: {},
                trend: []
            };
        }
        // Overall accuracy
        const correctPredictions = bets.filter(bet => bet.result > 0).length;
        const overall = correctPredictions / bets.length;
        // Accuracy by tier
        const byTier = {};
        const tierGroups = this.groupBy(bets, bet => bet.tier);
        Object.entries(tierGroups).forEach(([tier, tierBets]) => {
            const tierCorrect = tierBets.filter(bet => bet.result > 0).length;
            byTier[tier] = tierCorrect / tierBets.length;
        });
        // Accuracy by confidence ranges
        const byConfidence = {};
        const confidenceRanges = [
            { range: '80%+', filter: (bet) => bet.confidence >= 80 },
            { range: '70-80%', filter: (bet) => bet.confidence >= 70 && bet.confidence < 80 },
            { range: '60-70%', filter: (bet) => bet.confidence >= 60 && bet.confidence < 70 },
            { range: '<60%', filter: (bet) => bet.confidence < 60 }
        ];
        confidenceRanges.forEach(({ range, filter }) => {
            const rangeBets = bets.filter(filter);
            if (rangeBets.length > 0) {
                const rangeCorrect = rangeBets.filter(bet => bet.result > 0).length;
                byConfidence[range] = rangeCorrect / rangeBets.length;
            }
        });
        // Accuracy trend (last 30 days)
        const trend = this.calculateAccuracyTrend(bets);
        return {
            overall,
            byTier,
            byConfidence,
            trend
        };
    }
    /**
     * Log grading performance for continuous improvement
     */
    async logGradingPerformance(gradingResult, actualOutcome, actualProfit, sport, marketType, odds) {
        const betResult = {
            id: `bet_${Date.now()}
}_${Math.random().toString(36).substr(2, 9)}`,
            sport: sport || 'Unknown',
            marketType: marketType || 'Unknown',
            tier: gradingResult.tier,
            actualOdds: odds || 0,
            positionSize: gradingResult.positionSize || 0.01,
            result: actualOutcome,
            profit: actualProfit,
            confidence: gradingResult.confidence,
            expectedValue: gradingResult.edgeScore || 0,
            timestamp: new Date().toISOString(),
            modelUsed: 'syndicate_grading_engine'
        };
        await this.recordBetResult(betResult);
    }
    /**
     * Get performance comparison between different models/strategies
     */
    async getModelComparison() {
        const modelGroups = this.groupBy(this.betHistory, bet => bet.modelUsed);
        const comparison = {};
        for (const [model, bets] of Object.entries(modelGroups)) {
            comparison[model] = await this.calculateMetricsForBets(bets);
        }
        return comparison;
    }
    /**
     * Export performance data for external analysis
     */
    exportPerformanceData() {
        return [...this.betHistory];
    }
    /**
     * Clear performance history (use with caution)
     */
    clearHistory() {
        this.betHistory = [];
        this.performanceCache.clear();
    }
    // Private helper methods
    calculateVolatility(returns) {
        if (returns.length < 2) {
            return 0;
        }
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }
    calculateMaxDrawdown(bets) {
        let peak = 0;
        let maxDrawdown = 0;
        let runningTotal = 0;
        for (const bet of bets) {
            runningTotal += bet.profit;
            if (runningTotal > peak) {
                peak = runningTotal;
            }
            const drawdown = peak > 0 ? (peak - runningTotal) / peak : 0;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
        return maxDrawdown;
    }
    calculateProfitFactor(bets) {
        const wins = bets.filter(bet => bet.result > 0);
        const losses = bets.filter(bet => bet.result <= 0);
        const totalWins = wins.reduce((sum, bet) => sum + bet.profit, 0);
        const totalLosses = Math.abs(losses.reduce((sum, bet) => sum + bet.profit, 0));
        return totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;
    }
    analyzeTierPerformance(bets) {
        const tierGroups = this.groupBy(bets, bet => bet.tier);
        const tierPerformance = {};
        Object.entries(tierGroups).forEach(([tier, tierBets]) => {
            const wins = tierBets.filter(bet => bet.result > 0).length;
            const totalProfit = tierBets.reduce((sum, bet) => sum + bet.profit, 0);
            const totalStake = tierBets.reduce((sum, bet) => sum + bet.positionSize, 0);
            tierPerformance[tier] = {
                count: tierBets.length,
                winRate: wins / tierBets.length,
                roi: totalStake > 0 ? (totalProfit / totalStake) * 100 : 0
            };
        });
        return tierPerformance;
    }
    calculateAccuracyTrend(bets) {
        // Group bets by day
        const dailyGroups = this.groupBy(bets, bet => {
            const timestamp = bet.timestamp || Date.now();
            const dateStr = new Date(timestamp).toISOString().split('T')[0];
            return dateStr || new Date().toISOString().split('T')[0] || 'unknown';
        });
        return Object.entries(dailyGroups)
            .map(([date, dayBets]) => ({
            date,
            accuracy: dayBets.filter(bet => bet.result > 0).length / dayBets.length
        }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-30); // Last 30 days
    }
    async calculateMetricsForBets(bets) {
        if (bets.length === 0) {
            return this.getDefaultMetrics();
        }
        const totalBets = bets.length;
        const wins = bets.filter(bet => bet.result > 0).length;
        const winRate = wins / totalBets;
        const totalProfit = bets.reduce((sum, bet) => sum + bet.profit, 0);
        const totalStake = bets.reduce((sum, bet) => sum + bet.positionSize, 0);
        const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
        const avgStake = totalStake / totalBets;
        const returns = bets.map(bet => bet.profit / bet.positionSize);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const volatility = this.calculateVolatility(returns);
        const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;
        const maxDrawdown = this.calculateMaxDrawdown(bets);
        const profitFactor = this.calculateProfitFactor(bets);
        const tierPerformance = this.analyzeTierPerformance(bets);
        const bestTier = Object.entries(tierPerformance)
            .sort((a, b) => b[1].roi - a[1].roi)[0]?.[0] || 'N/A';
        const worstTier = Object.entries(tierPerformance)
            .sort((a, b) => a[1].roi - b[1].roi)[0]?.[0] || 'N/A';
        // Added: analyze performance by sport and market
        const sportPerformance = this.analyzeSportPerformance(bets);
        const marketPerformance = this.analyzeMarketPerformance(bets);
        const recentBets = bets.slice(-10);
        const recentWins = recentBets.filter(bet => bet.result > 0).length;
        const recentForm = recentBets.length > 0 ? recentWins / recentBets.length : 0;
        return {
            totalBets,
            winRate,
            roi,
            totalProfit,
            maxDrawdown,
            sharpeRatio,
            profitFactor,
            avgStake,
            bestTier,
            worstTier,
            recentForm,
            bySport: sportPerformance,
            byMarket: marketPerformance
        };
    }
    analyzeSportPerformance(bets) {
        const sportGroups = this.groupBy(bets, bet => bet.sport);
        const sportPerformance = {};
        Object.entries(sportGroups).forEach(([sport, sportBets]) => {
            const wins = sportBets.filter(bet => bet.result > 0).length;
            const totalProfit = sportBets.reduce((sum, bet) => sum + bet.profit, 0);
            const totalStake = sportBets.reduce((sum, bet) => sum + bet.positionSize, 0);
            sportPerformance[sport] = {
                count: sportBets.length,
                winRate: wins / sportBets.length,
                roi: totalStake > 0 ? (totalProfit / totalStake) * 100 : 0
            };
        });
        return sportPerformance;
    }
    analyzeMarketPerformance(bets) {
        const marketGroups = this.groupBy(bets, bet => bet.marketType);
        const marketPerformance = {};
        Object.entries(marketGroups).forEach(([market, marketBets]) => {
            const wins = marketBets.filter(bet => bet.result > 0).length;
            const totalProfit = marketBets.reduce((sum, bet) => sum + bet.profit, 0);
            const totalStake = marketBets.reduce((sum, bet) => sum + bet.positionSize, 0);
            marketPerformance[market] = {
                count: marketBets.length,
                winRate: wins / marketBets.length,
                roi: totalStake > 0 ? (totalProfit / totalStake) * 100 : 0
            };
        });
        return marketPerformance;
    }
    getDefaultMetrics() {
        return {
            totalBets: 0,
            winRate: 0,
            roi: 0,
            totalProfit: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            profitFactor: 0,
            avgStake: 0,
            bestTier: 'N/A',
            worstTier: 'N/A',
            recentForm: 0
        };
    }
    groupBy(array, keyFn) {
        return array.reduce((groups, item) => {
            const key = keyFn(item);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    }
}
exports.PerformanceAnalyzer = PerformanceAnalyzer;
