"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChurnPredictor = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
class ChurnPredictor {
    constructor(logger) {
        this.models = new Map();
        this.featureCache = new Map();
        this.predictionCache = new Map();
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('🔮 Initializing ChurnPredictor');
        await this.loadChurnModels();
        await this.loadFeatureCache();
        this.logger.info('✅ ChurnPredictor initialized');
    }
    async predictChurn(userId, userData) {
        try {
            // Extract features
            const features = await this.extractUserFeatures(userId, userData);
            // Get prediction from ensemble of models
            const ensemblePrediction = await this.getEnsemblePrediction(features);
            // Identify risk factors
            const riskFactors = await this.identifyRiskFactors(features);
            // Calculate time to churn
            const timeToChurn = await this.estimateTimeToChurn(features, ensemblePrediction.riskScore);
            const prediction = {
                userId,
                riskScore: ensemblePrediction.riskScore,
                probability: ensemblePrediction.probability,
                timeToChurn,
                riskFactors,
                confidence: ensemblePrediction.confidence,
                modelVersion: 'ensemble_v2.1',
                timestamp: new Date()
            };
            // Cache prediction
            this.predictionCache.set(userId, prediction);
            await enhanced_cache_1.redisCache.set(`churn:prediction:${userId}`, JSON.stringify(prediction), 3600 // 1 hour TTL
            );
            this.logger.debug('🎯 Churn prediction generated', {
                userId,
                riskScore: prediction.riskScore,
                probability: prediction.probability,
                timeToChurn: prediction.timeToChurn
            });
            return prediction;
        }
        catch (error) {
            this.logger.error('❌ Failed to predict churn', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Return conservative prediction on error
            return this.getConservativePrediction(userId);
        }
    }
    async calculateRiskScore(userId, currentData) {
        try {
            const features = await this.extractUserFeatures(userId, currentData);
            const prediction = await this.getEnsemblePrediction(features);
            return prediction.riskScore;
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to calculate risk professional_score, returning default', { userId });
            return 0.5; // Default neutral risk
        }
    }
    async batchPredict(userIds) {
        const predictions = new Map();
        const batchSize = 10;
        for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = userIds.slice(i, i + batchSize);
            const batchPromises = batch.map(async (userId) => {
                try {
                    const prediction = await this.predictChurn(userId, {});
                    return { userId, prediction };
                }
                catch (error) {
                    this.logger.warn('⚠️ Failed to predict churn in batch', { userId });
                    return { userId, prediction: this.getConservativePrediction(userId) };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            for (const { userId, prediction } of batchResults) {
                predictions.set(userId, prediction);
            }
        }
        return predictions;
    }
    // Feature Extraction
    async extractUserFeatures(userId, userData) {
        // Check cache first
        const cached = this.featureCache.get(userId);
        if (cached) {
            return cached;
        }
        const features = {
            // Engagement features
            daysActive: await this.calculateDaysActive(userId),
            daysSinceLastLogin: await this.calculateDaysSinceLastLogin(userId),
            sessionFrequency: await this.calculateSessionFrequency(userId),
            avgSessionDuration: await this.calculateAvgSessionDuration(userId),
            featureUsage: await this.getFeatureUsage(userId),
            // Behavioral features
            supportTickets: await this.countSupportTickets(userId),
            negativeFeedback: await this.countNegativeFeedback(userId),
            paymentIssues: await this.countPaymentIssues(userId),
            downgrades: await this.countDowngrades(userId),
            // Usage patterns
            weekdayActivity: await this.calculateWeekdayActivity(userId),
            weekendActivity: await this.calculateWeekendActivity(userId),
            timeOfDayPattern: await this.getTimeOfDayPattern(userId),
            consistencyScore: await this.calculateConsistencyScore(userId),
            // Value indicators
            subscription_tier: userData.tier || 'free',
            monthlyValue: await this.getMonthlyValue(userId),
            lifetimeValue: await this.getLifetimeValue(userId),
            paymentHistory: await this.getPaymentHistory(userId),
            // Social indicators
            referrals: await this.countReferrals(userId),
            communityParticipation: await this.getCommunityParticipation(userId),
            helpfulness: await this.getHelpfulnessScore(userId)
        };
        // Cache features
        this.featureCache.set(userId, features);
        return features;
    }
    // Model Predictions
    async getEnsemblePrediction(features) {
        const predictions = [];
        // Logistic Regression Model
        const logisticPrediction = await this.getLogisticPrediction(features);
        predictions.push({ score: logisticPrediction, weight: 0.3 });
        // Random Forest Model
        const forestPrediction = await this.getRandomForestPrediction(features);
        predictions.push({ score: forestPrediction, weight: 0.25 });
        // Neural Network Model
        const neuralPrediction = await this.getNeuralNetworkPrediction(features);
        predictions.push({ score: neuralPrediction, weight: 0.25 });
        // Gradient Boosting Model
        const gradientPrediction = await this.getGradientBoostingPrediction(features);
        predictions.push({ score: gradientPrediction, weight: 0.2 });
        // Calculate weighted ensemble score
        const totalWeight = predictions.reduce((sum, p) => sum + p.weight, 0);
        const weightedScore = predictions.reduce((sum, p) => sum + (p.score * p.weight), 0) / totalWeight;
        // Calculate confidence based on prediction agreement
        const variance = predictions.reduce((sum, p) => sum + Math.pow(p.score - weightedScore, 2), 0) / predictions.length;
        const confidence = Math.max(0.1, 1 - Math.sqrt(variance));
        return {
            riskScore: Math.max(0, Math.min(1, weightedScore)),
            probability: this.convertRiskToProbability(weightedScore),
            confidence
        };
    }
    async getLogisticPrediction(features) {
        // Simplified logistic regression implementation
        const weights = {
            daysSinceLastLogin: 0.15,
            sessionFrequency: -0.12,
            supportTickets: 0.08,
            negativeFeedback: 0.10,
            paymentIssues: 0.20,
            consistencyScore: -0.09,
            lifetimeValue: -0.11,
            communityParticipation: -0.07
        };
        let logit = -1.2; // intercept
        logit += weights.daysSinceLastLogin * Math.min(features.daysSinceLastLogin / 30, 1);
        logit += weights.sessionFrequency * Math.max(0, 1 - features.sessionFrequency / 10);
        logit += weights.supportTickets * Math.min(features.supportTickets / 5, 1);
        logit += weights.negativeFeedback * Math.min(features.negativeFeedback / 3, 1);
        logit += weights.paymentIssues * Math.min(features.paymentIssues / 2, 1);
        logit += weights.consistencyScore * features.consistencyScore;
        logit += weights.lifetimeValue * Math.min(features.lifetimeValue / 1000, 1);
        logit += weights.communityParticipation * Math.min(features.communityParticipation / 10, 1);
        return 1 / (1 + Math.exp(-logit));
    }
    async getRandomForestPrediction(features) {
        // Simplified decision tree ensemble
        const trees = [
            this.evaluateTree1(features),
            this.evaluateTree2(features),
            this.evaluateTree3(features),
            this.evaluateTree4(features),
            this.evaluateTree5(features)
        ];
        return trees.reduce((sum, professional_score) => sum + professional_score, 0) / trees.length;
    }
    async getNeuralNetworkPrediction(features) {
        // Simplified neural network (3 layers)
        const inputs = this.normalizeFeatures(features);
        // Hidden layer 1 (5 neurons)
        const h1 = this.relu([
            0.2 * inputs[0] - 0.1 * inputs[1] + 0.3 * inputs[2] - 0.4,
            -0.3 * inputs[0] + 0.4 * inputs[1] + 0.1 * inputs[2] + 0.2,
            0.1 * inputs[0] + 0.2 * inputs[1] - 0.3 * inputs[2] + 0.1,
            -0.2 * inputs[0] - 0.1 * inputs[1] + 0.4 * inputs[2] - 0.2,
            0.3 * inputs[0] + 0.3 * inputs[1] + 0.2 * inputs[2] + 0.1
        ]);
        // Hidden layer 2 (3 neurons)
        const h2 = this.relu([
            0.4 * h1[0] - 0.2 * h1[1] + 0.1 * h1[2] + 0.3 * h1[3] - 0.1 * h1[4] + 0.2,
            -0.1 * h1[0] + 0.3 * h1[1] - 0.2 * h1[2] + 0.4 * h1[3] + 0.2 * h1[4] - 0.3,
            0.2 * h1[0] + 0.1 * h1[1] + 0.3 * h1[2] - 0.4 * h1[3] + 0.1 * h1[4] + 0.1
        ]);
        // Output layer (1 neuron with sigmoid)
        const output = 0.5 * h2[0] + 0.3 * h2[1] - 0.2 * h2[2] + 0.1;
        return 1 / (1 + Math.exp(-output));
    }
    async getGradientBoostingPrediction(features) {
        // Simplified gradient boosting (3 weak learners)
        let prediction = 0.5; // base prediction
        // Weak learner 1: focus on engagement
        if (features.daysSinceLastLogin > 7)
            prediction += 0.15;
        if (features.sessionFrequency < 2)
            prediction += 0.10;
        if (features.avgSessionDuration < 300)
            prediction += 0.08; // 5 minutes
        // Weak learner 2: focus on support issues
        if (features.supportTickets > 2)
            prediction += 0.12;
        if (features.negativeFeedback > 0)
            prediction += 0.10;
        if (features.paymentIssues > 0)
            prediction += 0.15;
        // Weak learner 3: focus on value and loyalty
        if (features.lifetimeValue < 100)
            prediction += 0.08;
        if (features.referrals === 0)
            prediction += 0.05;
        if (features.communityParticipation < 2)
            prediction += 0.06;
        return Math.max(0, Math.min(1, prediction));
    }
    // Risk Factor Identification
    async identifyRiskFactors(features) {
        const riskFactors = [];
        // Engagement risk factors
        if (features.daysSinceLastLogin > 7) {
            riskFactors.push('Inactive for over a week');
        }
        if (features.sessionFrequency < 2) {
            riskFactors.push('Low session frequency');
        }
        if (features.avgSessionDuration < 300) {
            riskFactors.push('Short session duration');
        }
        // Support and satisfaction risk factors
        if (features.supportTickets > 2) {
            riskFactors.push('Multiple support tickets');
        }
        if (features.negativeFeedback > 0) {
            riskFactors.push('Negative feedback submitted');
        }
        if (features.paymentIssues > 0) {
            riskFactors.push('Payment issues encountered');
        }
        // Usage pattern risk factors
        if (features.consistencyScore < 0.3) {
            riskFactors.push('Inconsistent usage pattern');
        }
        if (features.weekdayActivity === 0 && features.weekendActivity === 0) {
            riskFactors.push('No recent activity');
        }
        // Value and engagement risk factors
        if (features.lifetimeValue < 50) {
            riskFactors.push('Low lifetime value');
        }
        if (features.communityParticipation === 0) {
            riskFactors.push('No community engagement');
        }
        if (features.referrals === 0 && features.daysActive > 30) {
            riskFactors.push('No referrals after 30 days');
        }
        // Tier-specific risk factors
        if (features.subscription_tier === 'free' && features.daysActive > 14) {
            riskFactors.push('Long-term free user');
        }
        if (features.downgrades > 0) {
            riskFactors.push('Recent subscription downgrade');
        }
        return riskFactors;
    }
    async estimateTimeToChurn(features, riskScore) {
        // Base time estimates by risk level
        let baseDays = 30; // Default 30 days
        if (riskScore > 0.8)
            baseDays = 7; // Very high risk
        else if (riskScore > 0.6)
            baseDays = 14; // High risk
        else if (riskScore > 0.4)
            baseDays = 21; // Medium risk
        else
            baseDays = 60; // Low risk
        // Adjust based on specific factors
        if (features.paymentIssues > 0)
            baseDays *= 0.5; // Payment issues accelerate churn
        if (features.supportTickets > 2)
            baseDays *= 0.7; // Multiple tickets indicate frustration
        if (features.lifetimeValue > 500)
            baseDays *= 1.5; // High value users take longer to churn
        if (features.communityParticipation > 5)
            baseDays *= 1.3; // Community engagement extends retention
        return Math.max(1, Math.round(baseDays));
    }
    // Helper Methods
    convertRiskToProbability(riskScore) {
        // Convert risk professional_score to 30-day churn probability
        return Math.max(0, Math.min(1, riskScore * 0.8 + 0.1));
    }
    normalizeFeatures(features) {
        return [
            Math.min(features.daysSinceLastLogin / 30, 1),
            Math.min(features.sessionFrequency / 10, 1),
            Math.min(features.supportTickets / 5, 1),
            Math.min(features.lifetimeValue / 1000, 1),
            features.consistencyScore
        ];
    }
    relu(values) {
        return values.map(v => Math.max(0, v));
    }
    evaluateTree1(features) {
        if (features.daysSinceLastLogin > 14)
            return 0.8;
        if (features.sessionFrequency < 1)
            return 0.7;
        if (features.supportTickets > 3)
            return 0.6;
        return 0.2;
    }
    evaluateTree2(features) {
        if (features.paymentIssues > 0)
            return 0.9;
        if (features.negativeFeedback > 1)
            return 0.7;
        if (features.lifetimeValue < 50)
            return 0.5;
        return 0.1;
    }
    evaluateTree3(features) {
        if (features.consistencyScore < 0.2)
            return 0.8;
        if (features.avgSessionDuration < 180)
            return 0.6;
        if (features.communityParticipation === 0)
            return 0.4;
        return 0.2;
    }
    evaluateTree4(features) {
        if (features.downgrades > 0)
            return 0.7;
        if (features.subscription_tier === 'free' && features.daysActive > 21)
            return 0.5;
        if (features.referrals === 0 && features.daysActive > 30)
            return 0.4;
        return 0.1;
    }
    evaluateTree5(features) {
        if (features.weekdayActivity === 0 && features.weekendActivity === 0)
            return 0.9;
        if (features.featureUsage && Object.keys(features.featureUsage).length < 2)
            return 0.6;
        if (features.helpfulness < 1)
            return 0.3;
        return 0.1;
    }
    // Feature calculation methods (simplified - would integrate with actual data sources)
    async calculateDaysActive(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:days_active:${userId}`);
        return cached ? parseInt(cached) : 30; // Default to 30 days
    }
    async calculateDaysSinceLastLogin(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:last_login:${userId}`);
        if (cached) {
            const lastLogin = new Date(cached);
            return Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
        }
        return 1; // Default to 1 day
    }
    async calculateSessionFrequency(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:session_freq:${userId}`);
        return cached ? parseFloat(cached) : 5; // Default to 5 sessions per week
    }
    async calculateAvgSessionDuration(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:avg_session_duration:${userId}`);
        return cached ? parseFloat(cached) : 600; // Default to 10 minutes
    }
    async getFeatureUsage(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:feature_usage:${userId}`);
        return cached ? JSON.parse(cached) : { picks: 5, alerts: 2, stats: 1 };
    }
    async countSupportTickets(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:support_tickets:${userId}`);
        return cached ? parseInt(cached) : 0;
    }
    async countNegativeFeedback(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:negative_feedback:${userId}`);
        return cached ? parseInt(cached) : 0;
    }
    async countPaymentIssues(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:payment_issues:${userId}`);
        return cached ? parseInt(cached) : 0;
    }
    async countDowngrades(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:downgrades:${userId}`);
        return cached ? parseInt(cached) : 0;
    }
    async calculateWeekdayActivity(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:weekday_activity:${userId}`);
        return cached ? parseFloat(cached) : 0.7;
    }
    async calculateWeekendActivity(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:weekend_activity:${userId}`);
        return cached ? parseFloat(cached) : 0.3;
    }
    async getTimeOfDayPattern(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:time_pattern:${userId}`);
        return cached ? JSON.parse(cached) : new Array(24).fill(0.04); // Even distribution
    }
    async calculateConsistencyScore(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:consistency:${userId}`);
        return cached ? parseFloat(cached) : 0.5;
    }
    async getMonthlyValue(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:monthly_value:${userId}`);
        return cached ? parseFloat(cached) : 0;
    }
    async getLifetimeValue(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:lifetime_value:${userId}`);
        return cached ? parseFloat(cached) : 0;
    }
    async getPaymentHistory(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:payment_history:${userId}`);
        return cached || 'good';
    }
    async countReferrals(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:referrals:${userId}`);
        return cached ? parseInt(cached) : 0;
    }
    async getCommunityParticipation(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:community_participation:${userId}`);
        return cached ? parseInt(cached) : 0;
    }
    async getHelpfulnessScore(userId) {
        const cached = await enhanced_cache_1.redisCache.get(`user:helpfulness:${userId}`);
        return cached ? parseFloat(cached) : 0;
    }
    getConservativePrediction(userId) {
        return {
            userId,
            riskScore: 0.5,
            probability: 0.4,
            timeToChurn: 30,
            riskFactors: ['Prediction model unavailable'],
            confidence: 0.1,
            modelVersion: 'fallback_v1.0',
            timestamp: new Date()
        };
    }
    async loadChurnModels() {
        // Load model configurations
        const models = [
            {
                name: 'logistic_regression',
                version: '2.1',
                accuracy: 0.78,
                features: ['daysSinceLastLogin', 'sessionFrequency', 'supportTickets'],
                weights: { daysSinceLastLogin: 0.15, sessionFrequency: -0.12, supportTickets: 0.08 },
                thresholds: { low_risk: 0.3, medium_risk: 0.6, high_risk: 0.8 }
            }
        ];
        for (const model of models) {
            this.models.set(model.name, model);
        }
    }
    async loadFeatureCache() {
        // Load cached feature data
        try {
            const cachedFeatures = await enhanced_cache_1.redisCache.getPattern('churn:features:*');
            for (const [key, data] of cachedFeatures) {
                const userId = key.split(':').pop();
                if (userId) {
                    this.featureCache.set(userId, JSON.parse(data));
                }
            }
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load feature cache');
        }
    }
    async isHealthy() {
        return this.models.size > 0;
    }
    async cleanup() {
        // Save feature cache
        for (const [userId, features] of this.featureCache) {
            await enhanced_cache_1.redisCache.set(`churn:features:${userId}`, JSON.stringify(features), 3600 // 1 hour TTL
            );
        }
        this.models.clear();
        this.featureCache.clear();
        this.predictionCache.clear();
        this.logger.info('🧹 ChurnPredictor cleanup completed');
    }
}
exports.ChurnPredictor = ChurnPredictor;
