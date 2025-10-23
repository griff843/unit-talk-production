"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileManager = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
const enhanced_circuit_breaker_1 = require("../../services/enhanced-circuit-breaker");
class UserProfileManager {
    constructor(supabase, logger) {
        this.profileCache = new Map();
        this.supabase = supabase;
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('👤 Initializing UserProfileManager');
        // Create database tables if they don't exist
        await this.ensureDatabaseSchema();
        // Load active profiles into cache
        await this.loadActiveProfiles();
    }
    async createProfile(userId, initialData) {
        this.logger.info('➕ Creating user profile', { userId });
        const profile = {
            id: `profile_${userId}_${Date.now()}`,
            userId,
            joinDate: initialData.joinDate || new Date(),
            experienceLevel: 'beginner', // Will be updated based on interaction
            engagementScore: 0.5, // Starting neutral
            learningVelocity: 0,
            responsePatterns: [{
                    averageResponseTime: 0,
                    responseConsistency: 0,
                    engagementTrend: 'stable',
                    timeOfDayActivity: {},
                    dayOfWeekActivity: {}
                }],
            commandProficiency: {
                commandsUsed: [],
                successRate: 0,
                errorPatterns: [],
                helpRequestFrequency: 0,
                advancedFeatureUsage: 0
            },
            timezoneBehavior: {
                detectedTimezone: 'UTC',
                activeHours: [],
                peakActivityTime: '12:00',
                weekendPattern: 'same'
            },
            socialInteraction: {
                messageCount: 0,
                reactionsGiven: 0,
                reactionsReceived: 0,
                questionsAsked: 0,
                helpProvided: 0,
                channelsActive: []
            },
            conversionLikelihood: 0.1, // Start low
            churnRisk: 0.5, // Start neutral
            lastActivity: new Date(),
            onboardingStage: {
                currentStage: 'welcome',
                completedSteps: [],
                stuckPoints: [],
                timeInStage: 0,
                progressScore: 0
            },
            preferences: {
                communicationStyle: 'detailed',
                learningPace: 'moderate',
                notificationTiming: 'immediate',
                contentType: 'beginner',
                interactionMode: 'guided'
            },
            interventionHistory: []
        };
        // Store in database
        await this.saveProfile(profile);
        // Cache profile
        this.profileCache.set(userId, profile);
        return profile;
    }
    async updateBehavior(userId, behaviorData) {
        const profile = await this.getProfile(userId);
        if (!profile) {
            this.logger.warn('Profile not found for behavior update', { userId });
            return;
        }
        // Update social interaction metrics
        profile.socialInteraction.messageCount++;
        if (behaviorData.questions.length > 0) {
            profile.socialInteraction.questionsAsked++;
        }
        // Update engagement professional_score based on sentiment and activity
        await this.updateEngagementScore(profile, behaviorData);
        // Update experience level based on complexity
        await this.updateExperienceLevel(profile, behaviorData);
        // Update learning indicators
        await this.updateLearningMetrics(profile, behaviorData);
        // Update conversion likelihood
        await this.updateConversionLikelihood(profile, behaviorData);
        // Update churn risk
        await this.updateChurnRisk(profile, behaviorData);
        profile.lastActivity = new Date();
        // Save updated profile
        await this.saveProfile(profile);
        this.profileCache.set(userId, profile);
        this.logger.debug('📊 Updated user behavior profile', {
            userId,
            engagementScore: profile.engagementScore,
            experienceLevel: profile.experienceLevel,
            conversionLikelihood: profile.conversionLikelihood
        });
    }
    async updateInteraction(userId, interactionData) {
        const profile = await this.getProfile(userId);
        if (!profile)
            return;
        // Track command usage
        profile.commandProficiency.commandsUsed.push('interaction');
        profile.commandProficiency.successRate = this.calculateSuccessRate(profile);
        // Update learning based on interaction type
        if (interactionData.learningIndicators.length > 0) {
            profile.learningVelocity += 0.1;
        }
        await this.saveProfile(profile);
        this.profileCache.set(userId, profile);
    }
    async updateEngagement(userId, reactionData) {
        const profile = await this.getProfile(userId);
        if (!profile)
            return;
        profile.socialInteraction.reactionsGiven++;
        // Positive reactions boost engagement
        if (reactionData.sentiment === 'positive') {
            profile.engagementScore = Math.min(profile.engagementScore + 0.05, 1.0);
        }
        await this.saveProfile(profile);
        this.profileCache.set(userId, profile);
    }
    async updateActivity(userId, _presenceData) {
        const profile = await this.getProfile(userId);
        if (!profile)
            return;
        const now = new Date();
        const hour = now.getHours();
        const day = now.toLocaleDateString('en', { weekday: 'long' });
        // Update activity patterns
        profile.timezoneBehavior.activeHours.push(hour);
        // Update day of week activity
        profile.responsePatterns[0].dayOfWeekActivity[day] =
            (profile.responsePatterns[0].dayOfWeekActivity[day] || 0) + 1;
        // Update time of day activity
        profile.responsePatterns[0].timeOfDayActivity[hour.toString()] =
            (profile.responsePatterns[0].timeOfDayActivity[hour.toString()] || 0) + 1;
        // Detect timezone
        await this.detectTimezone(profile);
        await this.saveProfile(profile);
        this.profileCache.set(userId, profile);
    }
    async updateAnalysis(userId, behaviorAnalysis) {
        const profile = await this.getProfile(userId);
        if (!profile)
            return;
        // Update engagement trend
        profile.responsePatterns[0].engagementTrend = behaviorAnalysis.engagementTrend;
        // Update learning velocity
        profile.learningVelocity = behaviorAnalysis.learningVelocity;
        // Update response patterns
        if (behaviorAnalysis.responsePatterns) {
            profile.responsePatterns[0].averageResponseTime = behaviorAnalysis.responsePatterns.averageResponseTime;
            profile.responsePatterns[0].responseConsistency = behaviorAnalysis.responsePatterns.consistency;
        }
        await this.saveProfile(profile);
        this.profileCache.set(userId, profile);
    }
    async recalculateMetrics(userId) {
        const profile = await this.getProfile(userId);
        if (!profile) {
            throw new Error(`Profile not found for user ${userId}`);
        }
        // Recalculate engagement professional_score
        profile.engagementScore = await this.calculateEngagementScore(profile);
        // Recalculate conversion likelihood
        profile.conversionLikelihood = await this.calculateConversionLikelihood(profile);
        // Recalculate churn risk
        profile.churnRisk = await this.calculateChurnRisk(profile);
        // Update onboarding progress
        profile.onboardingStage.progressScore = await this.calculateProgressScore(profile);
        await this.saveProfile(profile);
        this.profileCache.set(userId, profile);
        return profile;
    }
    async getProfile(userId) {
        // Check cache first
        if (this.profileCache.has(userId)) {
            return this.profileCache.get(userId);
        }
        // Load from database
        return await this.loadProfileFromDB(userId);
    }
    async getAllProfiles() {
        return Array.from(this.profileCache.values());
    }
    async getActiveUsers() {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
        return this.getAllProfiles().then(profiles => profiles.filter(profile => profile.lastActivity > cutoff));
    }
    async getConversionCandidates() {
        const profiles = await this.getAllProfiles();
        return profiles
            .filter(profile => profile.conversionLikelihood > 0.7 &&
            profile.onboardingStage.currentStage !== 'active_user')
            .map(profile => ({ id: profile.userId, profile }));
    }
    async generateInsights() {
        const profiles = await this.getAllProfiles();
        const activeProfiles = await this.getActiveUsers();
        const completedOnboarding = profiles.filter(p => p.onboardingStage.currentStage === 'active_user').length;
        const conversions = profiles.filter(p => p.conversionLikelihood > 0.8).length;
        const avgCompletionTime = this.calculateAverageCompletionTime(profiles);
        const conversionRate = profiles.length > 0 ? conversions / profiles.length : 0;
        const churnRate = this.calculateChurnRate(profiles);
        const avgEngagement = profiles.length > 0 ?
            profiles.reduce((sum, p) => sum + p.engagementScore, 0) / profiles.length : 0;
        const insights = {
            totalUsers: profiles.length,
            activeUsers: activeProfiles.length,
            completedOnboarding,
            averageCompletionTime: avgCompletionTime,
            conversionRate,
            churnRate,
            engagementScore: avgEngagement,
            interventionSuccess: this.calculateInterventionSuccess(profiles),
            commonStuckPoints: this.identifyCommonStuckPoints(profiles),
            bestPerformingFlows: this.identifyBestFlows(profiles)
        };
        // Cache insights
        await enhanced_cache_1.redisCache.set('onboarding:insights:latest', JSON.stringify(insights), 1800 // 30 minutes TTL
        );
        return insights;
    }
    // Private Methods
    async ensureDatabaseSchema() {
        if (!this.supabase) {
            this.logger.warn('⚠️ No Supabase client, skipping schema setup');
            return;
        }
        await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            // Check if onboarding_profiles table exists
            const { error } = await this.supabase
                .from('onboarding_profiles')
                .select('count')
                .limit(1);
            if (error && error.message.includes('relation')) {
                this.logger.info('📋 Creating onboarding_profiles table');
                // Table creation would happen via migration in real implementation
            }
        }, async () => {
            this.logger.warn('⚠️ Cannot verify database schema, Supabase circuit breaker open');
        });
    }
    async loadActiveProfiles() {
        if (!this.supabase)
            return;
        await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            const { data: profiles, error } = await this.supabase
                .from('onboarding_profiles')
                .select('*')
                .gte('last_activity', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
                .limit(100);
            if (!error && profiles) {
                for (const profileData of profiles) {
                    const profile = this.deserializeProfile(profileData);
                    this.profileCache.set(profile.userId, profile);
                }
                this.logger.info(`✅ Loaded ${profiles.length} active profiles into cache`);
            }
        }, async () => {
            this.logger.warn('⚠️ Cannot load profiles, Supabase circuit breaker open');
        });
    }
    async saveProfile(profile) {
        if (!this.supabase)
            return;
        const serializedProfile = this.serializeProfile(profile);
        await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            const { error } = await this.supabase
                .from('onboarding_profiles')
                .upsert(serializedProfile);
            if (error) {
                this.logger.error('❌ Failed to save profile', {
                    userId: profile.userId,
                    error: error.message
                });
            }
        }, async () => {
            this.logger.warn('⚠️ Cannot save profile, Supabase circuit breaker open', {
                userId: profile.userId
            });
            // Cache the profile for later sync
            await enhanced_cache_1.redisCache.set(`profile:pending:${profile.userId}`, JSON.stringify(serializedProfile), 3600 // 1 hour TTL
            );
        });
    }
    async loadProfileFromDB(userId) {
        if (!this.supabase)
            return null;
        return await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            const { data, error } = await this.supabase
                .from('onboarding_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();
            if (error || !data) {
                return null;
            }
            const profile = this.deserializeProfile(data);
            this.profileCache.set(userId, profile);
            return profile;
        }, async () => {
            this.logger.warn('⚠️ Cannot load profile from DB, using cache only', { userId });
            return null;
        });
    }
    async updateEngagementScore(profile, data) {
        let scoreChange = 0;
        // Positive sentiment increases engagement
        if (data.sentiment === 'positive')
            scoreChange += 0.1;
        else if (data.sentiment === 'negative')
            scoreChange -= 0.05;
        else if (data.sentiment === 'frustrated')
            scoreChange -= 0.1;
        // Questions show engagement
        if (data.questions.length > 0)
            scoreChange += 0.05;
        // Learning signals are very positive
        if (data.learningIndicators.length > 0)
            scoreChange += 0.15;
        // Conversion signals show high engagement
        if (data.conversionSignals.length > 0)
            scoreChange += 0.2;
        // Frustration decreases engagement
        if (data.frustrationIndicators.length > 0)
            scoreChange -= 0.1;
        // Apply changes with bounds
        profile.engagementScore = Math.max(0, Math.min(1, profile.engagementScore + scoreChange));
    }
    async updateExperienceLevel(profile, data) {
        if (data.complexity === 'advanced' && profile.experienceLevel === 'beginner') {
            profile.experienceLevel = 'intermediate';
        }
        else if (data.complexity === 'basic' && profile.experienceLevel === 'advanced') {
            // Don't downgrade, might be explaining to someone
            return;
        }
        // Upgrade based on consistent advanced interactions
        if (data.complexity === 'advanced' && profile.experienceLevel === 'intermediate') {
            const recentAdvanced = profile.socialInteraction.messageCount > 10;
            if (recentAdvanced) {
                profile.experienceLevel = 'advanced';
            }
        }
    }
    async updateLearningMetrics(profile, data) {
        if (data.learningIndicators.length > 0) {
            const learningBoost = data.learningIndicators.length * 0.1;
            profile.learningVelocity = Math.min(1, profile.learningVelocity + learningBoost);
        }
        // Decrease if showing confusion
        if (data.frustrationIndicators.some(f => f.type === 'confusion')) {
            profile.learningVelocity = Math.max(0, profile.learningVelocity - 0.05);
        }
    }
    async updateConversionLikelihood(profile, data) {
        let likelihoodChange = 0;
        // Conversion signals directly increase likelihood
        data.conversionSignals.forEach(signal => {
            const strength = signal.strength === 'strong' ? 0.2 : signal.strength === 'moderate' ? 0.1 : 0.05;
            likelihoodChange += strength;
        });
        // High engagement increases likelihood
        if (profile.engagementScore > 0.8)
            likelihoodChange += 0.05;
        // Good learning velocity increases likelihood
        if (profile.learningVelocity > 0.7)
            likelihoodChange += 0.05;
        // Apply changes
        profile.conversionLikelihood = Math.max(0, Math.min(1, profile.conversionLikelihood + likelihoodChange));
    }
    async updateChurnRisk(profile, data) {
        let riskChange = 0;
        // Frustration increases churn risk
        if (data.frustrationIndicators.length > 0)
            riskChange += 0.1;
        // Negative sentiment increases churn risk
        if (data.sentiment === 'negative' || data.sentiment === 'frustrated')
            riskChange += 0.05;
        // Long time without activity increases risk
        const daysSinceLastActivity = (Date.now() - profile.lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastActivity > 3)
            riskChange += 0.1;
        // Positive engagement decreases risk
        if (profile.engagementScore > 0.7)
            riskChange -= 0.05;
        // Apply changes
        profile.churnRisk = Math.max(0, Math.min(1, profile.churnRisk + riskChange));
    }
    calculateSuccessRate(profile) {
        const totalCommands = profile.commandProficiency.commandsUsed.length;
        const errors = profile.commandProficiency.errorPatterns.length;
        return totalCommands > 0 ? (totalCommands - errors) / totalCommands : 1;
    }
    async detectTimezone(profile) {
        const hourCounts = profile.responsePatterns[0].timeOfDayActivity;
        const hours = Object.keys(hourCounts).map(Number);
        if (hours.length < 5)
            return; // Need more data
        // Find peak activity hour
        const peakHour = hours.reduce((peak, hour) => hourCounts[hour.toString()] > hourCounts[peak.toString()] ? hour : peak);
        profile.timezoneBehavior.peakActivityTime = `${peakHour}:00`;
        // Estimate timezone based on peak activity (very basic estimation)
        if (peakHour >= 9 && peakHour <= 17) {
            profile.timezoneBehavior.detectedTimezone = 'UTC-5'; // EST work hours
        }
        else if (peakHour >= 18 && peakHour <= 23) {
            profile.timezoneBehavior.detectedTimezone = 'UTC-8'; // PST evening
        }
    }
    async calculateEngagementScore(profile) {
        const factors = {
            messageFrequency: Math.min(profile.socialInteraction.messageCount / 10, 1),
            questionQuality: Math.min(profile.socialInteraction.questionsAsked / 5, 1),
            learningVelocity: profile.learningVelocity,
            reactionActivity: Math.min(profile.socialInteraction.reactionsGiven / 5, 1),
            responseConsistency: profile.responsePatterns[0].responseConsistency || 0.5
        };
        return (factors.messageFrequency * 0.3 +
            factors.questionQuality * 0.2 +
            factors.learningVelocity * 0.25 +
            factors.reactionActivity * 0.15 +
            factors.responseConsistency * 0.1);
    }
    async calculateConversionLikelihood(profile) {
        const factors = {
            engagement: profile.engagementScore,
            learning: profile.learningVelocity,
            timeSpent: Math.min((Date.now() - profile.joinDate.getTime()) / (7 * 24 * 60 * 60 * 1000), 1), // Weeks since join, capped at 1
            experienceMatch: profile.experienceLevel === 'intermediate' ? 1 : 0.8, // Intermediate users convert best
            progressScore: profile.onboardingStage.progressScore
        };
        return (factors.engagement * 0.4 +
            factors.learning * 0.2 +
            factors.timeSpent * 0.1 +
            factors.experienceMatch * 0.1 +
            factors.progressScore * 0.2);
    }
    async calculateChurnRisk(profile) {
        const daysSinceLastActivity = (Date.now() - profile.lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        const daysSinceJoin = (Date.now() - profile.joinDate.getTime()) / (1000 * 60 * 60 * 24);
        const factors = {
            inactivity: Math.min(daysSinceLastActivity / 7, 1), // Risk increases with days inactive
            lowEngagement: 1 - profile.engagementScore,
            earlyStage: daysSinceJoin < 3 ? 0.3 : 0, // Higher risk in first 3 days
            stuckInOnboarding: profile.onboardingStage.stuckPoints.length * 0.1,
            interventionFailures: profile.interventionHistory.filter(i => i.outcome === 'failed').length * 0.1
        };
        return Math.min(factors.inactivity * 0.4 +
            factors.lowEngagement * 0.3 +
            factors.earlyStage +
            factors.stuckInOnboarding +
            factors.interventionFailures, 1);
    }
    async calculateProgressScore(profile) {
        const stageWeights = {
            welcome: 0.2,
            tutorial: 0.4,
            first_picks: 0.6,
            upgrade_consideration: 0.8,
            active_user: 1.0
        };
        const baseScore = stageWeights[profile.onboardingStage.currentStage] || 0;
        const completionBonus = profile.onboardingStage.completedSteps.length * 0.05;
        const stuckPenalty = profile.onboardingStage.stuckPoints.length * 0.1;
        return Math.max(0, Math.min(1, baseScore + completionBonus - stuckPenalty));
    }
    calculateAverageCompletionTime(profiles) {
        const completed = profiles.filter(p => p.onboardingStage.currentStage === 'active_user');
        if (completed.length === 0)
            return 0;
        const times = completed.map(p => p.onboardingStage.timeInStage);
        return times.reduce((sum, time) => sum + time, 0) / times.length;
    }
    calculateChurnRate(profiles) {
        const churned = profiles.filter(p => p.churnRisk > 0.8).length;
        return profiles.length > 0 ? churned / profiles.length : 0;
    }
    calculateInterventionSuccess(profiles) {
        const allInterventions = profiles.flatMap(p => p.interventionHistory);
        const successful = allInterventions.filter(i => i.outcome === 'successful').length;
        return allInterventions.length > 0 ? successful / allInterventions.length : 0;
    }
    identifyCommonStuckPoints(profiles) {
        const stuckPoints = {};
        profiles.forEach(profile => {
            profile.onboardingStage.stuckPoints.forEach(point => {
                stuckPoints[point] = (stuckPoints[point] || 0) + 1;
            });
        });
        return stuckPoints;
    }
    identifyBestFlows(profiles) {
        // const _successful = profiles.filter(p => // Unused variable removed
        profiles.filter(p => p.onboardingStage.currentStage === 'active_user' &&
            p.conversionLikelihood > 0.8);
        // This would analyze successful user journeys to identify best flows
        return ['guided_tutorial', 'experience_based_onboarding', 'personalized_content'];
    }
    serializeProfile(profile) {
        return {
            id: profile.id,
            user_id: profile.userId,
            join_date: profile.joinDate.toISOString(),
            experience_level: profile.experienceLevel,
            engagement_score: profile.engagementScore,
            learning_velocity: profile.learningVelocity,
            response_patterns: JSON.stringify(profile.responsePatterns),
            command_proficiency: JSON.stringify(profile.commandProficiency),
            timezone_behavior: JSON.stringify(profile.timezoneBehavior),
            social_interaction: JSON.stringify(profile.socialInteraction),
            conversion_likelihood: profile.conversionLikelihood,
            churn_risk: profile.churnRisk,
            last_activity: profile.lastActivity.toISOString(),
            onboarding_stage: JSON.stringify(profile.onboardingStage),
            preferences: JSON.stringify(profile.preferences),
            intervention_history: JSON.stringify(profile.interventionHistory),
            updated_at: new Date().toISOString()
        };
    }
    deserializeProfile(data) {
        return {
            id: data.id,
            userId: data.user_id,
            joinDate: new Date(data.join_date),
            experienceLevel: data.experience_level,
            engagementScore: data.engagement_score,
            learningVelocity: data.learning_velocity,
            responsePatterns: JSON.parse(data.response_patterns || '[]'),
            commandProficiency: JSON.parse(data.command_proficiency || '{}'),
            timezoneBehavior: JSON.parse(data.timezone_behavior || '{}'),
            socialInteraction: JSON.parse(data.social_interaction || '{}'),
            conversionLikelihood: data.conversion_likelihood,
            churnRisk: data.churn_risk,
            lastActivity: new Date(data.last_activity),
            onboardingStage: JSON.parse(data.onboarding_stage || '{}'),
            preferences: JSON.parse(data.preferences || '{}'),
            interventionHistory: JSON.parse(data.intervention_history || '[]')
        };
    }
    async isHealthy() {
        return this.profileCache.size >= 0; // Always healthy if we can access cache
    }
    async cleanup() {
        this.profileCache.clear();
        this.logger.info('🧹 UserProfileManager cleanup completed');
    }
}
exports.UserProfileManager = UserProfileManager;
