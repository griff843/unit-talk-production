"use strict";
/**
 * Audit Trail Manager with Fallback Mechanisms
 * Ensures comprehensive audit logging with multiple fallback strategies
 * Production-ready compliance and security audit system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditTrailManager = void 0;
exports.initializeAuditTrail = initializeAuditTrail;
exports.getAuditTrail = getAuditTrail;
const logger_1 = require("../utils/logger");
const fs_1 = require("fs");
const path_1 = require("path");
const logger = (0, logger_1.createLogger)('AuditTrailManager');
class AuditTrailManager {
    constructor(supabase, config = {}) {
        this.pendingEvents = [];
        this.isShuttingDown = false;
        this.supabase = supabase;
        this.config = {
            enableDatabase: true,
            enableFileSystem: true,
            enableRemoteLogging: false,
            fileSystemPath: (0, path_1.join)(process.cwd(), 'logs', 'audit'),
            maxRetries: 3,
            retryDelayMs: 1000,
            batchSize: 100,
            flushIntervalMs: 30000, // 30 seconds
            ...config
        };
        // Ensure audit log directory exists
        if (this.config.enableFileSystem && !(0, fs_1.existsSync)(this.config.fileSystemPath)) {
            (0, fs_1.mkdirSync)(this.config.fileSystemPath, { recursive: true });
        }
        // Start periodic flush
        this.startPeriodicFlush();
        // Handle graceful shutdown
        process.on('SIGINT', () => this.gracefulShutdown());
        process.on('SIGTERM', () => this.gracefulShutdown());
    }
    /**
     * Log an audit event with multiple fallback mechanisms
     */
    async logEvent(event) {
        const auditEvent = {
            id: this.generateEventId(),
            timestamp: new Date().toISOString(),
            ...event
        };
        // Add to pending queue for batch processing
        this.pendingEvents.push(auditEvent);
        // Immediate flush for critical events
        if (event.severity === 'critical') {
            await this.flushPendingEvents();
        }
        // Try immediate logging with fallbacks
        return await this.logEventWithFallbacks(auditEvent);
    }
    /**
     * Log event with multiple fallback strategies
     */
    async logEventWithFallbacks(event) {
        const results = {
            database: false,
            filesystem: false,
            remote: false
        };
        // Strategy 1: Database logging
        if (this.config.enableDatabase) {
            results.database = await this.logToDatabase(event);
        }
        // Strategy 2: File system logging (always attempt as fallback)
        if (this.config.enableFileSystem) {
            results.filesystem = await this.logToFileSystem(event);
        }
        // Strategy 3: Remote logging (if configured)
        if (this.config.enableRemoteLogging) {
            results.remote = await this.logToRemoteService(event);
        }
        // Success if at least one method succeeded
        const success = results.database || results.filesystem || results.remote;
        if (!success) {
            logger.error('❌ All audit logging methods failed', {
                eventId: event.id,
                action: event.action,
                resource: event.resource,
                results
            });
            // Last resort: Emergency file logging
            await this.emergencyFileLogging(event);
        }
        return success;
    }
    /**
     * Log to database with retry logic
     */
    async logToDatabase(event, retryCount = 0) {
        try {
            if (!this.supabase) {
                return false;
            }
            const { error } = await this.supabase
                .from('audit_logs')
                .insert({
                id: event.id,
                timestamp: event.timestamp,
                user_id: event.userId,
                action: event.action,
                resource: event.resource,
                resource_id: event.resourceId,
                details: event.details,
                ip_address: event.ipAddress,
                user_agent: event.userAgent,
                session_id: event.sessionId,
                correlation_id: event.correlationId,
                severity: event.severity,
                category: event.category
            });
            if (error) {
                throw new Error(error.message);
            }
            return true;
        }
        catch (error) {
            logger.warn('⚠️ Database audit logging failed', {
                eventId: event.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                retryCount
            });
            // Retry with exponential backoff
            if (retryCount < this.config.maxRetries) {
                await this.delay(this.config.retryDelayMs * Math.pow(2, retryCount));
                return await this.logToDatabase(event, retryCount + 1);
            }
            return false;
        }
    }
    /**
     * Log to file system (reliable fallback)
     */
    async logToFileSystem(event) {
        try {
            const logEntry = JSON.stringify(event) + '\n';
            const logFile = (0, path_1.join)(this.config.fileSystemPath, `audit-${this.getDateString()}.log`);
            (0, fs_1.appendFileSync)(logFile, logEntry, 'utf8');
            return true;
        }
        catch (error) {
            logger.error('❌ File system audit logging failed', {
                eventId: event.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    /**
     * Log to remote service (if configured)
     */
    async logToRemoteService(event) {
        try {
            // Placeholder for remote logging service (e.g., Splunk, ELK, etc.)
            // Implementation would depend on specific remote service
            logger.info('📡 Remote audit logging not implemented yet', { eventId: event.id });
            return false;
        }
        catch (error) {
            logger.error('❌ Remote audit logging failed', {
                eventId: event.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    /**
     * Emergency file logging when all else fails
     */
    async emergencyFileLogging(event) {
        try {
            const emergencyFile = (0, path_1.join)(this.config.fileSystemPath, 'emergency-audit.log');
            const logEntry = `EMERGENCY: ${JSON.stringify(event)}\n`;
            (0, fs_1.appendFileSync)(emergencyFile, logEntry, 'utf8');
            logger.warn('🚨 Emergency audit logging activated', {
                eventId: event.id,
                file: emergencyFile
            });
        }
        catch (error) {
            // If even emergency logging fails, log to console as last resort
            console.error('💥 CRITICAL: All audit logging methods failed', {
                eventId: event.id,
                event,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Flush pending events in batches
     */
    async flushPendingEvents() {
        if (this.pendingEvents.length === 0) {
            return;
        }
        const eventsToFlush = this.pendingEvents.splice(0, this.config.batchSize);
        logger.info(`📤 Flushing ${eventsToFlush.length} pending audit events`);
        // Process events in parallel for better performance
        const flushPromises = eventsToFlush.map(event => this.logEventWithFallbacks(event));
        try {
            const results = await Promise.allSettled(flushPromises);
            const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
            logger.info(`✅ Flushed audit events: ${successful}/${eventsToFlush.length} successful`);
        }
        catch (error) {
            logger.error('❌ Error during batch flush', error);
        }
    }
    /**
     * Start periodic flush timer
     */
    startPeriodicFlush() {
        this.flushTimer = setInterval(() => {
            if (!this.isShuttingDown) {
                this.flushPendingEvents();
            }
        }, this.config.flushIntervalMs);
    }
    /**
     * Graceful shutdown with final flush
     */
    async gracefulShutdown() {
        if (this.isShuttingDown) {
            return;
        }
        this.isShuttingDown = true;
        logger.info('🛑 Audit trail manager shutting down gracefully');
        // Clear periodic timer
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        // Final flush of pending events
        await this.flushPendingEvents();
        logger.info('✅ Audit trail manager shutdown complete');
    }
    /**
     * Generate unique event ID
     */
    generateEventId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get date string for log file naming
     */
    getDateString() {
        return new Date().toISOString().split('T')[0];
    }
    /**
     * Delay utility for retry logic
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get audit statistics
     */
    async getAuditStatistics() {
        return {
            pendingEvents: this.pendingEvents.length,
            isHealthy: !this.isShuttingDown,
            lastFlush: new Date().toISOString()
        };
    }
}
exports.AuditTrailManager = AuditTrailManager;
// Export singleton instance
let auditTrailManager = null;
function initializeAuditTrail(supabase, config) {
    if (!auditTrailManager) {
        auditTrailManager = new AuditTrailManager(supabase, config);
    }
    return auditTrailManager;
}
function getAuditTrail() {
    return auditTrailManager;
}
