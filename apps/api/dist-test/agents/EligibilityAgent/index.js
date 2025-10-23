"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EligibilityAgent = void 0;
exports.initializeEligibilityAgent = initializeEligibilityAgent;
const metricsServer_1 = require("../../services/metricsServer");
const index_1 = require("../BaseAgent/index");
const promoteToDailyPicks_1 = require("./promoteToDailyPicks");
let instance = null;
class EligibilityAgent extends index_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
        this.metricsStarted = false;
    }
    async initialize() {
        this.logger.info('Initializing EligibilityAgent...');
        try {
            // Start metrics server if not already started
            if (!this.metricsStarted) {
                (0, metricsServer_1.startMetricsServer)(9001); // Dedicated port for eligibility agent metrics
                this.metricsStarted = true;
            }
            await this.validateDependencies();
            this.logger.info('EligibilityAgent initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize EligibilityAgent:', {
                err: error instanceof Error ? error.message : String(error)
            });
            this.errorHandler?.handleError(error);
            throw error;
        }
    }
    async validateDependencies() {
        // Verify access to required tables
        const tables = ['graded_picks', 'unified_picks'];
        if (!this.supabase) {
            throw new Error('Supabase client is required for EligibilityAgent');
        }
        for (const table of tables) {
            const { error } = await this.supabase
                .from(table)
                .select('id')
                .limit(1);
            if (error) {
                throw new Error(`Failed to access ${table} table: ${error.message}`);
            }
        }
    }
    async process() {
        const startTime = Date.now();
        try {
            metricsServer_1.ingestedCounter.inc(); // Increment the ingestion counter
            await this.runPromotionCycle();
            // Record successful processing time
            const duration = (Date.now() - startTime) / 1000;
            metricsServer_1.durationHistogram.observe(duration);
        }
        catch (error) {
            metricsServer_1.errorCounter.inc(); // Increment error counter
            this.logger.error('Promotion cycle failed:', {
                err: error instanceof Error ? error.message : String(error)
            });
            this.errorHandler?.handleError(error);
            throw error;
        }
    }
    async runPromotionCycle() {
        this.logger.info('Starting promotion cycle...');
        await (0, promoteToDailyPicks_1.promoteToDailyPicks)();
        this.logger.info('Promotion cycle completed successfully');
    }
    async cleanup() {
        this.logger.info('EligibilityAgent cleanup completed');
    }
    async checkHealth() {
        try {
            // Check if there are recent promotions in unified_picks
            if (!this.supabase) {
                throw new Error('Supabase client is required for EligibilityAgent');
            }
            const { data, error } = await this.supabase
                .from('unified_picks')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1);
            if (error) {
                throw error;
            }
            const hasRecentActivity = data && data.length > 0 &&
                new Date(data[0].created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000; // 24 hours
            return {
                status: hasRecentActivity ? 'healthy' : 'degraded',
                timestamp: new Date().toISOString(),
                details: {
                    hasRecentActivity,
                    lastActivity: data?.[0]?.created_at
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                details: {
                    err: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
    async collectMetrics() {
        try {
            // Get promotion counts from the last 24 hours
            if (!this.supabase) {
                throw new Error('Supabase client is required for EligibilityAgent');
            }
            const { data, error } = await this.supabase
                .from('unified_picks')
                .select('id')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
            if (error) {
                throw error;
            }
            const promotionCount = data?.length || 0;
            const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
            return {
                agentName: this.config.name,
                successCount: promotionCount,
                errorCount: 0, // Would need to track this separately
                warningCount: 0,
                processingTimeMs: 0, // Would need to track this
                memoryUsageMb: memoryUsage
            };
        }
        catch (error) {
            this.logger.error('Failed to collect metrics:', {
                err: error instanceof Error ? error.message : String(error)
            });
            return {
                agentName: this.config.name,
                successCount: 0,
                errorCount: 1,
                warningCount: 0,
                processingTimeMs: 0,
                memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
            };
        }
    }
    // Public method to trigger promotion
    async promotePicks() {
        await this.process();
    }
    // Singleton pattern
    static getInstance() {
        return instance;
    }
}
exports.EligibilityAgent = EligibilityAgent;
// Factory function to create EligibilityAgent instance
function initializeEligibilityAgent() {
    // This would typically receive config and dependencies from somewhere
    const config = {
        name: 'EligibilityAgent',
        enabled: true,
        version: '1.0.0',
        logLevel: 'info',
        metrics: {
            enabled: true,
            interval: 60
        }
    };
    // Dependencies would be injected here
    const deps = {
        supabase: {}, // Would be actual Supabase client
        logger: {}, // Would be actual logger
        errorHandler: {} // Would be actual error handler
    };
    instance = new EligibilityAgent(config, deps);
    return instance;
}
// Legacy script for backwards compatibility
if (require.main === module) {
    const agent = initializeEligibilityAgent();
    (async () => {
        try {
            await agent.initialize();
            await agent.process();
            await agent.cleanup();
        }
        catch (error) {
            console.error(error);
        }
    })();
}
