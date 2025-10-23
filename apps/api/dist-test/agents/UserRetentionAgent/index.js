"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRetentionAgent = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
const enhanced_circuit_breaker_1 = require("../../services/enhanced-circuit-breaker");
const BaseAgent_1 = require("../BaseAgent");
const churnPredictor_1 = require("./churnPredictor");
const engagementAnalyzer_1 = require("./engagementAnalyzer");
const retentionStrategy_1 = require("./retentionStrategy");
const userSegmentation_1 = require("./userSegmentation");
class UserRetentionAgent extends BaseAgent_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
        this.userRetentionData = new Map();
        this.retentionMetrics = {
            ...this.metrics,
            usersAnalyzed: 0,
            churnPredictionsGenerated: 0,
            retentionCampaignsTriggered: 0,
            churnPreventionSuccess: 0,
            averageChurnRisk: 0,
            highRiskUsers: 0,
            retentionImprovements: 0,
            engagementScore: 0,
            lifeTimeValueIncrease: 0
        };
        // Initialize subsystems
        this.churnPredictor = new churnPredictor_1.ChurnPredictor(this.logger);
        this.retentionStrategy = new retentionStrategy_1.RetentionStrategy(this.logger);
        this.userSegmentation = new userSegmentation_1.UserSegmentation(this.logger);
        this.engagementAnalyzer = new engagementAnalyzer_1.EngagementAnalyzer(this.logger);
    }
    async initialize() {
        this.logger.info('🔄 UserRetentionAgent initializing...');
        // Initialize all subsystems
        await Promise.all([
            this.churnPredictor.initialize(),
            this.retentionStrategy.initialize(),
            this.userSegmentation.initialize(),
            this.engagementAnalyzer.initialize()
        ]);
        // Load existing retention data
        await this.loadRetentionData();
        this.logger.info('✅ UserRetentionAgent initialized successfully');
    }
    async process() {
        this.logger.info('🔄 Running UserRetentionAgent cycle...');
        const cycleStartTime = Date.now();
        try {
            // 1. Analyze user engagement patterns
            await this.analyzeUserEngagement();
            // 2. Generate churn predictions
            await this.generateChurnPredictions();
            // 3. Segment users for targeted retention
            await this.segmentUsersForRetention();
            // 4. Execute retention strategies
            await this.executeRetentionStrategies();
            // 5. Monitor and adjust strategies
            await this.monitorRetentionEffectiveness();
            // 6. Generate retention insights
            await this.generateRetentionInsights();
        }
        catch (error) {
            this.logger.error('❌ Error in user retention cycle', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
        const cycleTime = Date.now() - cycleStartTime;
        this.retentionMetrics.processingTimeMs = cycleTime;
        this.logger.info('✅ UserRetentionAgent cycle completed', {
            cycleTimeMs: cycleTime,
            usersAnalyzed: this.retentionMetrics.usersAnalyzed,
            highRiskUsers: this.retentionMetrics.highRiskUsers,
            campaignsTriggered: this.retentionMetrics.retentionCampaignsTriggered
        });
    }
    // Core Processing Methods
    async analyzeUserEngagement() {
        this.logger.info('📊 Analyzing user engagement patterns...');
        const activeUsers = await this.getActiveUsers();
        let totalEngagement = 0;
        for (const user of activeUsers) {
            try {
                const engagementData = await this.engagementAnalyzer.analyzeUser(user.id);
                // Update user retention data
                const retentionData = this.userRetentionData.get(user.id) || await this.initializeUserRetentionData(user.id);
                retentionData.engagementTrends = engagementData.trends;
                retentionData.lastInteraction = engagementData.lastInteraction;
                this.userRetentionData.set(user.id, retentionData);
                totalEngagement += engagementData.score;
            }
            catch (error) {
                this.logger.error('❌ Failed to analyze user engagement', {
                    userId: user.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        this.retentionMetrics.usersAnalyzed = activeUsers.length;
        this.retentionMetrics.engagementScore = activeUsers.length > 0 ?
            totalEngagement / activeUsers.length : 0;
        this.logger.info(`✅ Analyzed engagement for ${activeUsers.length} users`);
    }
    async generateChurnPredictions() {
        this.logger.info('🔮 Generating churn predictions...');
        let predictionsGenerated = 0;
        let highRiskCount = 0;
        let totalChurnRisk = 0;
        for (const [userId, retentionData] of this.userRetentionData) {
            try {
                const prediction = await this.churnPredictor.predictChurn(userId, {
                    engagementTrends: retentionData.engagementTrends,
                    lastInteraction: retentionData.lastInteraction,
                    lifetimeValue: retentionData.lifetimeValue,
                    segment: retentionData.segment
                });
                // Update retention data with prediction
                retentionData.churnRisk = prediction.riskScore;
                retentionData.churnProbability = prediction.probability;
                retentionData.timeToChurn = prediction.timeToChurn;
                retentionData.riskFactors = prediction.riskFactors;
                if (prediction.riskScore > 0.7) {
                    highRiskCount++;
                }
                totalChurnRisk += prediction.riskScore;
                predictionsGenerated++;
                this.userRetentionData.set(userId, retentionData);
            }
            catch (error) {
                this.logger.error('❌ Failed to generate churn prediction', {
                    userId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        this.retentionMetrics.churnPredictionsGenerated = predictionsGenerated;
        this.retentionMetrics.highRiskUsers = highRiskCount;
        this.retentionMetrics.averageChurnRisk = predictionsGenerated > 0 ?
            totalChurnRisk / predictionsGenerated : 0;
        this.logger.info(`✅ Generated ${predictionsGenerated} churn predictions, ${highRiskCount} high-risk users`);
    }
    async segmentUsersForRetention() {
        this.logger.info('🎯 Segmenting users for targeted retention...');
        const userProfiles = Array.from(this.userRetentionData.entries()).map(([userId, data]) => ({
            userId,
            churnRisk: data.churnRisk,
            lifetimeValue: data.lifetimeValue,
            engagementScore: data.engagementTrends?.currentScore || 0.5,
            daysSinceLastInteraction: this.calculateDaysSince(data.lastInteraction),
            riskFactors: data.riskFactors
        }));
        const segments = await this.userSegmentation.segmentUsers(userProfiles);
        // Update user retention data with segments
        for (const segment of segments) {
            for (const userId of segment.userIds) {
                const retentionData = this.userRetentionData.get(userId);
                if (retentionData) {
                    retentionData.segment = segment.name;
                    this.userRetentionData.set(userId, retentionData);
                }
            }
        }
        this.logger.info(`✅ Segmented ${userProfiles.length} users into ${segments.length} retention segments`);
    }
    async executeRetentionStrategies() {
        this.logger.info('🚀 Executing retention strategies...');
        let campaignsTriggered = 0;
        // Group users by risk level and segment
        const highRiskUsers = Array.from(this.userRetentionData.entries())
            .filter(([_, data]) => data.churnRisk > 0.7);
        const mediumRiskUsers = Array.from(this.userRetentionData.entries())
            .filter(([_, data]) => data.churnRisk > 0.4 && data.churnRisk <= 0.7);
        // Execute high-priority retention campaigns
        for (const [userId, retentionData] of highRiskUsers) {
            try {
                const strategies = await this.retentionStrategy.generateStrategies(userId, {
                    churnRisk: retentionData.churnRisk,
                    riskFactors: retentionData.riskFactors,
                    segment: retentionData.segment,
                    lifetimeValue: retentionData.lifetimeValue,
                    urgency: 'high'
                });
                await this.executeRetentionCampaign(userId, strategies);
                retentionData.retentionStrategies = strategies.map(s => s.type);
                campaignsTriggered++;
            }
            catch (error) {
                this.logger.error('❌ Failed to execute high-risk retention strategy', {
                    userId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        // Execute medium-priority retention campaigns (with rate limiting)
        const mediumRiskBatch = mediumRiskUsers.slice(0, 10); // Limit batch size
        for (const [userId, retentionData] of mediumRiskBatch) {
            try {
                const strategies = await this.retentionStrategy.generateStrategies(userId, {
                    churnRisk: retentionData.churnRisk,
                    riskFactors: retentionData.riskFactors,
                    segment: retentionData.segment,
                    lifetimeValue: retentionData.lifetimeValue,
                    urgency: 'medium'
                });
                await this.executeRetentionCampaign(userId, strategies);
                retentionData.retentionStrategies = strategies.map(s => s.type);
                campaignsTriggered++;
            }
            catch (error) {
                this.logger.error('❌ Failed to execute medium-risk retention strategy', {
                    userId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        this.retentionMetrics.retentionCampaignsTriggered = campaignsTriggered;
        this.logger.info(`✅ Triggered ${campaignsTriggered} retention campaigns`);
    }
    async monitorRetentionEffectiveness() {
        this.logger.info('📈 Monitoring retention effectiveness...');
        let successfulInterventions = 0;
        let retentionImprovements = 0;
        // Check users who had retention campaigns in the past week
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        for (const [userId, retentionData] of this.userRetentionData) {
            if (retentionData.retentionStrategies.length > 0) {
                try {
                    // Re-evaluate churn risk to see if it improved
                    const currentEngagement = await this.engagementAnalyzer.getCurrentEngagement(userId);
                    const newChurnRisk = await this.churnPredictor.calculateRiskScore(userId, currentEngagement);
                    if (newChurnRisk < retentionData.churnRisk - 0.1) { // Significant improvement
                        successfulInterventions++;
                        retentionImprovements++;
                        // Update lifetime value projection
                        const ltvIncrease = await this.calculateLifetimeValueIncrease(userId, retentionData.churnRisk, newChurnRisk);
                        retentionData.lifetimeValue += ltvIncrease;
                        this.retentionMetrics.lifeTimeValueIncrease += ltvIncrease;
                    }
                    // Update churn risk
                    retentionData.churnRisk = newChurnRisk;
                }
                catch (error) {
                    this.logger.error('❌ Failed to monitor retention effectiveness', {
                        userId,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
        }
        this.retentionMetrics.churnPreventionSuccess = successfulInterventions;
        this.retentionMetrics.retentionImprovements = retentionImprovements;
        this.logger.info(`✅ Monitored retention: ${successfulInterventions} successful interventions, ${retentionImprovements} improvements`);
    }
    async generateRetentionInsights() {
        this.logger.info('💡 Generating retention insights...');
        try {
            const insights = {
                totalUsers: this.userRetentionData.size,
                averageChurnRisk: this.retentionMetrics.averageChurnRisk,
                highRiskUsers: this.retentionMetrics.highRiskUsers,
                churnPreventionRate: this.calculateChurnPreventionRate(),
                topRiskFactors: await this.identifyTopRiskFactors(),
                mostEffectiveStrategies: await this.identifyMostEffectiveStrategies(),
                segmentPerformance: await this.analyzeSegmentPerformance(),
                retentionROI: await this.calculateRetentionROI(),
                projectedChurnReduction: this.projectChurnReduction(),
                recommendations: await this.generateRetentionRecommendations()
            };
            // Store insights
            await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
                if (this.hasSupabase()) {
                    await this.requireSupabase()
                        .from('retention_insights')
                        .insert({
                        timestamp: new Date().toISOString(),
                        insights,
                        metrics: this.retentionMetrics
                    });
                }
            }, async () => {
                this.logger.warn('⚠️ Failed to store retention insights, Supabase circuit breaker open');
            });
            // Cache insights for dashboard
            await enhanced_cache_1.redisCache.set('retention:insights:latest', JSON.stringify(insights), 1800 // 30 minutes TTL
            );
            this.logger.info('✅ Generated and stored retention insights', {
                totalUsers: insights.totalUsers,
                churnPreventionRate: insights.churnPreventionRate,
                retentionROI: insights.retentionROI
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to generate retention insights', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    // Helper Methods
    async getActiveUsers() {
        if (!this.hasSupabase()) {
            return Array.from(this.userRetentionData.keys()).map(id => ({ id, data: {} }));
        }
        return await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            const { data: users, error } = await this.requireSupabase()
                .from('user_profiles')
                .select('id, last_activity, created_at, tier, engagement_score')
                .gte('last_activity', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Active in last 30 days
                .limit(500);
            if (error) {
                this.logger.error('❌ Failed to fetch active users', { error: error.message });
                return [];
            }
            return users?.map(user => ({ id: user.id, data: user })) || [];
        }, async () => {
            this.logger.warn('⚠️ Cannot fetch users, using cached data');
            return Array.from(this.userRetentionData.keys()).map(id => ({
                id,
                data: {
                    id,
                    last_activity: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    tier: 'unknown',
                    engagement_score: 0
                }
            }));
        });
    }
    async initializeUserRetentionData(userId) {
        return {
            userId,
            churnRisk: 0.5, // Start with neutral risk
            churnProbability: 0.5,
            timeToChurn: 30, // Default 30 days
            retentionStrategies: [],
            lifetimeValue: 0,
            engagementTrends: {},
            riskFactors: [],
            lastInteraction: new Date(),
            segment: 'new_user'
        };
    }
    async executeRetentionCampaign(userId, strategies) {
        for (const strategy of strategies) {
            try {
                switch (strategy.type) {
                    case 'personalized_email':
                        await this.sendPersonalizedEmail(userId, strategy);
                        break;
                    case 'discount_offer':
                        await this.sendDiscountOffer(userId, strategy);
                        break;
                    case 'feature_highlight':
                        await this.highlightRelevantFeatures(userId, strategy);
                        break;
                    case 'personal_outreach':
                        await this.schedulePersonalOutreach(userId, strategy);
                        break;
                    case 'content_recommendation':
                        await this.recommendPersonalizedContent(userId, strategy);
                        break;
                    default:
                        this.logger.warn('Unknown retention strategy type', { type: strategy.type });
                }
                // Log strategy execution
                await enhanced_cache_1.redisCache.set(`retention:strategy:${userId}:${strategy.type}`, JSON.stringify({ executedAt: new Date().toISOString(), strategy }), 604800 // 7 days TTL
                );
            }
            catch (error) {
                this.logger.error('❌ Failed to execute retention strategy', {
                    userId,
                    strategyType: strategy.type,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
    }
    async sendPersonalizedEmail(userId, strategy) {
        // This would integrate with email service
        this.logger.info('📧 Sending personalized retention email', {
            userId,
            template: strategy.template,
            personalization: strategy.personalization
        });
    }
    async sendDiscountOffer(userId, strategy) {
        // This would integrate with billing/discount system
        this.logger.info('💰 Sending discount offer', {
            userId,
            discountType: strategy.discountType,
            amount: strategy.amount
        });
    }
    async highlightRelevantFeatures(userId, strategy) {
        // This would integrate with in-app messaging
        this.logger.info('✨ Highlighting relevant features', {
            userId,
            features: strategy.features
        });
    }
    async schedulePersonalOutreach(userId, strategy) {
        // This would create a task for customer success team
        this.logger.info('👥 Scheduling personal outreach', {
            userId,
            urgency: strategy.urgency,
            preferredMethod: strategy.method
        });
    }
    async recommendPersonalizedContent(userId, strategy) {
        // This would integrate with content delivery system
        this.logger.info('📚 Recommending personalized content', {
            userId,
            contentType: strategy.contentType,
            topics: strategy.topics
        });
    }
    calculateDaysSince(date) {
        return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    }
    async calculateLifetimeValueIncrease(userId, oldRisk, newRisk) {
        // Simplified LTV calculation based on churn risk improvement
        const riskImprovement = oldRisk - newRisk;
        const avgMonthlyValue = 50; // Average subscription value
        const retentionExtension = riskImprovement * 12; // Months of extended retention
        return avgMonthlyValue * retentionExtension;
    }
    calculateChurnPreventionRate() {
        const totalInterventions = this.retentionMetrics.retentionCampaignsTriggered;
        const successful = this.retentionMetrics.churnPreventionSuccess;
        return totalInterventions > 0 ? successful / totalInterventions : 0;
    }
    async identifyTopRiskFactors() {
        const riskFactorCounts = {};
        for (const [_, data] of this.userRetentionData) {
            for (const factor of data.riskFactors) {
                riskFactorCounts[factor] = (riskFactorCounts[factor] || 0) + 1;
            }
        }
        return Object.entries(riskFactorCounts)
            .map(([factor, frequency]) => ({ factor, frequency }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);
    }
    async identifyMostEffectiveStrategies() {
        // This would analyze the effectiveness of different retention strategies
        return [
            { strategy: 'personalized_email', successRate: 0.34 },
            { strategy: 'discount_offer', successRate: 0.28 },
            { strategy: 'personal_outreach', successRate: 0.45 },
            { strategy: 'feature_highlight', successRate: 0.23 },
            { strategy: 'content_recommendation', successRate: 0.31 }
        ];
    }
    async analyzeSegmentPerformance() {
        const segments = {};
        for (const [_, data] of this.userRetentionData) {
            if (!segments[data.segment]) {
                segments[data.segment] = {
                    userCount: 0,
                    averageChurnRisk: 0,
                    totalChurnRisk: 0,
                    retentionCampaigns: 0
                };
            }
            segments[data.segment].userCount++;
            segments[data.segment].totalChurnRisk += data.churnRisk;
            segments[data.segment].retentionCampaigns += data.retentionStrategies.length;
        }
        // Calculate averages
        for (const segment of Object.values(segments)) {
            if (segment.userCount > 0) {
                segment.averageChurnRisk = segment.totalChurnRisk / segment.userCount;
            }
        }
        return segments;
    }
    async calculateRetentionROI() {
        const retentionCosts = this.retentionMetrics.retentionCampaignsTriggered * 10; // Assume $10 per campaign
        const retentionValue = this.retentionMetrics.lifeTimeValueIncrease;
        return retentionCosts > 0 ? (retentionValue - retentionCosts) / retentionCosts : 0;
    }
    projectChurnReduction() {
        // Project churn reduction based on current intervention success rate
        const currentSuccessRate = this.calculateChurnPreventionRate();
        const highRiskUsers = this.retentionMetrics.highRiskUsers;
        return highRiskUsers * currentSuccessRate;
    }
    async generateRetentionRecommendations() {
        const recommendations = [];
        if (this.retentionMetrics.averageChurnRisk > 0.6) {
            recommendations.push('Increase retention campaign frequency for high-risk segments');
        }
        if (this.calculateChurnPreventionRate() < 0.3) {
            recommendations.push('Review and optimize retention strategy effectiveness');
        }
        if (this.retentionMetrics.highRiskUsers > this.userRetentionData.size * 0.2) {
            recommendations.push('Implement proactive engagement programs to reduce overall churn risk');
        }
        return recommendations;
    }
    async loadRetentionData() {
        try {
            // Load from cache
            const cachedData = await enhanced_cache_1.redisCache.getPattern('retention:user:*');
            for (const [key, data] of cachedData) {
                const userId = key.split(':').pop();
                if (userId) {
                    const retentionData = JSON.parse(data);
                    retentionData.lastInteraction = new Date(retentionData.lastInteraction);
                    this.userRetentionData.set(userId, retentionData);
                }
            }
            this.logger.info(`✅ Loaded retention data for ${this.userRetentionData.size} users`);
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load retention data from cache', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async cleanup() {
        this.logger.info('🧹 UserRetentionAgent cleanup...');
        // Save retention data to cache
        for (const [userId, data] of this.userRetentionData) {
            await enhanced_cache_1.redisCache.set(`retention:user:${userId}`, JSON.stringify(data), 86400 // 24 hours TTL
            );
        }
        await Promise.all([
            this.churnPredictor.cleanup(),
            this.retentionStrategy.cleanup(),
            this.userSegmentation.cleanup(),
            this.engagementAnalyzer.cleanup()
        ]);
        this.userRetentionData.clear();
        this.logger.info('✅ UserRetentionAgent cleanup complete');
    }
    async collectMetrics() {
        return {
            ...this.retentionMetrics,
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
        };
    }
    async checkHealth() {
        const checks = [];
        // Check subsystem health
        checks.push({
            component: 'churn_predictor',
            status: await this.churnPredictor.isHealthy() ? 'healthy' : 'unhealthy'
        });
        checks.push({
            component: 'retention_strategy',
            status: await this.retentionStrategy.isHealthy() ? 'healthy' : 'unhealthy'
        });
        checks.push({
            component: 'user_segmentation',
            status: await this.userSegmentation.isHealthy() ? 'healthy' : 'unhealthy'
        });
        checks.push({
            component: 'engagement_analyzer',
            status: await this.engagementAnalyzer.isHealthy() ? 'healthy' : 'unhealthy'
        });
        const healthyComponents = checks.filter(c => c.status === 'healthy').length;
        const overallStatus = healthyComponents === checks.length ? 'healthy' :
            healthyComponents >= checks.length / 2 ? 'degraded' : 'unhealthy';
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            details: {
                checks,
                metrics: this.retentionMetrics,
                userDataSize: this.userRetentionData.size
            }
        };
    }
}
exports.UserRetentionAgent = UserRetentionAgent;
