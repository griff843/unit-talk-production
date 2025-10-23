"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAlert = processAlert;
exports.evaluateConditions = evaluateConditions;
exports.sendNotification = sendNotification;
exports.escalateAlert = escalateAlert;
exports.detectSuspiciousActivity = detectSuspiciousActivity;
exports.detectLineMovement = detectLineMovement;
exports.detectSteamMovement = detectSteamMovement;
exports.detectHedgeOpportunities = detectHedgeOpportunities;
exports.detectMiddleOpportunities = detectMiddleOpportunities;
exports.detectInjuryImpacts = detectInjuryImpacts;
exports.detectStaleLines = detectStaleLines;
const __1 = require("..");
const logger_1 = require("../../../utils/logger");
/**
 * Temporal activity for processing alerts
 */
async function processAlert() {
    // Create minimal config for activity execution
    const config = {
        name: 'AlertAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
        health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
        retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
    };
    const deps = {
        logger: (0, logger_1.makeLogger)('AlertAgent'),
        supabase: undefined // Will be injected by the agent
    };
    const agent = new __1.AlertAgent(config, deps);
    await agent.start();
}
/**
 * Temporal activity for evaluating alert conditions
 */
async function evaluateConditions() {
    const config = {
        name: 'AlertAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
        health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
        retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
    };
    const deps = {
        logger: (0, logger_1.makeLogger)('AlertAgent'),
        supabase: null
    };
    const agent = new __1.AlertAgent(config, deps);
    await agent.start();
}
/**
 * Temporal activity for sending notifications
 */
async function sendNotification() {
    const config = {
        name: 'AlertAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
        health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
        retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
    };
    const deps = {
        logger: (0, logger_1.makeLogger)('AlertAgent'),
        supabase: null
    };
    const agent = new __1.AlertAgent(config, deps);
    await agent.start();
}
/**
 * Temporal activity for escalating alerts
 */
async function escalateAlert() {
    const config = {
        name: 'AlertAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
        health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
        retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
    };
    const deps = {
        logger: (0, logger_1.makeLogger)('AlertAgent'),
        supabase: null
    };
    const agent = new __1.AlertAgent(config, deps);
    await agent.start();
}
/**
 * Missing activities required by syndicate-scheduler workflow
 */
async function detectSuspiciousActivity(params) {
    console.log(`[AlertAgent] Detecting suspicious activity for leagues: ${params.leagues.join(', ')}`);
    // Return empty array for now - placeholder implementation
    return [];
}
async function detectLineMovement(params) {
    console.log(`[AlertAgent] Detecting line movement for leagues: ${params.leagues.join(', ')}`);
    return [];
}
async function detectSteamMovement(params) {
    console.log(`[AlertAgent] Detecting steam movement for leagues: ${params.leagues.join(', ')}`);
    return [];
}
async function detectHedgeOpportunities(params) {
    console.log(`[AlertAgent] Detecting hedge opportunities for leagues: ${params.leagues.join(', ')}`);
    return [];
}
async function detectMiddleOpportunities(params) {
    console.log(`[AlertAgent] Detecting middle opportunities for leagues: ${params.leagues.join(', ')}`);
    return [];
}
async function detectInjuryImpacts(params) {
    console.log(`[AlertAgent] Detecting injury impacts for leagues: ${params.leagues.join(', ')}`);
    return [];
}
async function detectStaleLines(params) {
    console.log(`[AlertAgent] Detecting stale lines for leagues: ${params.leagues.join(', ')}, maxAge: ${params.maxAge}`);
    return [];
}
