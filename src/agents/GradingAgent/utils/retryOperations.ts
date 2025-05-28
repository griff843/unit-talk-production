import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../../services/logging';
import { GradingError } from '../types';

const DEFAULT_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = DEFAULT_RETRY_ATTEMPTS,
  context: string = 'database operation'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxAttempts) {
        logger.error({ attempt, error, context }, `Failed after ${maxAttempts} attempts`);
        break;
      }
      logger.warn({ attempt, error, context }, `Retry attempt ${attempt} of ${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
  
  throw new GradingError(`${context} failed after ${maxAttempts} attempts: ${lastError?.message}`);
}

export async function withTransaction<T>(
  supabase: SupabaseClient,
  operations: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  try {
    await supabase.rpc('begin_transaction');
    const result = await operations(supabase);
    await supabase.rpc('commit_transaction');
    return result;
  } catch (error) {
    await supabase.rpc('rollback_transaction');
    throw error;
  }
}

export async function logFailedPick(
  supabase: SupabaseClient,
  pickId: string,
  error: Error
): Promise<void> {
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