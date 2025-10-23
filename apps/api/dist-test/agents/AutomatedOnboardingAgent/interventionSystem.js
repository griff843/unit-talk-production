"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterventionSystem = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
class InterventionSystem {
    constructor(logger) {
        this.pendingInterventions = new Map();
        this.interventionRules = new Map();
        this.userInterventionHistory = new Map();
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('🚨 Initializing InterventionSystem');
        // Load intervention rules
        await this.loadInterventionRules();
        // Load pending interventions from cache
        await this.loadPendingInterventions();
        // Start intervention scheduler
        this.startInterventionScheduler();
    }
    async assessIntervention(userId, behaviorData) {
        // Check each intervention rule
        for (const [ruleId, rule] of this.interventionRules) {
            const shouldTrigger = await this.evaluateRule(rule, userId, behaviorData);
            if (shouldTrigger) {
                this.logger.info('🎯 Intervention rule triggered', {
                    userId,
                    ruleId,
                    interventionType: rule.interventionType.type
                });
                return rule.interventionType;
            }
        }
        return null;
    }
    async scheduleIntervention(userId, intervention, delay = 0) {
        const interventionId = `intervention_${userId}_${Date.now()}`;
        const scheduledTime = new Date(Date.now() + delay);
        const pendingIntervention = {
            id: interventionId,
            userId,
            type: intervention,
            scheduledTime,
            priority: this.getPriorityScore(intervention),
            attempts: 0,
            maxAttempts: this.getMaxAttempts(intervention),
            context: await this.gatherInterventionContext(userId, intervention)
        };
        this.pendingInterventions.set(interventionId, pendingIntervention);
        // Cache for persistence
        await this.cachePendingIntervention(pendingIntervention);
        this.logger.info('📅 Intervention scheduled', {
            interventionId,
            userId,
            type: intervention.type,
            urgency: intervention.urgency,
            scheduledTime: scheduledTime.toISOString()
        });
        return interventionId;
    }
    async getPendingInterventions() {
        const now = new Date();
        return Array.from(this.pendingInterventions.values())
            .filter(intervention => intervention.scheduledTime <= now)
            .sort((a, b) => b.priority - a.priority); // Higher priority first
    }
    async markCompleted(interventionId, outcome = 'successful') {
        const intervention = this.pendingInterventions.get(interventionId);
        if (!intervention)
            return;
        // Record in history
        const record = {
            id: interventionId,
            type: intervention.type,
            timestamp: new Date(),
            trigger: 'system_assessment',
            response: `Intervention ${outcome}`,
            outcome,
            followUpNeeded: outcome === 'failed'
        };
        await this.recordInterventionHistory(intervention.userId, record);
        // Remove from pending
        this.pendingInterventions.delete(interventionId);
        // Remove from cache
        await enhanced_cache_1.redisCache.del(`intervention:pending:${interventionId}`);
        this.logger.info('✅ Intervention completed', {
            interventionId,
            userId: intervention.userId,
            outcome,
            type: intervention.type.type
        });
        // Schedule follow-up if needed
        if (outcome === 'failed' && intervention.attempts < intervention.maxAttempts) {
            await this.scheduleFollowUp(intervention);
        }
    }
    // Private Methods
    async loadInterventionRules() {
        const rules = [
            {
                id: 'confusion_detection',
                name: 'Confusion Detection',
                description: 'Triggers when user shows signs of confusion',
                conditions: {
                    frustrationThreshold: 0.3,
                    repeatedQuestions: 2,
                    timeWindow: 600000 // 10 minutes
                },
                interventionType: {
                    type: 'confusion_help',
                    urgency: 'high',
                    timing: 'immediate',
                    method: 'dm'
                },
                cooldownMs: 1800000, // 30 minutes
                maxPerDay: 3
            },
            {
                id: 'engagement_drop',
                name: 'Engagement Drop Detection',
                description: 'Triggers when user engagement significantly drops',
                conditions: {
                    engagementDrop: 0.3,
                    inactivityHours: 24,
                    previousEngagement: 0.7
                },
                interventionType: {
                    type: 'engagement_boost',
                    urgency: 'medium',
                    timing: 'scheduled',
                    method: 'dm'
                },
                cooldownMs: 3600000, // 1 hour
                maxPerDay: 2
            },
            {
                id: 'conversion_opportunity',
                name: 'Conversion Opportunity',
                description: 'Triggers when user shows high conversion potential',
                conditions: {
                    conversionSignals: 2,
                    engagementScore: 0.8,
                    timeInOnboarding: 3 // days
                },
                interventionType: {
                    type: 'conversion_prompt',
                    urgency: 'low',
                    timing: 'optimal_moment',
                    method: 'dm'
                },
                cooldownMs: 86400000, // 24 hours
                maxPerDay: 1
            },
            {
                id: 'churn_risk',
                name: 'Churn Risk Detection',
                description: 'Triggers when user shows high churn risk',
                conditions: {
                    churnRisk: 0.7,
                    inactivityDays: 3,
                    failedInterventions: 2
                },
                interventionType: {
                    type: 'churn_prevention',
                    urgency: 'critical',
                    timing: 'immediate',
                    method: 'dm'
                },
                cooldownMs: 43200000, // 12 hours
                maxPerDay: 1
            },
            {
                id: 'learning_acceleration',
                name: 'Learning Acceleration',
                description: 'Triggers when user shows fast learning and high engagement',
                conditions: {
                    learningVelocity: 0.8,
                    engagementScore: 0.9,
                    questionsAsked: 5
                },
                interventionType: {
                    type: 'learning_acceleration',
                    urgency: 'low',
                    timing: 'optimal_moment',
                    method: 'dm'
                },
                cooldownMs: 172800000, // 48 hours
                maxPerDay: 1
            }
        ];
        for (const rule of rules) {
            this.interventionRules.set(rule.id, rule);
        }
        this.logger.info(`✅ Loaded ${rules.length} intervention rules`);
    }
    async loadPendingInterventions() {
        try {
            // Note: getPattern not available on RedisEnhancedCache, would need to implement pattern-based loading
            const cachedInterventions = [];
            for (const [_key, data] of cachedInterventions) {
                const intervention = JSON.parse(data);
                intervention.scheduledTime = new Date(intervention.scheduledTime);
                this.pendingInterventions.set(intervention.id, intervention);
            }
            this.logger.info(`📋 Loaded ${this.pendingInterventions.size} pending interventions`);
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load pending interventions from cache', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    startInterventionScheduler() {
        // Check for due interventions every 30 seconds
        setInterval(async () => {
            await this.processDueInterventions();
        }, 30000);
        this.logger.info('⏰ Intervention scheduler started');
    }
    async processDueInterventions() {
        const dueInterventions = await this.getPendingInterventions();
        if (dueInterventions.length > 0) {
            this.logger.debug(`⏰ Processing ${dueInterventions.length} due interventions`);
        }
        // Process interventions will be handled by the main agent
        // This just identifies which ones are due
    }
    async evaluateRule(rule, userId, behaviorData) {
        // Check cooldown
        if (await this.isInCooldown(rule.id, userId)) {
            return false;
        }
        // Check daily limit
        if (await this.exceedsDailyLimit(rule.id, userId)) {
            return false;
        }
        // Evaluate specific conditions
        switch (rule.id) {
            case 'confusion_detection':
                return await this.evaluateConfusionRule(rule, userId, behaviorData);
            case 'engagement_drop':
                return await this.evaluateEngagementRule(rule, userId, behaviorData);
            case 'conversion_opportunity':
                return await this.evaluateConversionRule(rule, userId, behaviorData);
            case 'churn_risk':
                return await this.evaluateChurnRule(rule, userId, behaviorData);
            case 'learning_acceleration':
                return await this.evaluateLearningRule(rule, userId, behaviorData);
            default:
                return false;
        }
    }
    async evaluateConfusionRule(rule, userId, data) {
        const frustrationLevel = data.frustrationIndicators.length > 0 ? 0.5 : 0;
        const hasConfusion = data.sentiment === 'confused';
        const repeatedQuestions = await this.countRecentQuestions(userId, rule.conditions.timeWindow);
        return (frustrationLevel >= rule.conditions.frustrationThreshold ||
            hasConfusion ||
            repeatedQuestions >= rule.conditions.repeatedQuestions);
    }
    async evaluateEngagementRule(rule, userId, data) {
        // Would need to access user profile for engagement metrics
        // For now, simulate based on behavior data
        const lowEngagement = data.sentiment === 'negative' || data.frustrationIndicators.length > 0;
        const inactivity = await this.getInactivityHours(userId);
        return lowEngagement && inactivity >= rule.conditions.inactivityHours;
    }
    async evaluateConversionRule(rule, _userId, data) {
        const conversionSignals = data.conversionSignals.length;
        const positiveEngagement = data.sentiment === 'positive' && data.learningIndicators.length > 0;
        return conversionSignals >= rule.conditions.conversionSignals || positiveEngagement;
    }
    async evaluateChurnRule(_rule, _userId, data) {
        const highFrustration = data.frustrationIndicators.length >= 2;
        const negativePattern = data.sentiment === 'frustrated' || data.sentiment === 'negative';
        const inactivity = await this.getInactivityDays(_userId);
        return (highFrustration || negativePattern) && inactivity >= _rule.conditions.inactivityDays;
    }
    async evaluateLearningRule(_rule, _userId, data) {
        const strongLearning = data.learningIndicators.length >= 2;
        const highEngagement = data.sentiment === 'positive' && data.questions.length > 0;
        const advancedQuestions = data.complexity === 'advanced';
        return strongLearning && (highEngagement || advancedQuestions);
    }
    async isInCooldown(ruleId, userId) {
        const lastTrigger = await enhanced_cache_1.redisCache.get(`intervention:cooldown:${ruleId}:${userId}`);
        if (!lastTrigger)
            return false;
        const rule = this.interventionRules.get(ruleId);
        if (!rule)
            return false;
        const lastTriggerTime = new Date(lastTrigger);
        const cooldownEnd = new Date(lastTriggerTime.getTime() + rule.cooldownMs);
        return Date.now() < cooldownEnd.getTime();
    }
    async exceedsDailyLimit(ruleId, userId) {
        const today = new Date().toDateString();
        const todayCount = await enhanced_cache_1.redisCache.get(`intervention:daily:${ruleId}:${userId}:${today}`);
        const rule = this.interventionRules.get(ruleId);
        if (!rule)
            return false;
        return parseInt(todayCount || '0') >= rule.maxPerDay;
    }
    async countRecentQuestions(_userId, _timeWindowMs) {
        // This would access recent behavior data
        // For now, simulate
        return 0;
    }
    async getInactivityHours(userId) {
        const lastActivity = await enhanced_cache_1.redisCache.get(`user:last_activity:${userId}`);
        if (!lastActivity)
            return 0;
        const lastActivityTime = new Date(lastActivity);
        return (Date.now() - lastActivityTime.getTime()) / (1000 * 60 * 60);
    }
    async getInactivityDays(userId) {
        const hours = await this.getInactivityHours(userId);
        return hours / 24;
    }
    getPriorityScore(intervention) {
        const urgencyScores = {
            critical: 100,
            high: 75,
            medium: 50,
            low: 25
        };
        const typeScores = {
            churn_prevention: 20,
            confusion_help: 15,
            engagement_boost: 10,
            conversion_prompt: 5,
            learning_acceleration: 5
        };
        return (urgencyScores[intervention.urgency] || 0) + (typeScores[intervention.type] || 0);
    }
    getMaxAttempts(intervention) {
        const attemptLimits = {
            churn_prevention: 3,
            confusion_help: 2,
            engagement_boost: 2,
            conversion_prompt: 1,
            learning_acceleration: 1
        };
        return attemptLimits[intervention.type] || 1;
    }
    async gatherInterventionContext(userId, intervention) {
        // Gather relevant context for the intervention
        return {
            userId,
            interventionType: intervention.type,
            timestamp: new Date().toISOString(),
            userActivity: await this.getUserActivitySummary(userId),
            previousInterventions: await this.getRecentInterventions(userId)
        };
    }
    async getUserActivitySummary(userId) {
        // Get recent activity summary
        return {
            lastActivity: await enhanced_cache_1.redisCache.get(`user:last_activity:${userId}`),
            messageCount: await enhanced_cache_1.redisCache.get(`user:message_count:${userId}`) || '0',
            engagementScore: await enhanced_cache_1.redisCache.get(`user:engagement:${userId}`) || '0.5'
        };
    }
    async getRecentInterventions(userId) {
        const history = this.userInterventionHistory.get(userId) || [];
        const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
        return history.filter(intervention => intervention.timestamp.getTime() > last24Hours);
    }
    async cachePendingIntervention(intervention) {
        const serialized = {
            ...intervention,
            scheduledTime: intervention.scheduledTime.toISOString()
        };
        await enhanced_cache_1.redisCache.set(`intervention:pending:${intervention.id}`, JSON.stringify(serialized), 3600 // 1 hour TTL
        );
    }
    async recordInterventionHistory(userId, record) {
        const history = this.userInterventionHistory.get(userId) || [];
        history.push(record);
        // Keep only last 50 interventions
        if (history.length > 50) {
            history.splice(0, history.length - 50);
        }
        this.userInterventionHistory.set(userId, history);
        // Set cooldown
        const rule = Array.from(this.interventionRules.values())
            .find(r => r.interventionType.type === record.type.type);
        if (rule) {
            await enhanced_cache_1.redisCache.set(`intervention:cooldown:${rule.id}:${userId}`, new Date().toISOString(), rule.cooldownMs / 1000 // TTL in seconds
            );
            // Increment daily counter
            const today = new Date().toDateString();
            const currentCount = await enhanced_cache_1.redisCache.get(`intervention:daily:${rule.id}:${userId}:${today}`) || '0';
            await enhanced_cache_1.redisCache.set(`intervention:daily:${rule.id}:${userId}:${today}`, (parseInt(currentCount) + 1).toString(), 86400 // 24 hours TTL
            );
        }
    }
    async scheduleFollowUp(intervention) {
        const followUpDelay = Math.pow(2, intervention.attempts) * 1800000; // Exponential backoff starting at 30 minutes
        const followUp = {
            ...intervention,
            id: `followup_${intervention.id}_${intervention.attempts + 1}`,
            scheduledTime: new Date(Date.now() + followUpDelay),
            attempts: intervention.attempts + 1,
            priority: intervention.priority - 10 // Lower priority for follow-ups
        };
        this.pendingInterventions.set(followUp.id, followUp);
        await this.cachePendingIntervention(followUp);
        this.logger.info('🔄 Follow-up intervention scheduled', {
            originalId: intervention.id,
            followUpId: followUp.id,
            attempt: followUp.attempts,
            delay: followUpDelay
        });
    }
    async isHealthy() {
        return this.interventionRules.size > 0;
    }
    async cleanup() {
        this.pendingInterventions.clear();
        this.interventionRules.clear();
        this.userInterventionHistory.clear();
        this.logger.info('🧹 InterventionSystem cleanup completed');
    }
}
exports.InterventionSystem = InterventionSystem;
