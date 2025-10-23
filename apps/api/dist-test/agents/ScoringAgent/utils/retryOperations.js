"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetry = withRetry;
exports.withTransaction = withTransaction;
exports.logFailedPick = logFailedPick;
const logging_1 = require("../../../services/logging");
const types_1 = require("../types");
const DEFAULT_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
async function withRetry(operation, maxAttempts = DEFAULT_RETRY_ATTEMPTS, context = 'database operation') {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxAttempts) {
                logging_1.logger.error({ attempt, error, context }, `Failed after ${maxAttempts} attempts`);
                break;
            }
            logging_1.logger.warn({ attempt, error, context }, `Retry attempt ${attempt} of ${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
    }
    throw new types_1.GradingError(`${context} failed after ${maxAttempts} attempts: ${lastError?.message}`);
}
async function withTransaction(supabase, operations) {
    try {
        await supabase.rpc('begin_transaction');
        const result = await operations(supabase);
        await supabase.rpc('commit_transaction');
        return result;
    }
    catch (error) {
        await supabase.rpc('rollback_transaction');
        throw error;
    }
}
async function logFailedPick(supabase, pickId, error) {
    await withRetry(async () => {
        await supabase.from('failed_picks_log').insert({
            pick_id: pickId,
            error_message: error.message,
            error_stack: error.stack,
            retry_count: 0,
            status: 'pending_retry'
        });
    }, 3, 'logging failed pick');
}
