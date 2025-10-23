"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignAgent = void 0;
exports.initializeCampaignAgent = initializeCampaignAgent;
const index_1 = require("../BaseAgent/index");
let instance = null;
class CampaignAgent extends index_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
    }
    async initialize() {
        this.deps.logger.info('Initializing CampaignAgent...');
        try {
            await this.validateDependencies();
            this.deps.logger.info('CampaignAgent initialized successfully');
        }
        catch (error) {
            this.deps.logger.error('Failed to initialize CampaignAgent:', {
                err: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async validateDependencies() {
        // Verify access to required tables
        const { error } = await this.deps.supabase
            .from('promotions')
            .select('id')
            .limit(1);
        if (error) {
            throw new Error(`Failed to access promotions table: ${error.message}`);
        }
    }
    async process() {
        try {
            // Process any active promotions
            await this.processActivePromotions();
            // Clean up expired promotions
            await this.cleanupExpired();
        }
        catch (error) {
            this.deps.logger.error('Error in CampaignAgent process:', {
                err: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async processActivePromotions() {
        const { data: activePromos, error } = await this.deps.supabase
            .from('promotions')
            .select('*')
            .eq('active', true)
            .lte('start_date', new Date().toISOString())
            .gte('end_date', new Date().toISOString());
        if (error) {
            throw new Error(`Failed to fetch active promotions: ${error.message}`);
        }
        for (const promo of activePromos || []) {
            await this.applyPromotion(promo);
        }
    }
    async cleanup() {
        try {
            await this.cleanupExpired();
            this.deps.logger.info('CampaignAgent cleanup completed');
        }
        catch (error) {
            this.deps.logger.error('Error during CampaignAgent cleanup:', {
                err: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async checkHealth() {
        const errors = [];
        try {
            const { error } = await this.deps.supabase
                .from('promotions')
                .select('id')
                .limit(1);
            if (error) {
                errors.push(`Database connectivity issue: ${error.message}`);
            }
        }
        catch (error) {
            errors.push(`Health check failed: ${error}`);
        }
        return {
            status: errors.length > 0 ? 'unhealthy' : 'healthy',
            timestamp: new Date().toISOString(),
            details: { errors }
        };
    }
    async collectMetrics() {
        const { data: promoStats } = await this.deps.supabase
            .from('promotions')
            .select('active, applied_count');
        const totalApplied = promoStats?.reduce((sum, p) => sum + (p.applied_count || 0), 0) || 0;
        return {
            agentName: 'CampaignAgent',
            successCount: totalApplied,
            errorCount: 0,
            warningCount: 0,
            processingTimeMs: 0,
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
        };
    }
    // Public methods for activities
    async executeCampaign(params) {
        await this.runCampaign(params);
    }
    async validateCampaign(params) {
        // Validate promotion parameters
        if (!params.name || !params.type || !params.value) {
            throw new Error('Invalid promotion parameters');
        }
        if (params.endDate && new Date(params.endDate) < new Date()) {
            throw new Error('Promotion end date must be in the future');
        }
    }
    async applyDiscounts() {
        await this.processActivePromotions();
    }
    async cleanupExpired() {
        const { error } = await this.deps.supabase
            .from('promotions')
            .update({ active: false })
            .lt('end_date', new Date().toISOString());
        if (error) {
            throw new Error(`Failed to cleanup expired promotions: ${error.message}`);
        }
    }
    async runCampaign(config) {
        this.deps.logger.info('Running promotion', { name: config.name });
        const result = await this.deps.supabase.from('promotions').insert({
            name: config.name,
            start_date: config.startDate,
            end_date: config.endDate,
            type: config.type,
            value: config.value,
            conditions: config.conditions,
            active: true
        });
        if (result.error) {
            this.deps.logger.error('Failed to insert promotion', {
                error: result.error?.message || 'Unknown database error'
            });
            throw result.error;
        }
        this.deps.logger.info('Promotion recorded successfully');
    }
    async applyPromotion(promo) {
        // Apply promotion logic here
        this.deps.logger.info(`Applying promotion: ${promo.name}`);
        // Update applied count
        await this.deps.supabase
            .from('promotions')
            .update({ applied_count: (promo.applied_count || 0) + 1 })
            .eq('id', promo.id);
    }
    // Public API
    static getInstance(dependencies) {
        if (!instance) {
            // Create a default config since logger doesn't have config property
            const config = {
                name: 'CampaignAgent',
                enabled: true,
                version: '1.0.0',
                logLevel: 'info',
                schedule: 'manual',
                metrics: {
                    enabled: true,
                    interval: 60,
                    port: 9090
                },
                retry: {
                    enabled: true,
                    maxRetries: 3,
                    backoffMs: 1000,
                    maxBackoffMs: 30000,
                    maxAttempts: 3,
                    backoff: 1000,
                    exponential: true,
                    jitter: false
                },
                health: {
                    enabled: true,
                    interval: 30,
                    timeout: 5000,
                    checkDb: true,
                    checkExternal: false
                }
            };
            instance = new CampaignAgent(config, dependencies);
        }
        return instance;
    }
}
exports.CampaignAgent = CampaignAgent;
function initializeCampaignAgent(dependencies) {
    // Create a default config since logger doesn't have config property
    const config = {
        name: 'CampaignAgent',
        enabled: true,
        version: '1.0.0',
        logLevel: 'info',
        schedule: 'manual',
        metrics: {
            enabled: true,
            interval: 60,
            port: 9090
        },
        retry: {
            enabled: true,
            maxRetries: 3,
            backoffMs: 1000,
            maxBackoffMs: 30000,
            maxAttempts: 3,
            backoff: 1000,
            exponential: true,
            jitter: false
        },
        health: {
            enabled: true,
            interval: 30,
            timeout: 5000,
            checkDb: true,
            checkExternal: false
        }
    };
    return new CampaignAgent(config, dependencies);
}
