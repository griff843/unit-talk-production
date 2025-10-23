"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUSPError = logUSPError;
exports.monitorAPIQuota = monitorAPIQuota;
exports.checkSystemHealth = checkSystemHealth;
exports.detectLiveGames = detectLiveGames;
exports.logWorkflowMetrics = logWorkflowMetrics;
exports.logGradingError = logGradingError;
exports.logError = logError;
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.makeLogger)('OperatorActivities');
/**
 * OPERATOR ACTIVITIES
 * Activities for system monitoring, health checks, and operator notifications
 */
async function logUSPError(params) {
    try {
        logger.error(`USP Error - ${params.uspType}:`, {
            uspType: params.uspType,
            error: params.error,
            cycleCount: params.cycleCount,
            timestamp: new Date().toISOString()
        });
        // Send operator alert for critical USP errors
        const { sendOperatorAlert } = await Promise.resolve().then(() => __importStar(require('./alerts')));
        await sendOperatorAlert({
            type: 'system_error',
            message: `USP Detection Error (${params.uspType}): ${params.error}`,
            severity: 'high',
            metadata: {
                uspType: params.uspType,
                cycleCount: params.cycleCount
            }
        });
        return { success: true };
    }
    catch (error) {
        const errorContext = error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) };
        logger.error('Failed to log USP err:', errorContext);
        return { success: false };
    }
}
async function monitorAPIQuota(params) {
    try {
        const percentage = (params.currentUsage / params.limit) * 100;
        logger.info(`API Quota Check - ${params.provider}:`, {
            provider: params.provider,
            currentUsage: params.currentUsage,
            limit: params.limit,
            percentage: percentage.toFixed(2)
        });
        // Send warning if quota is high
        if (percentage >= 90) {
            const { sendQuotaWarning } = await Promise.resolve().then(() => __importStar(require('./alerts')));
            await sendQuotaWarning({
                provider: params.provider,
                currentUsage: params.currentUsage,
                limit: params.limit,
                percentage
            });
        }
        return {
            success: true,
            shouldFallback: percentage >= 95,
            percentage
        };
    }
    catch (error) {
        const errorContext = error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) };
        logger.error(`API quota monitoring failed for ${params.provider}:`, errorContext);
        return {
            success: false,
            shouldFallback: true,
            percentage: 100
        };
    }
}
async function checkSystemHealth(params) {
    try {
        logger.info(`System health check - Cycle ${params.cycleCount}`, {
            cycleCount: params.cycleCount,
            components: params.components
        });
        const issues = [];
        let healthScore = 100;
        // Check each component
        for (const component of params.components) {
            try {
                const componentHealth = await checkComponentHealth(component);
                if (!componentHealth.healthy) {
                    issues.push(`${component}: ${componentHealth.issue}`);
                    healthScore -= 20;
                }
            }
            catch (componentError) {
                issues.push(`${component}: Health check failed - ${componentError}`);
                healthScore -= 25;
            }
        }
        // Send alert if health is poor
        if (healthScore < 70) {
            const { sendOperatorAlert } = await Promise.resolve().then(() => __importStar(require('./alerts')));
            await sendOperatorAlert({
                type: 'system_error',
                message: `System Health Alert: Score ${healthScore}/100`,
                severity: healthScore < 50 ? 'critical' : 'high',
                metadata: {
                    healthScore,
                    issues,
                    cycleCount: params.cycleCount
                }
            });
        }
        return {
            success: issues.length === 0,
            healthScore: Math.max(0, healthScore),
            issues
        };
    }
    catch (error) {
        const errorContext = error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) };
        logger.error('System health check failed:', errorContext);
        return {
            success: false,
            healthScore: 0,
            issues: [String(error)]
        };
    }
}
async function detectLiveGames(params) {
    try {
        logger.info(`Detecting live games for leagues: ${params.leagues.join(', ')}`);
        const liveGames = [];
        const errors = [];
        // Mock live game detection - replace with actual implementation
        for (const league of params.leagues) {
            try {
                // Simulate live game detection
                const games = await mockLiveGameDetection(league);
                liveGames.push(...games);
            }
            catch (gameError) {
                errors.push(`Live game detection failed for ${league}: ${gameError}`);
            }
        }
        logger.info(`Live games detected:`, {
            leagues: params.leagues,
            liveGamesCount: liveGames.length,
            errors: errors.length
        });
        return {
            success: errors.length === 0,
            liveGames,
            errors
        };
    }
    catch (error) {
        const errorContext = error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) };
        logger.error('Live game detection failed:', errorContext);
        return {
            success: false,
            liveGames: [],
            errors: [String(error)]
        };
    }
}
async function logWorkflowMetrics(params) {
    try {
        logger.info(`Workflow metrics - ${params.workflowName}:`, {
            workflowName: params.workflowName,
            duration: params.duration,
            success: params.success,
            cycleCount: params.cycleCount,
            ...params.metadata
        });
        // Send alert for slow workflows
        if (params.duration > 90000) { // 90 seconds
            const { sendOperatorAlert } = await Promise.resolve().then(() => __importStar(require('./alerts')));
            await sendOperatorAlert({
                type: 'system_error',
                message: `Slow Workflow: ${params.workflowName} took ${Math.round(params.duration / 1000)}s`,
                severity: 'high',
                metadata: {
                    workflowName: params.workflowName,
                    duration: params.duration,
                    cycleCount: params.cycleCount
                }
            });
        }
        return { success: true };
    }
    catch (error) {
        const errorContext = error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) };
        logger.error('Failed to log workflow metrics:', errorContext);
        return { success: false };
    }
}
// Helper functions
async function checkComponentHealth(component) {
    // Mock component health check - replace with actual implementation
    switch (component) {
        case 'database':
            return { healthy: true };
        case 'temporal':
            return { healthy: true };
        case 'discord':
            return { healthy: true };
        case 'apis':
            return { healthy: true };
        default:
            return { healthy: false, issue: 'Unknown component' };
    }
}
async function mockLiveGameDetection(league) {
    // Mock implementation - replace with actual live game detection
    return [
        {
            id: `${league}-game-${Date.now()}`,
            league,
            homeTeam: 'Team A',
            awayTeam: 'Team B',
            status: 'live',
            startTime: new Date().toISOString()
        }
    ];
}
/**
 * Grading error logging activity for scoring workflow error handling
 */
async function logGradingError(params) {
    try {
        logger.error('Grading Error:', {
            error: params.error,
            leagues: params.leagues,
            cycleCount: params.cycleCount,
            timestamp: new Date().toISOString()
        });
        // Send operator alert for critical grading errors
        const { sendOperatorAlert } = await Promise.resolve().then(() => __importStar(require('./alerts')));
        await sendOperatorAlert({
            type: 'system_error',
            message: `Grading System Error (Cycle ${params.cycleCount}): ${params.error}`,
            severity: 'high',
            metadata: {
                leagues: params.leagues,
                cycleCount: params.cycleCount
            }
        });
    }
    catch (logErr) {
        logger.error('Failed to log grading error:', logErr);
    }
}
/**
 * General error logging activity for workflow error handling
 */
async function logError(params) {
    try {
        logger.error('Workflow Error:', {
            error: params.error,
            timestamp: params.timestamp,
            context: params.context || {},
            loggedAt: new Date().toISOString()
        });
        return { success: true };
    }
    catch (logErr) {
        logger.error('Failed to log workflow error:', logErr);
        return { success: false };
    }
}
