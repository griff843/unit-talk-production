"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContestManager = void 0;
const zod_1 = require("zod");
const dateUtils_1 = require("../../utils/dateUtils");
// Validation schemas
const contestRuleSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    type: zod_1.z.string(),
    conditions: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
    points: zod_1.z.number(),
    bonuses: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
    penalties: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional()
});
const prizePoolSchema = zod_1.z.object({
    totalAmount: zod_1.z.number().positive(),
    totalValue: zod_1.z.number().positive(),
    currency: zod_1.z.string(),
    distribution: zod_1.z.array(zod_1.z.object({
        rank: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
        value: zod_1.z.number().positive(),
        type: zod_1.z.enum(['cash', 'credit', 'item', 'custom']),
        conditions: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
    })),
    winners: zod_1.z.array(zod_1.z.string()).default([]),
    specialPrizes: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid().default(() => crypto.randomUUID()),
        name: zod_1.z.string(),
        value: zod_1.z.number().positive(),
        type: zod_1.z.enum(['bonus', 'achievement', 'milestone']).default('bonus'),
        criteria: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).default({})
    })).optional(),
    sponsorships: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().default(''),
        sponsor: zod_1.z.string(),
        value: zod_1.z.number().positive(),
        type: zod_1.z.string().default('cash'),
        terms: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).default({}),
        requirements: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
        benefits: zod_1.z.record(zod_1.z.string(), zod_1.z.any())
    })).optional()
});
const contestSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string(),
    type: zod_1.z.enum(['daily', 'weekly', 'monthly', 'season', 'tournament', 'special']).optional(),
    startDate: zod_1.z.string(),
    endDate: zod_1.z.string(),
    status: zod_1.z.enum(['draft', 'active', 'completed', 'cancelled']),
    rules: zod_1.z.array(contestRuleSchema),
    prizePool: prizePoolSchema.optional(),
    participants: zod_1.z.array(zod_1.z.string()).default([]),
    metrics: zod_1.z.object({
        participation: zod_1.z.object({
            registered: zod_1.z.number().default(0),
            active: zod_1.z.number().default(0),
            completed: zod_1.z.number().default(0),
            disqualified: zod_1.z.number().default(0)
        }),
        engagement: zod_1.z.object({
            averageActiveDays: zod_1.z.number().default(0),
            completionRate: zod_1.z.number().default(0),
            retentionRate: zod_1.z.number().default(0)
        }),
        performance: zod_1.z.object({
            averageScore: zod_1.z.number().default(0),
            highestScore: zod_1.z.number().default(0),
            fairPlayRate: zod_1.z.number().default(1)
        }),
        financial: zod_1.z.object({
            totalPrizeValue: zod_1.z.number().default(0),
            averagePrize: zod_1.z.number().default(0),
            revenueGenerated: zod_1.z.number().optional()
        })
    }).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
});
class ContestManager {
    constructor(supabase, logger, errorHandler, _config) {
        this.supabase = supabase;
        this.logger = logger;
        this.errorHandler = errorHandler;
        this.metrics = {
            activeContests: 0,
            completedContests: 0,
            prizeValueDistributed: 0,
            errorCount: 0,
            processingTime: [],
            lastUpdate: new Date().toISOString()
        };
    }
    async logContestEvent(event) {
        try {
            // Log contest event to database
            const { error } = await this.supabase
                .from('contest_events')
                .insert([event]);
            if (error) {
                this.logger.error('Failed to log contest event', {
                    error: error.message,
                    code: error.code,
                    details: error.details
                });
            }
        }
        catch (error) {
            this.logger.error('Error logging contest event:', {
                err: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async initialize() {
        try {
            // Load existing contests and initialize metrics
            const { data: contests, error } = await this.supabase
                .from('contests')
                .select('*')
                .eq('status', 'active');
            if (error) {
                throw error;
            }
            this.metrics.activeContests = contests?.length || 0;
            this.metrics.lastUpdate = new Date().toISOString();
            // Set up real-time subscriptions
            this.realtimeChannel = this.supabase
                .channel('contest-updates')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'contests' }, (payload) => this.handleContestUpdate(payload))
                .subscribe();
            this.logger.info('ContestManager initialized', {
                activeContests: this.metrics.activeContests
            });
        }
        catch (error) {
            if (error instanceof Error) {
                this.logger.error('Failed to initialize ContestManager', {
                    err: error.message
                });
                this.errorHandler.handleError(error, { context: 'contest_init_error' });
            }
            else {
                const err = new Error(String(error));
                this.logger.error('Failed to initialize ContestManager', {
                    error: err.message
                });
                this.errorHandler.handleError(err, { context: 'contest_error' });
            }
            throw error;
        }
    }
    async cleanup() {
        try {
            // Archive completed contests older than 30 days
            const thirtyDaysAgo = (0, dateUtils_1.addDays)(new Date(), -30);
            const { error } = await this.supabase
                .from('contests')
                .update({ status: 'archived' })
                .eq('status', 'completed')
                .lt('endDate', (0, dateUtils_1.toISOString)(thirtyDaysAgo));
            if (error) {
                throw error;
            }
            // Clean up real-time subscriptions
            if (this.realtimeChannel) {
                await this.supabase.removeChannel(this.realtimeChannel);
            }
        }
        catch (err) {
            if (err instanceof Error) {
                this.logger.error('Failed to cleanup ContestManager', {
                    error: err.message
                });
                this.errorHandler.handleError(err, { context: 'contest_error' });
            }
            else {
                const errorObj = new Error(String(err));
                this.logger.error('Failed to cleanup ContestManager', {
                    error: errorObj.message
                });
                this.errorHandler.handleError(errorObj, { context: 'contest_update_error' });
            }
        }
    }
    async createContest(payload) {
        const startTime = Date.now();
        try {
            // Use a more flexible validation approach
            const validatedPayload = await contestSchema.partial().parseAsync(payload);
            // Validate prize pool if provided
            if (validatedPayload.prizePool) {
                // Add basic prize pool validation here instead of calling missing method
                if (!validatedPayload.prizePool.totalAmount || validatedPayload.prizePool.totalAmount <= 0) {
                    throw new Error('Prize pool must have a positive total amount');
                }
            }
            // Fix rules to match ContestRule interface
            const fixedRules = (validatedPayload.rules || []).map((rule) => ({
                id: rule.id || crypto.randomUUID(),
                name: rule.type,
                description: `Rule for ${rule.type}`,
                type: rule.type,
                parameters: rule.conditions || {},
                active: true
            }));
            // Fix sponsorships to match expected structure and participants to Participant[]
            const mapSponsorships = (sponsorships) => {
                if (!sponsorships) {
                    return undefined;
                }
                return sponsorships.map((sponsor, index) => ({
                    id: typeof sponsor.id === 'string' && sponsor.id.length > 0 ? sponsor.id : `sponsorship-${index}`,
                    sponsor: sponsor.sponsor,
                    value: typeof sponsor.value === 'number' ? sponsor.value : 0,
                    type: sponsor.type === 'cash' || sponsor.type === 'product' || sponsor.type === 'service' ? sponsor.type : 'cash',
                    terms: sponsor.terms ?? {}
                }));
            };
            const fixedSponsorships = mapSponsorships(validatedPayload.prizePool?.sponsorships);
            // Fix participants to Participant[]
            const fixedParticipants = (validatedPayload.participants || []).map((participant) => ({
                ...participant,
                id: participant.id || crypto.randomUUID(),
            }));
            // Construct the contest object to insert
            const contestToInsert = {
                id: validatedPayload.id || crypto.randomUUID(),
                name: validatedPayload.name || 'Untitled Contest',
                description: validatedPayload.description || 'No description provided',
                startDate: validatedPayload.startDate || (0, dateUtils_1.toISOString)(new Date()),
                endDate: validatedPayload.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
                status: validatedPayload.status || 'draft',
                type: validatedPayload.type || 'daily',
                rules: fixedRules,
                ...(validatedPayload.prizePool && {
                    prizePool: {
                        totalAmount: validatedPayload.prizePool.totalAmount || 0,
                        totalValue: validatedPayload.prizePool.totalValue || validatedPayload.prizePool.totalAmount || 0,
                        currency: validatedPayload.prizePool.currency || 'USD',
                        distribution: (validatedPayload.prizePool.distribution || []).map((dist, index) => ({
                            rank: dist.rank || (index + 1),
                            value: dist.value || 0,
                            type: dist.type || 'cash',
                            ...(dist.conditions !== undefined && { conditions: dist.conditions })
                        })),
                        winners: validatedPayload.prizePool.winners || [],
                        specialPrizes: (validatedPayload.prizePool.specialPrizes || []).map((prize, index) => ({
                            id: prize.id || crypto.randomUUID(),
                            name: prize.name || `Special Prize ${index + 1}`,
                            value: prize.value || 0,
                            type: prize.type || 'bonus',
                            criteria: prize.criteria || {}
                        })),
                        ...(fixedSponsorships !== undefined && { sponsorships: fixedSponsorships })
                    }
                }),
                participants: fixedParticipants,
                metadata: validatedPayload.metadata || {}
            };
            // Insert into database
            const { data, error } = await this.supabase
                .from('contests')
                .insert([contestToInsert])
                .select()
                .single();
            if (error) {
                throw error;
            }
            this.logger.info(`Created contest with ID: ${data.id}`);
            // Log contest creation event
            await this.logContestEvent({
                type: 'contest_created',
                timestamp: (0, dateUtils_1.toISOString)(new Date()),
                contestId: data.id,
                details: { name: data.name },
                severity: 'info',
                correlationId: crypto.randomUUID()
            });
            return data;
        }
        catch (err) {
            this.logger.error('Failed to create contest', {
                error: err instanceof Error ? err.message : String(err)
            });
            this.errorHandler.handleError(err instanceof Error ? err : new Error(String(err)), { context: 'contest_creation_error' });
            throw err;
        }
        finally {
            const duration = Date.now() - startTime;
            this.logger.info(`createContest took ${duration}ms`);
        }
    }
    async checkHealth() {
        try {
            // Check database connectivity
            const { error } = await this.supabase.from('contests').select('count').limit(1);
            if (error) {
                throw error;
            }
            // Check metrics freshness  
            const lastUpdateTime = new Date(this.metrics.lastUpdate).getTime();
            const metricsFresh = (Date.now() - lastUpdateTime) < 5 * 60 * 1000; // 5 minutes
            // Calculate health metrics
            const averageProcessingTime = this.metrics.processingTime.length > 0 ?
                this.metrics.processingTime.reduce((a, b) => a + b, 0) / this.metrics.processingTime.length : 0;
            const errorRate = (this.metrics.activeContests + this.metrics.completedContests) > 0 ?
                this.metrics.errorCount / (this.metrics.activeContests + this.metrics.completedContests) : 0;
            const status = metricsFresh && errorRate < 0.1 ? 'healthy' : 'degraded';
            return {
                status,
                timestamp: (0, dateUtils_1.toISOString)(new Date()),
                details: {
                    activeContests: this.metrics.activeContests,
                    completedContests: this.metrics.completedContests,
                    errorRate,
                    averageProcessingTime,
                    metricsFresh
                }
            };
        }
        catch (error) {
            this.logger.error('Health check failed', {
                err: error instanceof Error ? error.message : String(error)
            });
            return {
                status: 'unhealthy',
                timestamp: (0, dateUtils_1.toISOString)(new Date()),
                details: { error: error instanceof Error ? error : new Error(String(error)) }
            };
        }
    }
    getMetrics() {
        return {
            contests: {
                active: this.metrics.activeContests,
                completed: this.metrics.completedContests,
                totalParticipants: 0, // Would need to query database
                prizeValueDistributed: this.metrics.prizeValueDistributed
            },
            fairPlay: {
                checksPerformed: 0, // Would need to implement
                violationsDetected: 0, // Would need to implement
                appealRate: 0, // Would need to implement
                averageFairPlayScore: 1.0 // Would need to calculate
            },
            performance: {
                processingTime: this.metrics.processingTime.length > 0 ?
                    this.metrics.processingTime.reduce((a, b) => a + b, 0) / this.metrics.processingTime.length : 0,
                updateFrequency: 0, // Would need to implement
                errorRate: (this.metrics.activeContests + this.metrics.completedContests) > 0 ?
                    this.metrics.errorCount / (this.metrics.activeContests + this.metrics.completedContests) : 0,
                uptime: 1.0 // Would need to implement
            },
            healthStatus: {
                status: 'healthy',
                timestamp: (0, dateUtils_1.toISOString)(new Date()),
                details: {}
            }
        };
    }
    async handleContestUpdate(payload) {
        // Handle real-time contest updates
        this.logger.debug('Contest update received', { payload });
    }
}
exports.ContestManager = ContestManager;
