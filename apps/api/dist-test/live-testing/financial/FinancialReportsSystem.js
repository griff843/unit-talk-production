"use strict";
/**
 * Phase 9: Financial Reports System
 *
 * Comprehensive real money P&L tracking, transaction cost analysis,
 * performance attribution, and financial reporting for live testing validation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialReportsSystem = void 0;
const events_1 = require("events");
const logger_1 = require("@shared/logger");
class FinancialReportsSystem extends events_1.EventEmitter {
    constructor(initialBankroll = 2000) {
        super();
        this.logger = new logger_1.Logger('FinancialReportsSystem');
        this.betPnLHistory = [];
        this.dailyPnL = new Map();
        this.transactionHistory = [];
        this.initializeFinancialReports(initialBankroll);
        this.startReportingUpdates();
    }
    // ========================================
    // Initialization
    // ========================================
    initializeFinancialReports(initialBankroll) {
        this.realTimePnL = {
            sessionPnL: 0,
            unrealizedPnL: 0,
            realizedPnL: 0,
            dailyPnL: 0,
            weeklyPnL: 0,
            monthlyPnL: 0,
            totalPnL: 0,
            pnlByBet: [],
            pnlBySport: {},
            pnlByBook: {},
            pnlByFeature: {},
            roi: 0,
            roiAnnualized: 0,
            sharpeRatio: 0,
            sortinoRatio: 0,
            calmarRatio: 0,
            maxDrawdown: 0,
            valueAtRisk: 0,
            expectedShortfall: 0,
            beta: 0,
            alpha: 0
        };
        this.transactionCosts = {
            totalCosts: 0,
            costBreakdown: {
                commissions: 0,
                spreads: 0,
                slippage: 0,
                taxes: 0,
                other: 0
            },
            costPerBet: 0,
            costAsPercentageOfStake: 0,
            costAsPercentageOfPnL: 0,
            costOptimization: {
                recommendations: [],
                potentialSavings: 0,
                optimalBooks: [],
                timingRecommendations: []
            }
        };
        this.attribution = {
            totalReturn: 0,
            attributions: {
                sport: {},
                feature: {},
                timing: {},
                book: {},
                kelly: 0,
                lineShoppingEdge: 0,
                professionalFeatures: 0
            },
            explanations: []
        };
        this.riskReports = [];
        this.benchmarkData = {
            initialBankroll,
            marketBenchmark: [], // S&P 500 or betting market index
            riskFreeRate: 0.04, // 4% annual risk-free rate
            bettingBenchmark: [] // Industry average betting returns
        };
        this.logger.info('Financial reports system initialized', {
            initialBankroll,
            reportingEnabled: true
        });
    }
    startReportingUpdates() {
        // Update financial metrics every 30 seconds
        this.reportingInterval = setInterval(() => {
            this.updateRealTimePnL();
            this.updateTransactionCosts();
            this.updatePerformanceAttribution();
            this.emit('financialMetricsUpdated', {
                realTimePnL: this.realTimePnL,
                transactionCosts: this.transactionCosts,
                attribution: this.attribution
            });
        }, 30000);
    }
    // ========================================
    // Bet Tracking and P&L Updates
    // ========================================
    trackBetPlacement(bet, transactionCosts) {
        // Record transaction costs
        if (transactionCosts) {
            this.recordTransactionCosts(bet.id, transactionCosts);
        }
        // Create initial P&L entry
        const betPnL = {
            betId: bet.id,
            propId: bet.propId,
            sport: bet.sport,
            market: bet.market,
            stake: bet.stake,
            odds: bet.odds,
            result: 'PENDING',
            pnl: -bet.stake, // Initially negative (stake invested)
            roi: -1, // Initially -100% (stake invested)
            clv: 0, // Will be updated when available
            professionalScore: bet.professionalScore,
            timestamp: bet.placedAt,
            settledAt: undefined
        };
        this.betPnLHistory.push(betPnL);
        this.realTimePnL.pnlByBet.push(betPnL);
        // Update unrealized P&L
        this.realTimePnL.unrealizedPnL -= bet.stake;
        this.logger.info('Bet placement tracked', {
            betId: bet.id,
            stake: bet.stake,
            sport: bet.sport,
            unrealizedPnL: this.realTimePnL.unrealizedPnL
        });
        this.emit('betPlacementTracked', betPnL);
    }
    updateBetResult(betId, result, payout, clv) {
        const betPnL = this.betPnLHistory.find(bet => bet.betId === betId);
        if (!betPnL) {
            this.logger.warn('Bet P&L not found for result update', { betId });
            return;
        }
        // Update bet result
        betPnL.result = result;
        betPnL.pnl = payout - betPnL.stake;
        betPnL.roi = betPnL.pnl / betPnL.stake;
        betPnL.settledAt = new Date().toISOString();
        if (clv !== undefined) {
            betPnL.clv = clv;
        }
        // Update realized/unrealized P&L
        this.realTimePnL.unrealizedPnL += betPnL.stake; // Remove from unrealized
        this.realTimePnL.realizedPnL += betPnL.pnl;
        // Update daily P&L
        const date = betPnL.settledAt.split('T')[0];
        const currentDailyPnL = this.dailyPnL.get(date) || 0;
        this.dailyPnL.set(date, currentDailyPnL + betPnL.pnl);
        this.logger.info('Bet result updated', {
            betId,
            result,
            pnl: betPnL.pnl,
            roi: betPnL.roi,
            clv: betPnL.clv,
            realizedPnL: this.realTimePnL.realizedPnL
        });
        this.emit('betResultUpdated', betPnL);
    }
    // ========================================
    // Transaction Cost Tracking
    // ========================================
    recordTransactionCosts(betId, costs) {
        const transaction = {
            betId,
            timestamp: new Date().toISOString(),
            costs,
            totalCost: costs.commission + costs.spread + costs.slippage + costs.other
        };
        this.transactionHistory.push(transaction);
        // Update total costs
        this.transactionCosts.totalCosts += transaction.totalCost;
        this.transactionCosts.costBreakdown.commissions += costs.commission;
        this.transactionCosts.costBreakdown.spreads += costs.spread;
        this.transactionCosts.costBreakdown.slippage += costs.slippage;
        this.transactionCosts.costBreakdown.other += costs.other;
        this.logger.debug('Transaction costs recorded', {
            betId,
            totalCost: transaction.totalCost,
            breakdown: costs
        });
    }
    // ========================================
    // Real-Time P&L Updates
    // ========================================
    updateRealTimePnL() {
        const settledBets = this.betPnLHistory.filter(bet => bet.result !== 'PENDING');
        const totalStaked = this.betPnLHistory.reduce((sum, bet) => sum + bet.stake, 0);
        // Basic P&L metrics
        this.realTimePnL.totalPnL = this.realTimePnL.realizedPnL + this.realTimePnL.unrealizedPnL;
        // Session P&L (current session)
        const sessionStart = new Date();
        sessionStart.setHours(0, 0, 0, 0); // Start of day
        const sessionBets = settledBets.filter(bet => new Date(bet.timestamp) >= sessionStart);
        this.realTimePnL.sessionPnL = sessionBets.reduce((sum, bet) => sum + bet.pnl, 0);
        // Daily/Weekly/Monthly P&L
        this.calculatePeriodPnL();
        // ROI calculations
        if (totalStaked > 0) {
            this.realTimePnL.roi = this.realTimePnL.totalPnL / totalStaked;
            // Annualized ROI (assuming 365 days)
            const daysSinceStart = this.calculateDaysSinceStart();
            if (daysSinceStart > 0) {
                this.realTimePnL.roiAnnualized =
                    Math.pow(1 + this.realTimePnL.roi, 365 / daysSinceStart) - 1;
            }
        }
        // Risk-adjusted metrics
        this.calculateRiskAdjustedMetrics(settledBets);
        // P&L by category
        this.updatePnLByCategory();
    }
    calculatePeriodPnL() {
        const today = new Date().toISOString().split('T')[0];
        // Daily P&L
        this.realTimePnL.dailyPnL = this.dailyPnL.get(today) || 0;
        // Weekly P&L
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        this.realTimePnL.weeklyPnL = this.betPnLHistory
            .filter(bet => bet.settledAt && new Date(bet.settledAt) >= weekStart)
            .reduce((sum, bet) => sum + bet.pnl, 0);
        // Monthly P&L
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        this.realTimePnL.monthlyPnL = this.betPnLHistory
            .filter(bet => bet.settledAt && new Date(bet.settledAt) >= monthStart)
            .reduce((sum, bet) => sum + bet.pnl, 0);
    }
    calculateRiskAdjustedMetrics(settledBets) {
        if (settledBets.length < 2)
            return;
        const returns = settledBets.map(bet => bet.roi);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        // Calculate variance and standard deviation
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        // Sharpe Ratio
        const excessReturn = avgReturn - (this.benchmarkData.riskFreeRate / 365); // Daily risk-free rate
        this.realTimePnL.sharpeRatio = stdDev > 0 ? excessReturn / stdDev : 0;
        // Sortino Ratio (only downside deviation)
        const downsideReturns = returns.filter(r => r < avgReturn);
        if (downsideReturns.length > 0) {
            const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / downsideReturns.length;
            const downsideStdDev = Math.sqrt(downsideVariance);
            this.realTimePnL.sortinoRatio = downsideStdDev > 0 ? excessReturn / downsideStdDev : 0;
        }
        // Max Drawdown
        this.realTimePnL.maxDrawdown = this.calculateMaxDrawdown(settledBets);
        // Calmar Ratio
        this.realTimePnL.calmarRatio = this.realTimePnL.maxDrawdown > 0
            ? this.realTimePnL.roiAnnualized / this.realTimePnL.maxDrawdown
            : 0;
        // Value at Risk (95% confidence)
        const sortedReturns = [...returns].sort((a, b) => a - b);
        const varIndex = Math.floor(sortedReturns.length * 0.05);
        this.realTimePnL.valueAtRisk = sortedReturns[varIndex] || 0;
        // Expected Shortfall (Conditional VaR)
        const tailReturns = sortedReturns.slice(0, varIndex);
        this.realTimePnL.expectedShortfall = tailReturns.length > 0
            ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length
            : 0;
        // Beta and Alpha (relative to benchmark)
        if (this.benchmarkData.bettingBenchmark.length > 0) {
            const { beta, alpha } = this.calculateBetaAlpha(returns);
            this.realTimePnL.beta = beta;
            this.realTimePnL.alpha = alpha;
        }
    }
    calculateMaxDrawdown(settledBets) {
        let peak = 0;
        let maxDrawdown = 0;
        let runningPnL = 0;
        for (const bet of settledBets) {
            runningPnL += bet.pnl;
            peak = Math.max(peak, runningPnL);
            if (peak > 0) {
                const drawdown = (peak - runningPnL) / peak;
                maxDrawdown = Math.max(maxDrawdown, drawdown);
            }
        }
        return maxDrawdown;
    }
    calculateBetaAlpha(returns) {
        const benchmarkReturns = this.benchmarkData.bettingBenchmark;
        if (benchmarkReturns.length === 0 || returns.length !== benchmarkReturns.length) {
            return { beta: 0, alpha: 0 };
        }
        const avgPortfolioReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const avgBenchmarkReturn = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
        // Calculate covariance and variance
        let covariance = 0;
        let benchmarkVariance = 0;
        for (let i = 0; i < returns.length; i++) {
            const portfolioExcess = returns[i] - avgPortfolioReturn;
            const benchmarkExcess = benchmarkReturns[i] - avgBenchmarkReturn;
            covariance += portfolioExcess * benchmarkExcess;
            benchmarkVariance += benchmarkExcess * benchmarkExcess;
        }
        covariance /= returns.length;
        benchmarkVariance /= returns.length;
        const beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : 0;
        const alpha = avgPortfolioReturn - (this.benchmarkData.riskFreeRate / 365) -
            (beta * (avgBenchmarkReturn - this.benchmarkData.riskFreeRate / 365));
        return { beta, alpha };
    }
    updatePnLByCategory() {
        // P&L by sport
        this.realTimePnL.pnlBySport = {};
        this.realTimePnL.pnlByBook = {};
        this.realTimePnL.pnlByFeature = {};
        for (const bet of this.betPnLHistory) {
            if (bet.result === 'PENDING')
                continue;
            // By sport
            this.realTimePnL.pnlBySport[bet.sport] =
                (this.realTimePnL.pnlBySport[bet.sport] || 0) + bet.pnl;
            // By book (would need book info in bet data)
            // this.realTimePnL.pnlByBook[bet.book] =
            //   (this.realTimePnL.pnlByBook[bet.book] || 0) + bet.pnl;
            // By professional feature performance
            if (bet.professionalScore > 80) {
                this.realTimePnL.pnlByFeature['high_professional'] =
                    (this.realTimePnL.pnlByFeature['high_professional'] || 0) + bet.pnl;
            }
            else if (bet.professionalScore > 65) {
                this.realTimePnL.pnlByFeature['medium_professional'] =
                    (this.realTimePnL.pnlByFeature['medium_professional'] || 0) + bet.pnl;
            }
            else {
                this.realTimePnL.pnlByFeature['low_professional'] =
                    (this.realTimePnL.pnlByFeature['low_professional'] || 0) + bet.pnl;
            }
        }
    }
    // ========================================
    // Transaction Cost Analysis
    // ========================================
    updateTransactionCosts() {
        if (this.transactionHistory.length === 0)
            return;
        // Cost per bet
        this.transactionCosts.costPerBet = this.transactionCosts.totalCosts / this.transactionHistory.length;
        // Cost as percentage of stake
        const totalStaked = this.betPnLHistory.reduce((sum, bet) => sum + bet.stake, 0);
        this.transactionCosts.costAsPercentageOfStake = totalStaked > 0
            ? this.transactionCosts.totalCosts / totalStaked
            : 0;
        // Cost as percentage of P&L
        this.transactionCosts.costAsPercentageOfPnL = this.realTimePnL.totalPnL > 0
            ? this.transactionCosts.totalCosts / this.realTimePnL.totalPnL
            : 0;
        // Update cost optimization recommendations
        this.updateCostOptimization();
    }
    updateCostOptimization() {
        const recommendations = [];
        let potentialSavings = 0;
        // Analyze spread costs
        const avgSpreadCost = this.transactionCosts.costBreakdown.spreads / this.transactionHistory.length;
        if (avgSpreadCost > 0.02) { // If average spread > 2%
            recommendations.push('Consider line shopping to reduce spread costs');
            potentialSavings += this.transactionCosts.costBreakdown.spreads * 0.3; // 30% potential savings
        }
        // Analyze timing costs (slippage)
        const avgSlippage = this.transactionCosts.costBreakdown.slippage / this.transactionHistory.length;
        if (avgSlippage > 0.01) { // If average slippage > 1%
            recommendations.push('Improve bet placement timing to reduce slippage');
            potentialSavings += this.transactionCosts.costBreakdown.slippage * 0.5; // 50% potential savings
        }
        // Analyze book selection
        const bookCosts = this.analyzeBookCosts();
        if (bookCosts.recommendations.length > 0) {
            recommendations.push(...bookCosts.recommendations);
            potentialSavings += bookCosts.potentialSavings;
        }
        this.transactionCosts.costOptimization = {
            recommendations,
            potentialSavings,
            optimalBooks: bookCosts.optimalBooks,
            timingRecommendations: this.getTimingRecommendations()
        };
    }
    analyzeBookCosts() {
        // This would analyze costs by sportsbook
        // Placeholder implementation
        return {
            recommendations: ['Use books with lower commission rates'],
            potentialSavings: 0,
            optimalBooks: ['Book A', 'Book B']
        };
    }
    getTimingRecommendations() {
        // Analyze optimal timing for bet placement
        return [
            'Place bets closer to game time to reduce slippage',
            'Avoid peak betting hours when spreads are wider',
            'Monitor line movements and place bets during optimal windows'
        ];
    }
    // ========================================
    // Performance Attribution
    // ========================================
    updatePerformanceAttribution() {
        this.attribution.totalReturn = this.realTimePnL.totalPnL;
        // Attribution by sport
        this.attribution.attributions.sport = { ...this.realTimePnL.pnlBySport };
        // Attribution by feature
        this.calculateFeatureAttribution();
        // Attribution by timing
        this.calculateTimingAttribution();
        // Attribution by book
        this.attribution.attributions.book = { ...this.realTimePnL.pnlByBook };
        // Kelly sizing attribution
        this.calculateKellyAttribution();
        // Line shopping attribution
        this.calculateLineShoppingAttribution();
        // Professional features attribution
        this.calculateProfessionalFeaturesAttribution();
        // Generate explanations
        this.generateAttributionExplanations();
    }
    calculateFeatureAttribution() {
        const settledBets = this.betPnLHistory.filter(bet => bet.result !== 'PENDING');
        // Group by professional score ranges
        const scoreRanges = {
            'excellent': settledBets.filter(bet => bet.professionalScore >= 80),
            'good': settledBets.filter(bet => bet.professionalScore >= 65 && bet.professionalScore < 80),
            'average': settledBets.filter(bet => bet.professionalScore < 65)
        };
        for (const [range, bets] of Object.entries(scoreRanges)) {
            this.attribution.attributions.feature[range] =
                bets.reduce((sum, bet) => sum + bet.pnl, 0);
        }
    }
    calculateTimingAttribution() {
        const settledBets = this.betPnLHistory.filter(bet => bet.result !== 'PENDING');
        // Group by hour of placement
        const hourlyGroups = settledBets.reduce((acc, bet) => {
            const hour = new Date(bet.timestamp).getHours();
            const timeSlot = this.getTimeSlot(hour);
            if (!acc[timeSlot])
                acc[timeSlot] = [];
            acc[timeSlot].push(bet);
            return acc;
        }, {});
        for (const [timeSlot, bets] of Object.entries(hourlyGroups)) {
            this.attribution.attributions.timing[timeSlot] =
                bets.reduce((sum, bet) => sum + bet.pnl, 0);
        }
    }
    getTimeSlot(hour) {
        if (hour >= 6 && hour < 12)
            return 'morning';
        if (hour >= 12 && hour < 18)
            return 'afternoon';
        if (hour >= 18 && hour < 24)
            return 'evening';
        return 'night';
    }
    calculateKellyAttribution() {
        // This would calculate the attribution to proper Kelly sizing
        // Placeholder implementation
        this.attribution.attributions.kelly = this.realTimePnL.totalPnL * 0.1; // Assume 10% attribution
    }
    calculateLineShoppingAttribution() {
        // This would calculate the attribution to line shopping
        // Placeholder implementation
        this.attribution.attributions.lineShoppingEdge = this.realTimePnL.totalPnL * 0.05; // Assume 5% attribution
    }
    calculateProfessionalFeaturesAttribution() {
        // This would calculate the attribution to professional features
        // Placeholder implementation
        this.attribution.attributions.professionalFeatures = this.realTimePnL.totalPnL * 0.3; // Assume 30% attribution
    }
    generateAttributionExplanations() {
        const explanations = [];
        // Best performing sport
        const sportPnL = this.attribution.attributions.sport;
        const bestSport = Object.entries(sportPnL).reduce((best, [sport, pnl]) => pnl > (sportPnL[best[0]] || -Infinity) ? [sport, pnl] : best, ['', -Infinity]);
        if (bestSport[1] > 0) {
            explanations.push(`${bestSport[0]} contributed $${bestSport[1].toFixed(2)} to total returns`);
        }
        // Professional features impact
        if (this.attribution.attributions.professionalFeatures > 0) {
            explanations.push(`Professional features system contributed $${this.attribution.attributions.professionalFeatures.toFixed(2)}`);
        }
        // Kelly sizing impact
        if (this.attribution.attributions.kelly > 0) {
            explanations.push(`Proper Kelly sizing contributed $${this.attribution.attributions.kelly.toFixed(2)}`);
        }
        this.attribution.explanations = explanations;
    }
    // ========================================
    // Risk Reporting
    // ========================================
    generateRiskReport(date = new Date().toISOString().split('T')[0]) {
        const settledBets = this.betPnLHistory.filter(bet => bet.result !== 'PENDING' && bet.settledAt?.startsWith(date));
        const report = {
            reportDate: date,
            riskMetrics: {
                var95: this.realTimePnL.valueAtRisk,
                expectedShortfall: this.realTimePnL.expectedShortfall,
                maxDrawdown: this.realTimePnL.maxDrawdown,
                portfolioVolatility: this.calculatePortfolioVolatility(settledBets),
                correlationRisk: this.calculateCorrelationRisk(settledBets),
                concentrationRisk: this.calculateConcentrationRisk(settledBets)
            },
            riskLimits: {
                exposureUtilization: this.calculateExposureUtilization(),
                kellyCompliance: this.calculateKellyCompliance(),
                diversificationScore: this.calculateDiversificationScore(settledBets)
            },
            recommendations: this.generateRiskRecommendations()
        };
        this.riskReports.push(report);
        return report;
    }
    calculatePortfolioVolatility(bets) {
        if (bets.length < 2)
            return 0;
        const returns = bets.map(bet => bet.roi);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }
    calculateCorrelationRisk(bets) {
        // Simplified correlation risk calculation
        const sportsCount = new Set(bets.map(bet => bet.sport)).size;
        const totalBets = bets.length;
        if (totalBets <= 1)
            return 0;
        // Higher concentration = higher correlation risk
        return 1 - (sportsCount / Math.min(totalBets, 7)); // Normalize by max 7 sports
    }
    calculateConcentrationRisk(bets) {
        if (bets.length === 0)
            return 0;
        const totalStaked = bets.reduce((sum, bet) => sum + bet.stake, 0);
        const maxSingleBet = Math.max(...bets.map(bet => bet.stake));
        return maxSingleBet / totalStaked;
    }
    calculateExposureUtilization() {
        const totalStaked = this.betPnLHistory.reduce((sum, bet) => sum + bet.stake, 0);
        return totalStaked / this.benchmarkData.initialBankroll;
    }
    calculateKellyCompliance() {
        // This would calculate Kelly compliance based on actual vs optimal sizing
        // Placeholder implementation
        return 0.85; // 85% compliance
    }
    calculateDiversificationScore(bets) {
        if (bets.length === 0)
            return 1;
        const sportsCount = new Set(bets.map(bet => bet.sport)).size;
        const marketsCount = new Set(bets.map(bet => bet.market.split(' ')[1] || 'other')).size;
        // Combine sport and market diversification
        return Math.min((sportsCount / 7) * 0.6 + (marketsCount / 10) * 0.4, 1);
    }
    generateRiskRecommendations() {
        const recommendations = [];
        if (this.realTimePnL.maxDrawdown > 0.08) {
            recommendations.push('Consider reducing position sizes to limit drawdown risk');
        }
        if (this.realTimePnL.sharpeRatio < 1.0) {
            recommendations.push('Focus on higher-quality opportunities to improve risk-adjusted returns');
        }
        const concentrationRisk = this.calculateConcentrationRisk(this.betPnLHistory);
        if (concentrationRisk > 0.3) {
            recommendations.push('Improve diversification to reduce concentration risk');
        }
        return recommendations;
    }
    // ========================================
    // Utility Methods
    // ========================================
    calculateDaysSinceStart() {
        if (this.betPnLHistory.length === 0)
            return 0;
        const firstBet = this.betPnLHistory[0];
        const daysSince = (Date.now() - new Date(firstBet.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(daysSince, 1); // At least 1 day
    }
    // ========================================
    // Public Methods
    // ========================================
    getFinancialSummary() {
        const settledBets = this.betPnLHistory.filter(bet => bet.result !== 'PENDING');
        const wins = settledBets.filter(bet => bet.result === 'WIN').length;
        const totalStaked = this.betPnLHistory.reduce((sum, bet) => sum + bet.stake, 0);
        return {
            totalPnL: this.realTimePnL.totalPnL,
            roi: this.realTimePnL.roi,
            sharpeRatio: this.realTimePnL.sharpeRatio,
            maxDrawdown: this.realTimePnL.maxDrawdown,
            winRate: settledBets.length > 0 ? wins / settledBets.length : 0,
            totalBets: this.betPnLHistory.length,
            avgBetSize: this.betPnLHistory.length > 0 ? totalStaked / this.betPnLHistory.length : 0,
            transactionCosts: this.transactionCosts.totalCosts
        };
    }
    exportPnLData(format = 'json') {
        if (format === 'csv') {
            return this.exportToCSV();
        }
        return JSON.stringify({
            realTimePnL: this.realTimePnL,
            betHistory: this.betPnLHistory,
            transactionCosts: this.transactionCosts,
            attribution: this.attribution,
            riskReports: this.riskReports
        }, null, 2);
    }
    exportToCSV() {
        const headers = ['Bet ID', 'Sport', 'Market', 'Stake', 'Odds', 'Result', 'P&L', 'ROI', 'CLV', 'Professional Score', 'Timestamp', 'Settled At'];
        const rows = this.betPnLHistory.map(bet => [
            bet.betId,
            bet.sport,
            bet.market,
            bet.stake,
            bet.odds,
            bet.result,
            bet.pnl,
            bet.roi,
            bet.clv,
            bet.professionalScore,
            bet.timestamp,
            bet.settledAt || ''
        ]);
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    // ========================================
    // Cleanup
    // ========================================
    stop() {
        if (this.reportingInterval) {
            clearInterval(this.reportingInterval);
        }
        this.logger.info('Financial reports system stopped');
    }
}
exports.FinancialReportsSystem = FinancialReportsSystem;
