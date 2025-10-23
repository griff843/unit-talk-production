"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performAudit = performAudit;
exports.generateReport = generateReport;
exports.checkCompliance = checkCompliance;
exports.performSecurityAudit = performSecurityAudit;
const __1 = require("..");
const logger_1 = require("../../../utils/logger");
/**
 * Temporal activity for performing audits
 */
async function performAudit(_params) {
    const config = {
        name: 'AuditAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: { enabled: true, interval: 300000 },
        health: { enabled: true, interval: 60000, timeout: 5000, checkDb: true, checkExternal: true },
        retry: { enabled: true, maxRetries: 5, maxAttempts: 5, backoffMs: 200, backoff: 200, maxBackoffMs: 30000, exponential: true, jitter: true }
    };
    const deps = {
        logger: (0, logger_1.makeLogger)('AuditAgent'),
        supabase: null,
        errorHandler: null
    };
    const agent = new __1.AuditAgent(config, deps);
    await agent.start();
}
/**
 * Temporal activity for generating audit reports
 */
async function generateReport(_params) {
    const config = {
        name: 'AuditAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
        health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
        retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
    };
    const deps = {
        logger: (0, logger_1.makeLogger)('AuditAgent'),
        supabase: null,
        errorHandler: null
    };
    const agent = new __1.AuditAgent(config, deps);
    await agent.start();
}
/**
 * Temporal activity for compliance checks
 */
async function checkCompliance(_params) {
    const config = {
        name: 'AuditAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
        health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
        retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
    };
    const deps = {
        logger: (0, logger_1.makeLogger)('AuditAgent'),
        supabase: null,
        errorHandler: null
    };
    const agent = new __1.AuditAgent(config, deps);
    await agent.start();
}
/**
 * Temporal activity for security audits
 */
async function performSecurityAudit(_params) {
    const config = {
        name: 'SecurityAuditAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: { enabled: true, interval: 300000 },
        health: { enabled: true, interval: 60000, timeout: 5000, checkDb: true, checkExternal: true },
        retry: { enabled: true, maxRetries: 5, maxAttempts: 5, backoffMs: 200, backoff: 200, maxBackoffMs: 30000, exponential: true, jitter: true }
    };
    const deps = {
        logger: (0, logger_1.makeLogger)('AuditAgent'),
        supabase: null,
        errorHandler: null
    };
    const agent = new __1.AuditAgent(config, deps);
    await agent.start();
}
