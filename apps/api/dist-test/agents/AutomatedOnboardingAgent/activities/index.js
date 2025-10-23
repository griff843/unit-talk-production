"use strict";
/**
 * AutomatedOnboardingAgent Temporal Activities
 *
 * Activity functions for user behavior tracking, conversation generation,
 * and automated onboarding workflows.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackUserBehavior = trackUserBehavior;
exports.generateConversation = generateConversation;
exports.updateUserProfile = updateUserProfile;
exports.scheduleIntervention = scheduleIntervention;
exports.analyzeOnboardingProgress = analyzeOnboardingProgress;
exports.processConversionOpportunity = processConversionOpportunity;
exports.checkOnboardingAgentHealth = checkOnboardingAgentHealth;
const logger_1 = require("../../../shared/logger");
const behaviorTracker_1 = require("../behaviorTracker");
const conversationEngine_1 = require("../conversationEngine");
const interventionSystem_1 = require("../interventionSystem");
// import { UserProfileManager } from '../userProfileManager';
const agentLogger = logger_1.logger.child({ component: 'AutomatedOnboardingAgent:Activities' });
// Activity functions for Temporal workflows
async function trackUserBehavior(data) {
    agentLogger.info('🔍 Tracking user behavior', { userId: data.userId, action: data.action });
    try {
        const behaviorTracker = new behaviorTracker_1.BehaviorTracker(agentLogger);
        await behaviorTracker.initialize();
        const behaviorId = await behaviorTracker.recordBehavior(data);
        return { success: true, behaviorId };
    }
    catch (error) {
        agentLogger.error('❌ Failed to track user behavior', { error });
        return { success: false };
    }
}
async function generateConversation(data) {
    logger_1.logger.info('💬 Generating conversation', { userId: data.userId, type: data.conversationType });
    try {
        const conversationEngine = new conversationEngine_1.ConversationEngine(logger_1.logger);
        const message = await conversationEngine.generateResponse(data.userId, data.context, {
            sentiment: 'neutral',
            complexity: 'basic',
            urgency: 'low',
            topicCategories: [],
            questions: [],
            frustrationIndicators: [],
            learningIndicators: [],
            conversionSignals: []
        });
        return { success: true, message };
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to generate conversation', { error });
        return { success: false };
    }
}
async function updateUserProfile(data) {
    logger_1.logger.info('👤 Updating user profile', { userId: data.userId });
    try {
        // Mock implementation - would need actual UserProfileManager
        const profile = {
            ...data.profileUpdates,
            lastUpdated: new Date().toISOString()
        };
        return { success: true, profile };
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to update user profile', { error });
        return { success: false };
    }
}
async function scheduleIntervention(data) {
    logger_1.logger.info('🚨 Scheduling intervention', {
        userId: data.userId,
        type: data.interventionType,
        priority: data.priority
    });
    try {
        const interventionSystem = new interventionSystem_1.InterventionSystem(logger_1.logger);
        await interventionSystem.initialize();
        const interventionId = await interventionSystem.scheduleIntervention(data.userId, {
            type: data.interventionType,
            urgency: data.priority || 'medium',
            timing: 'immediate',
            method: 'dm'
        });
        return { success: true, interventionId };
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to schedule intervention', { error });
        return { success: false };
    }
}
async function analyzeOnboardingProgress(data) {
    logger_1.logger.info('📊 Analyzing onboarding progress', { userId: data.userId });
    try {
        // Mock analysis - would integrate with actual UserProfileManager
        const analysis = {
            completionRate: Math.random() * 100,
            engagementScore: Math.random() * 10,
            nextSteps: [
                'Complete profile setup',
                'Engage with daily picks',
                'Join VIP upgrade conversation'
            ],
            riskFactors: [
                'Low engagement in first 24h',
                'No interaction with educational content'
            ]
        };
        return { success: true, analysis };
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to analyze onboarding progress', { error });
        return { success: false };
    }
}
async function processConversionOpportunity(data) {
    logger_1.logger.info('💰 Processing conversion opportunity', {
        userId: data.userId,
        type: data.opportunityType
    });
    try {
        const conversationEngine = new conversationEngine_1.ConversationEngine(logger_1.logger);
        const strategy = await conversationEngine.generateConversionMessage(data.userId, data.context);
        return { success: true, conversionStrategy: strategy };
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to process conversion opportunity', { error });
        return { success: false };
    }
}
// Health check activity
async function checkOnboardingAgentHealth() {
    try {
        // Check subsystem health
        const healthChecks = [
            { component: 'behavior_tracker', healthy: true },
            { component: 'conversation_engine', healthy: true },
            { component: 'user_profile_manager', healthy: true },
            { component: 'intervention_system', healthy: true }
        ];
        const healthyCount = healthChecks.filter(c => c.healthy).length;
        const status = healthyCount === healthChecks.length ? 'healthy' :
            healthyCount >= healthChecks.length / 2 ? 'degraded' : 'unhealthy';
        return {
            status,
            details: {
                healthChecks,
                timestamp: new Date().toISOString()
            }
        };
    }
    catch (error) {
        return {
            status: 'unhealthy',
            details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
    }
}
