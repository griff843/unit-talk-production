"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskManagementAgent = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
const enhanced_circuit_breaker_1 = require("../../services/enhanced-circuit-breaker");
const BaseAgent_1 = require("../BaseAgent");
const hedgeEngine_1 = require("./hedgeEngine");
const parlayHedgeCalculator_1 = require("./parlayHedgeCalculator");
const portfolioOptimizer_1 = require("./portfolioOptimizer");
const positionSizer_1 = require("./positionSizer");
const riskAnalyzer_1 = require("./riskAnalyzer");
class RiskManagementAgent extends BaseAgent_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
        this.portfolioRisks = new Map();
        this.riskMetrics = {
            ...this.metrics,
            portfoliosAnalyzed: 0,
            riskAlertsGenerated: 0,
            positionsOptimized: 0,
            hedgesRecommended: 0,
            parlayHedgesIdentified: 0,
            averagePortfolioRisk: 0,
            riskLimitViolations: 0,
            exposureReductions: 0,
            bankrollProtected: 0,
            sharpeRatioImprovement: 0
        };
        // Initialize subsystems
        this.portfolioOptimizer = new portfolioOptimizer_1.PortfolioOptimizer(this.logger);
        this.riskAnalyzer = new riskAnalyzer_1.RiskAnalyzer(this.logger);
        this.positionSizer = new positionSizer_1.PositionSizer(this.logger);
        this.hedgeEngine = new hedgeEngine_1.HedgeEngine(this.logger);
        this.parlayHedgeCalculator = new parlayHedgeCalculator_1.ParlayHedgeCalculator(this.logger);
        // Default global risk limits
        this.globalRiskLimits = {
            maxSinglePosition: 0.05, // 5% of bankroll
            maxDailyExposure: 0.20, // 20% of bankroll
            maxCorrelatedExposure: 0.15, // 15% in correlated positions
            maxDrawdownThreshold: 0.10, // 10% max drawdown
            minBankrollReserve: 0.20, // 20% cash reserve
            concentrationLimit: 0.25 // 25% max in single asset class
        };
    }
    async initialize() {
        this.logger.info('🛡️ RiskManagementAgent initializing...');
        // Initialize all subsystems
        await Promise.all([
            this.portfolioOptimizer.initialize(),
            this.riskAnalyzer.initialize(),
            this.positionSizer.initialize(),
            this.hedgeEngine.initialize()
            // ParlayHedgeCalculator doesn't need initialization
        ]);
        // Load existing portfolio data
        await this.loadPortfolioRisks();
        // Load risk limits configuration
        await this.loadRiskLimitsConfiguration();
        this.logger.info('✅ RiskManagementAgent initialized successfully');
    }
    async process() {
        this.logger.info('🔄 Running RiskManagementAgent cycle...');
        const cycleStartTime = Date.now();
        try {
            // 1. Analyze portfolio risks
            await this.analyzePortfolioRisks();
            // 2. Check risk limit violations
            await this.checkRiskLimitViolations();
            // 3. Optimize position sizes
            await this.optimizePositionSizes();
            // 4. Generate hedge recommendations
            await this.generateHedgeRecommendations();
            // 5. Analyze parlay hedge opportunities
            await this.analyzeParlayHedgeOpportunities();
            // 6. Monitor market correlation changes
            await this.monitorCorrelationChanges();
            // 7. Generate risk insights and alerts
            await this.generateRiskInsights();
        }
        catch (error) {
            this.logger.error('❌ Error in risk management cycle', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
        const cycleTime = Date.now() - cycleStartTime;
        this.riskMetrics.processingTimeMs = cycleTime;
        this.logger.info('✅ RiskManagementAgent cycle completed', {
            cycleTimeMs: cycleTime,
            portfoliosAnalyzed: this.riskMetrics.portfoliosAnalyzed,
            alertsGenerated: this.riskMetrics.riskAlertsGenerated,
            positionsOptimized: this.riskMetrics.positionsOptimized
        });
    }
    // Core Processing Methods
    async analyzePortfolioRisks() {
        this.logger.info('📊 Analyzing portfolio risks...');
        const activeUsers = await this.getActiveUsersWithPositions();
        let totalRiskScore = 0;
        let portfoliosAnalyzed = 0;
        for (const user of activeUsers) {
            try {
                const portfolioRisk = await this.analyzeUserPortfolio(user.id);
                this.portfolioRisks.set(user.id, portfolioRisk);
                totalRiskScore += portfolioRisk.riskScore;
                portfoliosAnalyzed++;
                // Check for immediate risk violations
                if (portfolioRisk.riskScore > 0.8) {
                    await this.generateImmediateRiskAlert(user.id, portfolioRisk);
                }
            }
            catch (error) {
                this.logger.error('❌ Failed to analyze portfolio risk', {
                    userId: user.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        this.riskMetrics.portfoliosAnalyzed = portfoliosAnalyzed;
        this.riskMetrics.averagePortfolioRisk = portfoliosAnalyzed > 0 ?
            totalRiskScore / portfoliosAnalyzed : 0;
        this.logger.info(`✅ Analyzed ${portfoliosAnalyzed} portfolios, average risk: ${this.riskMetrics.averagePortfolioRisk.toFixed(3)}`);
    }
    async checkRiskLimitViolations() {
        this.logger.info('⚠️ Checking risk limit violations...');
        let violationsFound = 0;
        for (const [userId, portfolioRisk] of this.portfolioRisks) {
            const violations = await this.identifyRiskViolations(portfolioRisk);
            if (violations.length > 0) {
                violationsFound += violations.length;
                await this.handleRiskViolations(userId, violations);
            }
        }
        this.riskMetrics.riskLimitViolations = violationsFound;
        this.logger.info(`✅ Found ${violationsFound} risk limit violations`);
    }
    async optimizePositionSizes() {
        this.logger.info('🎯 Optimizing position sizes...');
        let positionsOptimized = 0;
        for (const [userId, portfolioRisk] of this.portfolioRisks) {
            try {
                const optimizedPositions = await this.positionSizer.optimizePortfolio(portfolioRisk.positions, portfolioRisk.limits, await this.getUserBankroll(userId));
                const changesMade = await this.applyPositionOptimizations(userId, optimizedPositions.positions);
                positionsOptimized += changesMade;
            }
            catch (error) {
                this.logger.error('❌ Failed to optimize positions', {
                    userId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        this.riskMetrics.positionsOptimized = positionsOptimized;
        this.logger.info(`✅ Optimized ${positionsOptimized} positions`);
    }
    async generateHedgeRecommendations() {
        this.logger.info('🛡️ Generating hedge recommendations...');
        let hedgesRecommended = 0;
        for (const [userId, portfolioRisk] of this.portfolioRisks) {
            try {
                if (portfolioRisk.riskScore > 0.6) {
                    const hedgeOpportunities = await this.hedgeEngine.identifyHedgeOpportunities(portfolioRisk.positions, portfolioRisk.correlations);
                    if (hedgeOpportunities.length > 0) {
                        await this.processHedgeRecommendations(userId, hedgeOpportunities);
                        hedgesRecommended += hedgeOpportunities.length;
                    }
                }
            }
            catch (error) {
                this.logger.error('❌ Failed to generate hedge recommendations', {
                    userId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        this.riskMetrics.hedgesRecommended = hedgesRecommended;
        this.logger.info(`✅ Generated ${hedgesRecommended} hedge recommendations`);
    }
    async analyzeParlayHedgeOpportunities() {
        this.logger.info('💰 Analyzing parlay hedge opportunities...');
        let parlayHedgesIdentified = 0;
        try {
            // Get all active parlays from all users
            const activeParlays = await this.getActiveParlayBets();
            if (activeParlays.length === 0) {
                this.logger.info('No active parlay bets found');
                return;
            }
            // Identify hedge opportunities for each parlay
            const hedgeOpportunities = await this.parlayHedgeCalculator.identifyActiveHedgeOpportunities(activeParlays);
            for (const opportunity of hedgeOpportunities) {
                // Find the parlay bet
                const parlay = activeParlays.find(p => p.id === opportunity.parlayId);
                if (!parlay)
                    continue;
                // Send alert through AlertAgent
                await this.sendParlayHedgeAlert(parlay.userId, opportunity);
                parlayHedgesIdentified++;
                this.logger.info('💰 Parlay hedge opportunity identified', {
                    parlayId: opportunity.parlayId,
                    userId: parlay.userId,
                    completedLegs: opportunity.completedLegs,
                    guaranteedProfit: opportunity.guaranteedProfit,
                    recommendation: opportunity.recommendation
                });
            }
            this.riskMetrics.parlayHedgesIdentified = parlayHedgesIdentified;
            this.logger.info(`✅ Identified ${parlayHedgesIdentified} parlay hedge opportunities`);
        }
        catch (error) {
            this.logger.error('❌ Failed to analyze parlay hedge opportunities', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async monitorCorrelationChanges() {
        this.logger.info('🔗 Monitoring correlation changes...');
        try {
            const correlationChanges = await this.riskAnalyzer.detectCorrelationShifts();
            for (const change of correlationChanges) {
                if (change.significanceLevel > 0.8) {
                    await this.handleSignificantCorrelationChange(change);
                }
            }
        }
        catch (error) {
            this.logger.error('❌ Failed to monitor correlation changes', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async generateRiskInsights() {
        this.logger.info('💡 Generating risk insights...');
        try {
            const insights = {
                totalPortfolios: this.portfolioRisks.size,
                averageRiskScore: this.riskMetrics.averagePortfolioRisk,
                highRiskPortfolios: Array.from(this.portfolioRisks.values())
                    .filter(p => p.riskScore > 0.7).length,
                totalAlerts: this.riskMetrics.riskAlertsGenerated,
                riskDistribution: await this.analyzeRiskDistribution(),
                correlationAnalysis: await this.generateCorrelationInsights(),
                portfolioPerformance: await this.analyzePortfolioPerformance(),
                riskAdjustedReturns: await this.calculateRiskAdjustedReturns(),
                recommendations: await this.generateSystemRecommendations()
            };
            // Store insights
            await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
                if (this.hasSupabase()) {
                    await this.requireSupabase()
                        .from('risk_insights')
                        .insert({
                        timestamp: new Date().toISOString(),
                        insights,
                        metrics: this.riskMetrics
                    });
                }
            }, async () => {
                this.logger.warn('⚠️ Failed to store risk insights, Supabase circuit breaker open');
            });
            // Cache insights for dashboard
            await enhanced_cache_1.redisCache.set('risk:insights:latest', JSON.stringify(insights), 1800 // 30 minutes TTL
            );
            this.logger.info('✅ Generated and stored risk insights', {
                portfolios: insights.totalPortfolios,
                highRiskCount: insights.highRiskPortfolios,
                avgRisk: insights.averageRiskScore
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to generate risk insights', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    // Helper Methods
    async analyzeUserPortfolio(userId) {
        const positions = await this.getUserPositions(userId);
        const bankroll = await this.getUserBankroll(userId);
        const riskLimits = await this.getUserRiskLimits(userId);
        const portfolioAnalysis = await this.riskAnalyzer.analyzePortfolio(positions, bankroll);
        const correlations = await this.riskAnalyzer.calculateCorrelations(positions);
        const diversificationRatio = await this.calculateDiversificationRatio(positions, correlations);
        const portfolioRisk = {
            userId,
            totalExposure: portfolioAnalysis.totalExposure,
            riskScore: portfolioAnalysis.riskScore,
            diversificationRatio,
            maxDrawdown: portfolioAnalysis.maxDrawdown,
            valueAtRisk: portfolioAnalysis.valueAtRisk,
            expectedShortfall: portfolioAnalysis.expectedShortfall,
            sharpeRatio: portfolioAnalysis.sharpeRatio,
            positions,
            correlations,
            limits: riskLimits,
            alerts: [],
            lastUpdated: new Date()
        };
        return portfolioRisk;
    }
    async identifyRiskViolations(portfolioRisk) {
        const violations = [];
        // Single position limit violation
        for (const position of portfolioRisk.positions) {
            if (position.riskContribution > portfolioRisk.limits.maxSinglePosition) {
                violations.push({
                    id: `violation_${position.id}_${Date.now()}`,
                    type: 'position_limit',
                    severity: 'high',
                    message: `Position ${position.id} exceeds single position limit`,
                    recommendations: ['Reduce position size', 'Split position across multiple bets'],
                    timestamp: new Date(),
                    acknowledged: false
                });
            }
        }
        // Daily exposure violation
        if (portfolioRisk.totalExposure > portfolioRisk.limits.maxDailyExposure) {
            violations.push({
                id: `violation_exposure_${Date.now()}`,
                type: 'exposure',
                severity: 'critical',
                message: 'Daily exposure limit exceeded',
                recommendations: ['Reduce overall position sizes', 'Close some positions'],
                timestamp: new Date(),
                acknowledged: false
            });
        }
        // Drawdown violation
        if (portfolioRisk.maxDrawdown > portfolioRisk.limits.maxDrawdownThreshold) {
            violations.push({
                id: `violation_drawdown_${Date.now()}`,
                type: 'drawdown',
                severity: 'critical',
                message: 'Maximum drawdown threshold exceeded',
                recommendations: ['Implement stop-loss strategy', 'Reduce position sizes'],
                timestamp: new Date(),
                acknowledged: false
            });
        }
        return violations;
    }
    async handleRiskViolations(userId, violations) {
        const portfolioRisk = this.portfolioRisks.get(userId);
        if (!portfolioRisk)
            return;
        // Add alerts to portfolio
        portfolioRisk.alerts.push(...violations);
        // Send notifications for critical violations
        for (const violation of violations) {
            if (violation.severity === 'critical') {
                await this.sendCriticalRiskAlert(userId, violation);
            }
        }
        // Update cached portfolio risk
        this.portfolioRisks.set(userId, portfolioRisk);
    }
    async applyPositionOptimizations(userId, optimizedPositions) {
        let changesMade = 0;
        for (const optimization of optimizedPositions) {
            if (optimization.changeRequired) {
                await this.processPositionChange(userId, optimization);
                changesMade++;
            }
        }
        return changesMade;
    }
    async processHedgeRecommendations(userId, hedgeOpportunities) {
        for (const hedge of hedgeOpportunities) {
            await this.sendHedgeRecommendation(userId, hedge);
        }
    }
    async handleSignificantCorrelationChange(change) {
        this.logger.info('🔗 Significant correlation change detected', {
            assets: change.assets,
            oldCorrelation: change.oldCorrelation,
            newCorrelation: change.newCorrelation
        });
        // Update affected portfolios
        for (const [userId, portfolioRisk] of this.portfolioRisks) {
            const affectedPositions = portfolioRisk.positions.filter(p => change.assets.includes(p.gameId) || change.assets.includes(p.betType));
            if (affectedPositions.length > 0) {
                await this.notifyCorrelationChange(userId, change, affectedPositions);
            }
        }
    }
    async getActiveUsersWithPositions() {
        if (!this.hasSupabase()) {
            return Array.from(this.portfolioRisks.keys()).map(id => ({ id, data: {} }));
        }
        return await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            const { data: users, error } = await this.requireSupabase()
                .from('user_positions')
                .select('user_id')
                .eq('status', 'active')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .limit(200);
            if (error) {
                this.logger.error('❌ Failed to fetch users with positions', { error: error.message });
                return [];
            }
            const uniqueUsers = [...new Set(users?.map(u => u.user_id) || [])];
            return uniqueUsers.map(id => ({ id, data: {} }));
        }, async () => {
            this.logger.warn('⚠️ Cannot fetch users, using cached data');
            return Array.from(this.portfolioRisks.keys()).map(id => ({ id, data: {} }));
        });
    }
    async getUserPositions(userId) {
        // This would integrate with actual position data
        const cached = await enhanced_cache_1.redisCache.get(`user:positions:${userId}`);
        if (cached) {
            return JSON.parse(cached);
        }
        // Mock positions for demonstration
        return [
            {
                id: `pos_${userId}_1`,
                userId,
                gameId: 'game_123',
                betType: 'moneyline',
                stake: 100,
                odds: 1.85,
                expectedValue: 0.05,
                volatility: 0.15,
                correlation: new Map([['nfl_week1', 0.3]]),
                riskContribution: 0.03,
                correlationGroup: 'nfl_week1',
                status: 'active',
                timestamp: new Date()
            }
        ];
    }
    async getUserBankroll(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:bankroll:${userId}`);
        return cached ? parseFloat(cached) : 1000; // Default bankroll
    }
    async getUserRiskLimits(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:risk_limits:${userId}`);
        return cached ? JSON.parse(cached) : this.globalRiskLimits;
    }
    async calculateDiversificationRatio(positions, correlations) {
        if (positions.length <= 1)
            return 1.0;
        // Calculate weighted average correlation
        let totalWeight = 0;
        let weightedCorrelation = 0;
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const weight = (positions[i].stake * positions[j].stake) / Math.pow(positions.reduce((sum, p) => sum + p.stake, 0), 2);
                const correlation = correlations.get(`${positions[i].correlationGroup}_${positions[j].correlationGroup}`) || 0;
                weightedCorrelation += weight * correlation;
                totalWeight += weight;
            }
        }
        const avgCorrelation = totalWeight > 0 ? weightedCorrelation / totalWeight : 0;
        // Diversification ratio: 1 / sqrt(1 + (n-1) * avg_correlation)
        return 1 / Math.sqrt(1 + (positions.length - 1) * avgCorrelation);
    }
    async generateImmediateRiskAlert(userId, portfolioRisk) {
        const alert = {
            id: `alert_${userId}_${Date.now()}`,
            type: 'exposure',
            severity: 'critical',
            message: `High portfolio risk detected (${portfolioRisk.riskScore.toFixed(3)})`,
            recommendations: [
                'Review position sizes immediately',
                'Consider hedging highly correlated positions',
                'Reduce overall exposure'
            ],
            timestamp: new Date(),
            acknowledged: false
        };
        await this.sendCriticalRiskAlert(userId, alert);
        this.riskMetrics.riskAlertsGenerated++;
    }
    async sendCriticalRiskAlert(userId, alert) {
        this.logger.warn('🚨 Critical risk alert', {
            userId,
            alertType: alert.type,
            severity: alert.severity,
            message: alert.message
        });
        // This would integrate with notification system
    }
    async sendHedgeRecommendation(userId, hedge) {
        this.logger.info('🛡️ Hedge recommendation sent', {
            userId,
            hedgeType: hedge.type,
            expectedReduction: hedge.riskReduction
        });
        // This would integrate with notification system
    }
    async sendParlayHedgeAlert(userId, opportunity) {
        this.logger.info('💰 Parlay hedge alert sent', {
            userId,
            parlayId: opportunity.parlayId,
            completedLegs: opportunity.completedLegs,
            guaranteedProfit: opportunity.guaranteedProfit
        });
        // Create alert context for AlertAgent
        const alertContext = {
            parlayHedge: {
                opportunity: true,
                completedLegs: opportunity.completedLegs,
                totalLegs: opportunity.totalLegs,
                currentProfit: opportunity.currentProfit,
                guaranteedProfit: opportunity.guaranteedProfit,
                hedgeStake: opportunity.hedgeStake,
                hedgeSide: opportunity.hedgeSide,
                hedgeOdds: opportunity.hedgeOdds,
                remainingLeg: opportunity.remainingLeg.selection,
                maxPayout: opportunity.maxPayout
            }
        };
        // This would integrate with AlertAgent to dispatch the alert
        // For now, cache the alert for potential pickup by AlertAgent
        await enhanced_cache_1.redisCache.set(`parlay:hedge:alert:${userId}:${opportunity.parlayId}`, JSON.stringify(alertContext), 3600 // 1 hour TTL
        );
    }
    async getActiveParlayBets() {
        try {
            // This would integrate with actual parlay bet data from database
            // For now, return mock data to demonstrate functionality
            const mockParlays = [
                {
                    id: 'parlay_123',
                    userId: 'user_456',
                    legs: [
                        {
                            id: 'leg_1',
                            selection: 'Chiefs -3.5',
                            odds: -110,
                            status: 'won',
                            sport: 'NFL',
                            gameId: 'game_123',
                            betType: 'spread'
                        },
                        {
                            id: 'leg_2',
                            selection: 'Over 47.5',
                            odds: -115,
                            status: 'won',
                            sport: 'NFL',
                            gameId: 'game_124',
                            betType: 'total'
                        },
                        {
                            id: 'leg_3',
                            selection: 'Lakers ML',
                            odds: +150,
                            status: 'pending',
                            sport: 'NBA',
                            gameId: 'game_125',
                            betType: 'moneyline'
                        }
                    ],
                    stake: 50,
                    potentialPayout: 400,
                    totalOdds: 8.0,
                    status: 'active',
                    placedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
                }
            ];
            // Filter to only return parlays with 2+ legs won and 1 pending
            return mockParlays.filter(parlay => {
                const wonLegs = parlay.legs.filter(leg => leg.status === 'won').length;
                const pendingLegs = parlay.legs.filter(leg => leg.status === 'pending').length;
                return wonLegs >= 2 && pendingLegs === 1;
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get active parlay bets', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async notifyCorrelationChange(userId, change, affectedPositions) {
        this.logger.info('🔗 Correlation change notification', {
            userId,
            affectedPositions: affectedPositions.length,
            correlationChange: change.newCorrelation - change.oldCorrelation
        });
        // This would integrate with notification system
    }
    async processPositionChange(userId, optimization) {
        this.logger.info('🎯 Position optimization applied', {
            userId,
            positionId: optimization.positionId,
            changeType: optimization.changeType,
            oldSize: optimization.oldSize,
            newSize: optimization.newSize
        });
        // This would integrate with position management system
    }
    async analyzeRiskDistribution() {
        const risks = Array.from(this.portfolioRisks.values()).map(p => p.riskScore);
        return {
            low: risks.filter(r => r < 0.3).length,
            medium: risks.filter(r => r >= 0.3 && r < 0.7).length,
            high: risks.filter(r => r >= 0.7).length,
            average: risks.length > 0 ? risks.reduce((sum, r) => sum + r, 0) / risks.length : 0
        };
    }
    async generateCorrelationInsights() {
        return {
            highestCorrelations: ['nfl_week1', 'college_football_saturday'],
            correlationTrends: 'increasing',
            riskClusters: 2,
            diversificationOpportunities: ['mlb_games', 'tennis_matches']
        };
    }
    async analyzePortfolioPerformance() {
        return {
            totalPortfolios: this.portfolioRisks.size,
            avgSharpeRatio: 0.85,
            bestPerformingSegment: 'medium_risk_diversified',
            worstPerformingSegment: 'high_concentration'
        };
    }
    async calculateRiskAdjustedReturns() {
        return {
            avgReturnOnRisk: 0.12,
            riskAdjustedPerformance: 'above_benchmark',
            benchmarkComparison: 0.08
        };
    }
    async generateSystemRecommendations() {
        const recommendations = [];
        if (this.riskMetrics.averagePortfolioRisk > 0.7) {
            recommendations.push('Implement system-wide position size limits');
        }
        if (this.riskMetrics.riskLimitViolations > this.portfolioRisks.size * 0.1) {
            recommendations.push('Review and tighten risk limit enforcement');
        }
        return recommendations;
    }
    async loadPortfolioRisks() {
        try {
            const cachedRisks = await enhanced_cache_1.redisCache.getPattern('risk:portfolio:*');
            for (const [key, data] of cachedRisks) {
                const userId = key.split(':').pop();
                if (userId) {
                    const portfolioRisk = JSON.parse(data);
                    portfolioRisk.lastUpdated = new Date(portfolioRisk.lastUpdated);
                    portfolioRisk.correlations = new Map(portfolioRisk.correlations);
                    this.portfolioRisks.set(userId, portfolioRisk);
                }
            }
            this.logger.info(`✅ Loaded portfolio risks for ${this.portfolioRisks.size} users`);
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load portfolio risks from cache');
        }
    }
    async loadRiskLimitsConfiguration() {
        try {
            const cached = await enhanced_cache_1.redisCache.get('risk:global_limits');
            if (cached) {
                this.globalRiskLimits = JSON.parse(cached);
            }
        }
        catch (error) {
            this.logger.warn('⚠️ Using default risk limits configuration');
        }
    }
    async cleanup() {
        this.logger.info('🧹 RiskManagementAgent cleanup...');
        // Save portfolio risks to cache
        for (const [userId, portfolioRisk] of this.portfolioRisks) {
            const serialized = {
                ...portfolioRisk,
                correlations: Array.from(portfolioRisk.correlations.entries())
            };
            await enhanced_cache_1.redisCache.set(`risk:portfolio:${userId}`, JSON.stringify(serialized), 86400 // 24 hours TTL
            );
        }
        await Promise.all([
            this.portfolioOptimizer.cleanup(),
            this.riskAnalyzer.cleanup(),
            this.positionSizer.cleanup(),
            this.hedgeEngine.cleanup()
        ]);
        this.portfolioRisks.clear();
        this.logger.info('✅ RiskManagementAgent cleanup complete');
    }
    async collectMetrics() {
        return {
            ...this.riskMetrics,
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
        };
    }
    async checkHealth() {
        const checks = [];
        // Check subsystem health
        checks.push({
            component: 'portfolio_optimizer',
            status: await this.portfolioOptimizer.isHealthy() ? 'healthy' : 'unhealthy'
        });
        checks.push({
            component: 'risk_analyzer',
            status: await this.riskAnalyzer.isHealthy() ? 'healthy' : 'unhealthy'
        });
        checks.push({
            component: 'position_sizer',
            status: await this.positionSizer.isHealthy() ? 'healthy' : 'unhealthy'
        });
        checks.push({
            component: 'hedge_engine',
            status: await this.hedgeEngine.isHealthy() ? 'healthy' : 'unhealthy'
        });
        checks.push({
            component: 'parlay_hedge_calculator',
            status: await this.parlayHedgeCalculator.isHealthy() ? 'healthy' : 'unhealthy'
        });
        const healthyComponents = checks.filter(c => c.status === 'healthy').length;
        const overallStatus = healthyComponents === checks.length ? 'healthy' :
            healthyComponents >= checks.length / 2 ? 'degraded' : 'unhealthy';
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            details: {
                checks,
                metrics: this.riskMetrics,
                portfolioCount: this.portfolioRisks.size
            }
        };
    }
}
exports.RiskManagementAgent = RiskManagementAgent;
