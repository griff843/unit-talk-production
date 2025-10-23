"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSegmentation = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
class UserSegmentation {
    constructor(logger) {
        this.segments = new Map();
        this.userSegmentMapping = new Map();
        this.segmentPerformance = new Map();
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('🎯 Initializing UserSegmentation');
        await this.createDefaultSegments();
        await this.loadSegmentHistory();
        await this.loadPerformanceData();
        this.logger.info('✅ UserSegmentation initialized');
    }
    async segmentUsers(userProfiles) {
        this.logger.info(`📊 Segmenting ${userProfiles.length} users`);
        // Clear existing user assignments
        for (const segment of this.segments.values()) {
            segment.userIds = [];
        }
        // Assign users to segments
        for (const userProfile of userProfiles) {
            const segmentId = await this.assignUserToSegment(userProfile);
            if (segmentId) {
                const segment = this.segments.get(segmentId);
                if (segment) {
                    segment.userIds.push(userProfile.userId);
                    this.userSegmentMapping.set(userProfile.userId, segmentId);
                }
            }
        }
        // Update segment characteristics
        await this.updateSegmentCharacteristics(userProfiles);
        // Create dynamic segments if needed
        await this.createDynamicSegments(userProfiles);
        const populatedSegments = Array.from(this.segments.values())
            .filter(segment => segment.userIds.length > 0)
            .sort((a, b) => b.priority - a.priority);
        this.logger.info(`✅ Segmented users into ${populatedSegments.length} segments`, {
            segmentSizes: populatedSegments.map(s => ({ name: s.name, size: s.userIds.length }))
        });
        // Cache segmentation results
        await this.cacheSegmentationResults(populatedSegments);
        return populatedSegments;
    }
    async getUserSegment(userId) {
        const segmentId = this.userSegmentMapping.get(userId);
        return segmentId ? this.segments.get(segmentId) || null : null;
    }
    async getSegmentAnalytics() {
        const segments = Array.from(this.segments.values());
        const analytics = {
            totalSegments: segments.length,
            totalUsers: Array.from(this.userSegmentMapping.keys()).length,
            segmentDistribution: segments.map(segment => ({
                name: segment.name,
                userCount: segment.userIds.length,
                averageChurnRisk: segment.characteristics.averageChurnRisk,
                retentionRate: segment.characteristics.retentionRate,
                priority: segment.priority
            })),
            highRiskSegments: segments.filter(s => s.characteristics.averageChurnRisk > 0.7).length,
            highValueSegments: segments.filter(s => s.characteristics.averageLifetimeValue > 500).length,
            mostEffectiveStrategies: await this.identifyMostEffectiveStrategies(),
            segmentTrends: await this.analyzeSegmentTrends()
        };
        // Cache analytics
        await enhanced_cache_1.redisCache.set('retention:segmentation:analytics', JSON.stringify(analytics), 1800 // 30 minutes TTL
        );
        return analytics;
    }
    async optimizeSegmentation(userProfiles) {
        this.logger.info('🔄 Optimizing user segmentation');
        // Analyze segment performance
        const segmentPerformance = await this.analyzeSegmentPerformance();
        // Identify underperforming segments
        const underperformingSegments = segmentPerformance.filter(sp => sp.retentionRate < 0.5 || sp.interventionSuccess < 0.3);
        // Refine segment criteria
        for (const underperforming of underperformingSegments) {
            await this.refineSegmentCriteria(underperforming.segmentId, userProfiles);
        }
        // Create new segments for unassigned high-value users
        await this.createTargetedSegments(userProfiles);
        this.logger.info('✅ Segmentation optimization completed');
    }
    // Private Methods
    async createDefaultSegments() {
        const defaultSegments = [
            {
                id: 'critical_risk_high_value',
                name: 'Critical Risk - High Value',
                description: 'High-value users with critical churn risk requiring immediate intervention',
                criteria: {
                    churnRisk: { min: 0.8, max: 1.0 },
                    lifetimeValue: { min: 500, max: Infinity },
                    engagementScore: { min: 0, max: 0.4 },
                    daysSinceLastInteraction: { max: 3 },
                    riskFactors: ['payment_issues', 'support_escalation', 'negative_feedback'],
                    behaviorPatterns: ['declining_usage', 'support_heavy'],
                    subscriptionTier: ['premium', 'enterprise']
                },
                characteristics: {
                    averageChurnRisk: 0.9,
                    averageLifetimeValue: 750,
                    averageEngagementScore: 0.2,
                    commonRiskFactors: ['payment_issues', 'dissatisfaction'],
                    retentionRate: 0.3,
                    conversionPotential: 0.8,
                    interventionSuccess: 0.6
                },
                retentionStrategy: 'immediate_personal_outreach',
                priority: 1
            },
            {
                id: 'high_risk_medium_value',
                name: 'High Risk - Medium Value',
                description: 'Medium-value users with high churn risk needing targeted retention',
                criteria: {
                    churnRisk: { min: 0.7, max: 0.8 },
                    lifetimeValue: { min: 100, max: 500 },
                    engagementScore: { min: 0, max: 0.5 },
                    daysSinceLastInteraction: { max: 7 },
                    riskFactors: ['low_engagement', 'feature_confusion', 'cost_concerns'],
                    behaviorPatterns: ['irregular_usage', 'limited_features'],
                    subscriptionTier: ['standard', 'basic']
                },
                characteristics: {
                    averageChurnRisk: 0.75,
                    averageLifetimeValue: 300,
                    averageEngagementScore: 0.3,
                    commonRiskFactors: ['low_engagement', 'cost_concerns'],
                    retentionRate: 0.4,
                    conversionPotential: 0.6,
                    interventionSuccess: 0.5
                },
                retentionStrategy: 'discount_and_education',
                priority: 2
            },
            {
                id: 'medium_risk_engaged',
                name: 'Medium Risk - Engaged',
                description: 'Engaged users with medium churn risk, good conversion potential',
                criteria: {
                    churnRisk: { min: 0.4, max: 0.7 },
                    lifetimeValue: { min: 50, max: Infinity },
                    engagementScore: { min: 0.5, max: 1.0 },
                    daysSinceLastInteraction: { max: 14 },
                    riskFactors: ['feature_limitations', 'competitor_interest'],
                    behaviorPatterns: ['regular_usage', 'feature_exploration'],
                    subscriptionTier: ['standard', 'premium']
                },
                characteristics: {
                    averageChurnRisk: 0.55,
                    averageLifetimeValue: 200,
                    averageEngagementScore: 0.7,
                    commonRiskFactors: ['feature_limitations'],
                    retentionRate: 0.7,
                    conversionPotential: 0.8,
                    interventionSuccess: 0.7
                },
                retentionStrategy: 'feature_highlight_upgrade',
                priority: 3
            },
            {
                id: 'low_risk_loyal',
                name: 'Low Risk - Loyal',
                description: 'Loyal users with low churn risk, potential advocates',
                criteria: {
                    churnRisk: { min: 0, max: 0.4 },
                    lifetimeValue: { min: 200, max: Infinity },
                    engagementScore: { min: 0.7, max: 1.0 },
                    daysSinceLastInteraction: { max: 7 },
                    riskFactors: [],
                    behaviorPatterns: ['consistent_usage', 'high_engagement', 'referral_generation'],
                    subscriptionTier: ['premium', 'enterprise']
                },
                characteristics: {
                    averageChurnRisk: 0.2,
                    averageLifetimeValue: 600,
                    averageEngagementScore: 0.85,
                    commonRiskFactors: [],
                    retentionRate: 0.95,
                    conversionPotential: 0.9,
                    interventionSuccess: 0.9
                },
                retentionStrategy: 'loyalty_program_referral',
                priority: 5
            },
            {
                id: 'dormant_reactivation',
                name: 'Dormant - Reactivation Target',
                description: 'Inactive users who could be reactivated with right approach',
                criteria: {
                    churnRisk: { min: 0.6, max: 0.9 },
                    lifetimeValue: { min: 0, max: Infinity },
                    engagementScore: { min: 0, max: 0.3 },
                    daysSinceLastInteraction: { max: 30 },
                    riskFactors: ['long_inactivity', 'zero_engagement'],
                    behaviorPatterns: ['dormant', 'previously_active'],
                    subscriptionTier: ['free', 'basic', 'cancelled']
                },
                characteristics: {
                    averageChurnRisk: 0.8,
                    averageLifetimeValue: 50,
                    averageEngagementScore: 0.1,
                    commonRiskFactors: ['long_inactivity'],
                    retentionRate: 0.2,
                    conversionPotential: 0.3,
                    interventionSuccess: 0.25
                },
                retentionStrategy: 'win_back_campaign',
                priority: 4
            },
            {
                id: 'new_users_onboarding',
                name: 'New Users - Onboarding',
                description: 'Recently joined users in critical onboarding period',
                criteria: {
                    churnRisk: { min: 0.3, max: 0.8 },
                    lifetimeValue: { min: 0, max: 100 },
                    engagementScore: { min: 0, max: 1.0 },
                    daysSinceLastInteraction: { max: 7 },
                    riskFactors: ['learning_curve', 'onboarding_confusion'],
                    behaviorPatterns: ['new_user', 'exploring'],
                    subscriptionTier: ['free', 'trial']
                },
                characteristics: {
                    averageChurnRisk: 0.6,
                    averageLifetimeValue: 25,
                    averageEngagementScore: 0.5,
                    commonRiskFactors: ['learning_curve'],
                    retentionRate: 0.5,
                    conversionPotential: 0.7,
                    interventionSuccess: 0.6
                },
                retentionStrategy: 'guided_onboarding_support',
                priority: 3
            }
        ];
        for (const segmentData of defaultSegments) {
            const segment = {
                ...segmentData,
                userIds: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.segments.set(segment.id, segment);
        }
        this.logger.info(`✅ Created ${defaultSegments.length} default segments`);
    }
    async loadSegmentHistory() {
        try {
            const cachedSegments = await enhanced_cache_1.redisCache.getPattern('retention:segment:*');
            for (const [key, data] of cachedSegments) {
                const segment = JSON.parse(data);
                segment.createdAt = new Date(segment.createdAt);
                segment.updatedAt = new Date(segment.updatedAt);
                this.segments.set(segment.id, segment);
            }
            this.logger.info(`📋 Loaded ${cachedSegments.size} segments from cache`);
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load segment history from cache');
        }
    }
    async loadPerformanceData() {
        // Load segment performance metrics
        const performanceData = {
            'critical_risk_high_value': { retention_rate: 0.3, intervention_success: 0.6, avg_ltv: 750 },
            'high_risk_medium_value': { retention_rate: 0.4, intervention_success: 0.5, avg_ltv: 300 },
            'medium_risk_engaged': { retention_rate: 0.7, intervention_success: 0.7, avg_ltv: 200 },
            'low_risk_loyal': { retention_rate: 0.95, intervention_success: 0.9, avg_ltv: 600 },
            'dormant_reactivation': { retention_rate: 0.2, intervention_success: 0.25, avg_ltv: 50 },
            'new_users_onboarding': { retention_rate: 0.5, intervention_success: 0.6, avg_ltv: 25 }
        };
        for (const [segmentId, metrics] of Object.entries(performanceData)) {
            this.segmentPerformance.set(segmentId, metrics);
        }
    }
    async assignUserToSegment(userProfile) {
        // Score each segment for this user
        const segmentScores = [];
        for (const [segmentId, segment] of this.segments) {
            const score = this.calculateSegmentFit(userProfile, segment.criteria);
            segmentScores.push({ segmentId, score });
        }
        // Sort by score and return best fit
        segmentScores.sort((a, b) => b.score - a.score);
        // Only assign if score is above threshold
        return segmentScores[0]?.score > 0.6 ? segmentScores[0].segmentId : null;
    }
    calculateSegmentFit(userProfile, criteria) {
        let professional_score = 0;
        let totalCriteria = 0;
        // Churn risk fit
        if (userProfile.churnRisk >= criteria.churnRisk.min &&
            userProfile.churnRisk <= criteria.churnRisk.max) {
            professional_score += 1;
        }
        totalCriteria++;
        // Lifetime value fit
        if (userProfile.lifetimeValue >= criteria.lifetimeValue.min &&
            userProfile.lifetimeValue <= criteria.lifetimeValue.max) {
            professional_score += 1;
        }
        totalCriteria++;
        // Engagement professional_score fit
        if (userProfile.engagementScore >= criteria.engagementScore.min &&
            userProfile.engagementScore <= criteria.engagementScore.max) {
            professional_score += 1;
        }
        totalCriteria++;
        // Days since last interaction
        if (userProfile.daysSinceLastInteraction <= criteria.daysSinceLastInteraction.max) {
            professional_score += 1;
        }
        totalCriteria++;
        // Risk factors overlap
        const riskFactorMatch = criteria.riskFactors.some(factor => userProfile.riskFactors.includes(factor));
        if (riskFactorMatch || criteria.riskFactors.length === 0) {
            professional_score += 1;
        }
        totalCriteria++;
        return totalCriteria > 0 ? professional_score / totalCriteria : 0;
    }
    async updateSegmentCharacteristics(userProfiles) {
        for (const [segmentId, segment] of this.segments) {
            if (segment.userIds.length === 0)
                continue;
            const segmentUsers = userProfiles.filter(up => segment.userIds.includes(up.userId));
            if (segmentUsers.length > 0) {
                segment.characteristics = {
                    averageChurnRisk: this.calculateAverage(segmentUsers, 'churnRisk'),
                    averageLifetimeValue: this.calculateAverage(segmentUsers, 'lifetimeValue'),
                    averageEngagementScore: this.calculateAverage(segmentUsers, 'engagementScore'),
                    commonRiskFactors: this.findCommonRiskFactors(segmentUsers),
                    retentionRate: this.segmentPerformance.get(segmentId)?.retention_rate || 0.5,
                    conversionPotential: this.calculateConversionPotential(segmentUsers),
                    interventionSuccess: this.segmentPerformance.get(segmentId)?.intervention_success || 0.5
                };
                segment.updatedAt = new Date();
            }
        }
    }
    calculateAverage(users, field) {
        if (users.length === 0)
            return 0;
        const sum = users.reduce((acc, user) => acc + user[field], 0);
        return sum / users.length;
    }
    findCommonRiskFactors(users) {
        const factorCounts = {};
        users.forEach(user => {
            user.riskFactors.forEach(factor => {
                factorCounts[factor] = (factorCounts[factor] || 0) + 1;
            });
        });
        // Return factors that appear in at least 30% of users
        const threshold = Math.max(1, Math.floor(users.length * 0.3));
        return Object.entries(factorCounts)
            .filter(([_, count]) => count >= threshold)
            .map(([factor, _]) => factor);
    }
    calculateConversionPotential(users) {
        if (users.length === 0)
            return 0;
        // Higher engagement and lower churn risk = higher conversion potential
        const avgEngagement = this.calculateAverage(users, 'engagementScore');
        const avgChurnRisk = this.calculateAverage(users, 'churnRisk');
        return Math.max(0, Math.min(1, avgEngagement * (1 - avgChurnRisk)));
    }
    async createDynamicSegments(userProfiles) {
        // Find users not assigned to any segment
        const assignedUsers = new Set(this.userSegmentMapping.keys());
        const unassignedUsers = userProfiles.filter(up => !assignedUsers.has(up.userId));
        if (unassignedUsers.length < 5)
            return; // Need minimum users for a segment
        // Cluster unassigned users
        const clusters = await this.clusterUsers(unassignedUsers);
        for (const cluster of clusters) {
            if (cluster.users.length >= 5) {
                const dynamicSegment = await this.createDynamicSegment(cluster);
                this.segments.set(dynamicSegment.id, dynamicSegment);
                // Assign users to the new segment
                cluster.users.forEach(user => {
                    dynamicSegment.userIds.push(user.userId);
                    this.userSegmentMapping.set(user.userId, dynamicSegment.id);
                });
            }
        }
    }
    async clusterUsers(users) {
        // Simple k-means clustering implementation
        const k = Math.min(3, Math.max(1, Math.floor(users.length / 10))); // Dynamic cluster count
        const clusters = [];
        // Initialize centroids randomly
        for (let i = 0; i < k; i++) {
            const randomUser = users[Math.floor(Math.random() * users.length)];
            clusters.push({
                users: [],
                centroid: {
                    churnRisk: randomUser.churnRisk,
                    lifetimeValue: randomUser.lifetimeValue,
                    engagementScore: randomUser.engagementScore
                }
            });
        }
        // Assign users to clusters
        users.forEach(user => {
            let minDistance = Infinity;
            let bestCluster = 0;
            clusters.forEach((cluster, index) => {
                const distance = this.calculateDistance(user, cluster.centroid);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestCluster = index;
                }
            });
            clusters[bestCluster].users.push(user);
        });
        return clusters.filter(cluster => cluster.users.length > 0);
    }
    calculateDistance(user, centroid) {
        const churnDiff = Math.abs(user.churnRisk - centroid.churnRisk);
        const ltvDiff = Math.abs(user.lifetimeValue - centroid.lifetimeValue) / 1000; // Normalize
        const engagementDiff = Math.abs(user.engagementScore - centroid.engagementScore);
        return Math.sqrt(churnDiff ** 2 + ltvDiff ** 2 + engagementDiff ** 2);
    }
    async createDynamicSegment(cluster) {
        const segmentId = `dynamic_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const avgChurnRisk = this.calculateAverage(cluster.users, 'churnRisk');
        const avgLTV = this.calculateAverage(cluster.users, 'lifetimeValue');
        const avgEngagement = this.calculateAverage(cluster.users, 'engagementScore');
        const segment = {
            id: segmentId,
            name: `Dynamic Segment - ${this.generateSegmentName(avgChurnRisk, avgLTV, avgEngagement)}`,
            description: `Automatically generated segment based on user clustering`,
            criteria: {
                churnRisk: { min: avgChurnRisk - 0.1, max: avgChurnRisk + 0.1 },
                lifetimeValue: { min: Math.max(0, avgLTV - 100), max: avgLTV + 100 },
                engagementScore: { min: Math.max(0, avgEngagement - 0.2), max: Math.min(1, avgEngagement + 0.2) },
                daysSinceLastInteraction: { max: 30 },
                riskFactors: this.findCommonRiskFactors(cluster.users),
                behaviorPatterns: ['dynamic_cluster']
            },
            userIds: [],
            characteristics: {
                averageChurnRisk: avgChurnRisk,
                averageLifetimeValue: avgLTV,
                averageEngagementScore: avgEngagement,
                commonRiskFactors: this.findCommonRiskFactors(cluster.users),
                retentionRate: 0.5, // Default for new segments
                conversionPotential: this.calculateConversionPotential(cluster.users),
                interventionSuccess: 0.5
            },
            retentionStrategy: this.determineRetentionStrategy(avgChurnRisk, avgLTV),
            priority: this.calculateSegmentPriority(avgChurnRisk, avgLTV),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.logger.info(`🆕 Created dynamic segment: ${segment.name}`, {
            segmentId,
            userCount: cluster.users.length,
            avgChurnRisk,
            avgLTV
        });
        return segment;
    }
    generateSegmentName(churnRisk, ltv, engagement) {
        const riskLevel = churnRisk > 0.7 ? 'High Risk' : churnRisk > 0.4 ? 'Medium Risk' : 'Low Risk';
        const valueLevel = ltv > 500 ? 'High Value' : ltv > 100 ? 'Medium Value' : 'Low Value';
        const engagementLevel = engagement > 0.7 ? 'Engaged' : engagement > 0.4 ? 'Moderate' : 'Disengaged';
        return `${riskLevel} ${valueLevel} ${engagementLevel}`;
    }
    determineRetentionStrategy(churnRisk, ltv) {
        if (churnRisk > 0.8 && ltv > 500)
            return 'immediate_personal_outreach';
        if (churnRisk > 0.7)
            return 'discount_and_education';
        if (churnRisk > 0.4 && ltv > 200)
            return 'feature_highlight_upgrade';
        if (churnRisk < 0.4 && ltv > 300)
            return 'loyalty_program_referral';
        return 'guided_onboarding_support';
    }
    calculateSegmentPriority(churnRisk, ltv) {
        // Higher churn risk and higher LTV = higher priority
        const riskWeight = churnRisk * 0.6;
        const valueWeight = Math.min(ltv / 1000, 1) * 0.4;
        return Math.ceil((riskWeight + valueWeight) * 5);
    }
    async cacheSegmentationResults(segments) {
        for (const segment of segments) {
            await enhanced_cache_1.redisCache.set(`retention:segment:${segment.id}`, JSON.stringify(segment), 3600 // 1 hour TTL
            );
        }
        // Cache user-to-segment mapping
        const mappingData = Array.from(this.userSegmentMapping.entries());
        await enhanced_cache_1.redisCache.set('retention:user_segment_mapping', JSON.stringify(mappingData), 3600);
    }
    async analyzeSegmentPerformance() {
        return Array.from(this.segments.values()).map(segment => ({
            segmentId: segment.id,
            name: segment.name,
            userCount: segment.userIds.length,
            retentionRate: segment.characteristics.retentionRate,
            interventionSuccess: segment.characteristics.interventionSuccess,
            conversionPotential: segment.characteristics.conversionPotential
        }));
    }
    async refineSegmentCriteria(segmentId, userProfiles) {
        const segment = this.segments.get(segmentId);
        if (!segment)
            return;
        // Analyze successful vs unsuccessful users in this segment
        // This would use historical data to refine criteria
        // For now, we'll make minor adjustments
        segment.criteria.churnRisk.min = Math.max(0, segment.criteria.churnRisk.min - 0.05);
        segment.criteria.churnRisk.max = Math.min(1, segment.criteria.churnRisk.max + 0.05);
        segment.updatedAt = new Date();
        this.logger.info(`🔧 Refined criteria for segment: ${segment.name}`);
    }
    async createTargetedSegments(userProfiles) {
        // Identify high-value unassigned users
        const highValueUnassigned = userProfiles.filter(up => up.lifetimeValue > 300 &&
            !this.userSegmentMapping.has(up.userId));
        if (highValueUnassigned.length >= 3) {
            const targetedSegment = await this.createDynamicSegment({
                users: highValueUnassigned,
                centroid: {
                    churnRisk: this.calculateAverage(highValueUnassigned, 'churnRisk'),
                    lifetimeValue: this.calculateAverage(highValueUnassigned, 'lifetimeValue'),
                    engagementScore: this.calculateAverage(highValueUnassigned, 'engagementScore')
                }
            });
            this.segments.set(targetedSegment.id, targetedSegment);
            highValueUnassigned.forEach(user => {
                targetedSegment.userIds.push(user.userId);
                this.userSegmentMapping.set(user.userId, targetedSegment.id);
            });
        }
    }
    async identifyMostEffectiveStrategies() {
        const strategyEffectiveness = new Map();
        for (const segment of this.segments.values()) {
            const effectiveness = segment.characteristics.interventionSuccess;
            const currentScore = strategyEffectiveness.get(segment.retentionStrategy) || 0;
            strategyEffectiveness.set(segment.retentionStrategy, currentScore + effectiveness);
        }
        return Array.from(strategyEffectiveness.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([strategy]) => strategy);
    }
    async analyzeSegmentTrends() {
        return {
            growingSegments: Array.from(this.segments.values())
                .filter(s => s.userIds.length > 10)
                .map(s => s.name),
            decliningSegments: [],
            emergingPatterns: ['high_value_disengaged', 'new_user_quick_activation']
        };
    }
    async isHealthy() {
        return this.segments.size > 0;
    }
    async cleanup() {
        this.segments.clear();
        this.userSegmentMapping.clear();
        this.segmentPerformance.clear();
        this.logger.info('🧹 UserSegmentation cleanup completed');
    }
}
exports.UserSegmentation = UserSegmentation;
