"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dlq = exports.DeadLetterQueue = exports.DeadLetterSchema = void 0;
const events_1 = require("events");
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
exports.DeadLetterSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    agent: zod_1.z.string(),
    operation: zod_1.z.string(),
    payload: zod_1.z.unknown(),
    error: zod_1.z.object({
        message: zod_1.z.string(),
        stack: zod_1.z.string().optional(),
        code: zod_1.z.string().optional(),
    }),
    retry_count: zod_1.z.number().int(),
    max_retries: zod_1.z.number().int(),
    next_retry: zod_1.z.string().datetime().optional(),
    status: zod_1.z.enum(['pending', 'retrying', 'failed', 'resolved']),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime(),
});
class DeadLetterQueue extends events_1.EventEmitter {
    constructor(supabase, config) {
        super();
        this.supabase = supabase;
        this.config = config;
        this.logger = (0, logger_1.createLogger)('DLQ');
    }
    static getInstance(supabase, config) {
        if (!DeadLetterQueue.instance) {
            DeadLetterQueue.instance = new DeadLetterQueue(supabase, config);
        }
        return DeadLetterQueue.instance;
    }
    async initialize() {
        this.logger.info('Initializing Dead Letter Queue');
        await this.setupProcessing();
    }
    async enqueue(agent, operation, payload, error) {
        try {
            const deadLetter = {
                agent,
                operation,
                payload,
                error: {
                    message: error.message,
                    stack: error.stack,
                    code: error.code,
                },
                retry_count: 0,
                max_retries: this.config.maxRetries,
                status: 'pending',
                next_retry: new Date(Date.now() + this.config.initialRetryDelayMs).toISOString(),
            };
            await this.supabase.from('dead_letter_queue').insert(deadLetter);
            this.logger.info('Message enqueued to DLQ', {
                agent,
                operation,
                error: error.message,
            });
        }
        catch (error) {
            this.logger.error('Failed to enqueue to DLQ:', error);
            throw error;
        }
    }
    async setupProcessing() {
        this.processingInterval = setInterval(() => this.processQueue(), this.config.processingIntervalMs);
    }
    async processQueue() {
        try {
            const { data: deadLetters, error } = await this.supabase
                .from('dead_letter_queue')
                .select('*')
                .in('status', ['pending', 'retrying'])
                .lte('next_retry', new Date().toISOString())
                .order('next_retry', { ascending: true })
                .limit(10);
            if (error) {
                throw error;
            }
            for (const letter of deadLetters || []) {
                await this.processDeadLetter(letter);
            }
        }
        catch (error) {
            this.logger.error('Failed to process DLQ:', error);
        }
    }
    async processDeadLetter(letter) {
        try {
            // Update status to retrying
            await this.supabase
                .from('dead_letter_queue')
                .update({ status: 'retrying' })
                .eq('id', letter.id);
            // Attempt to replay the operation
            await this.replayOperation(letter);
            // Mark as resolved if successful
            await this.supabase
                .from('dead_letter_queue')
                .update({
                status: 'resolved',
                updated_at: new Date().toISOString()
            })
                .eq('id', letter.id);
            this.logger.info('Successfully processed dead letter', {
                id: letter.id,
                agent: letter.agent,
                operation: letter.operation,
            });
        }
        catch (error) {
            const retryCount = letter.retry_count + 1;
            const status = retryCount >= letter.max_retries ? 'failed' : 'pending';
            await this.supabase
                .from('dead_letter_queue')
                .update({
                status,
                retry_count: retryCount,
                next_retry: this.calculateNextRetry(retryCount),
                updated_at: new Date().toISOString(),
            })
                .eq('id', letter.id);
            this.logger.warn('Failed to process dead letter', {
                id: letter.id,
                agent: letter.agent,
                operation: letter.operation,
                retryCount,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async replayOperation(letter) {
        // Emit event for agent to handle
        this.emit('replay', {
            agent: letter.agent,
            operation: letter.operation,
            payload: letter.payload,
        });
    }
    calculateNextRetry(retryCount) {
        const delay = Math.min(this.config.initialRetryDelayMs * Math.pow(2, retryCount), this.config.maxRetryDelayMs);
        return new Date(Date.now() + delay).toISOString();
    }
    async shutdown() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
    }
}
exports.DeadLetterQueue = DeadLetterQueue;
// Create and export a singleton instance
exports.dlq = DeadLetterQueue.getInstance(
// Supabase client will be injected at runtime
null, {
    maxRetries: 3,
    initialRetryDelayMs: 1000 * 60, // 1 minute
    maxRetryDelayMs: 1000 * 60 * 60, // 1 hour
    processingIntervalMs: 1000 * 30, // 30 seconds
});
