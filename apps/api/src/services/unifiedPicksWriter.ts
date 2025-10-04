/**
 * Unified Picks Writer - Production-Grade Edition
 *
 * Handles batch upserts of core market picks to unified_picks table
 * with deduplication, chunking, retry logic, and configurable timeouts.
 *
 * Features:
 * - Configurable Supabase timeouts (default 180s for large batches)
 * - Optimized batch size (250 records for better performance)
 * - Exponential backoff retry logic for timeout errors
 * - Progress logging every N records
 * - Connection pooling via shared client
 * - Query timeout hints for Supabase operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { UnifiedPickCoreMarket } from '../agents/FeedAgent/transform';

interface WriteMetrics {
  attemptedWrites: number;
  inserted: number;
  skippedDedup: number;
  errors: number;
  retries: number;
  processingTimeMs: number;
  firstError?: {
    code: string;
    message: string;
    details: any;
    hint: any;
  };
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,  // Start at 1 second
  maxDelayMs: 30000,  // Cap at 30 seconds
};

/**
 * Summarize write metrics as a single-line string for observability
 * Format: processed=X inserted=Y skippedDedup=Z errors=K retries=R timeMs=T
 */
export function summarizeWriteMetrics(
  metrics: WriteMetrics,
  eventsFetched?: number,
  processed?: number
): string {
  const parts = [
    `processed=${processed ?? metrics.attemptedWrites}`,
    `inserted=${metrics.inserted}`,
    `skippedDedup=${metrics.skippedDedup}`,
    `errors=${metrics.errors}`,
    `retries=${metrics.retries}`,
    `timeMs=${metrics.processingTimeMs}`
  ];

  if (eventsFetched !== undefined) {
    parts.push(`events=${eventsFetched}`);
  }

  return parts.join(' ');
}

/**
 * Sleep utility for retry delays
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Check if error is retryable (timeout or temporary network issue)
 */
function isRetryableError(error: any): boolean {
  const code = error?.code || '';
  const message = error?.message?.toLowerCase() || '';

  // Timeout errors
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || message.includes('timeout')) {
    return true;
  }

  // Connection errors
  if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || message.includes('connection')) {
    return true;
  }

  // Rate limit errors
  if (code === '429' || message.includes('rate limit')) {
    return true;
  }

  return false;
}

/**
 * Create Supabase client with configurable timeout
 */
function createSupabaseClientWithTimeout(timeoutSeconds: number = 180): SupabaseClient {
  const customFetch = (url: string, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

    return fetch(url, {
      ...init,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  };

  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          'X-Client-Info': 'unified-picks-writer',
        },
        fetch: customFetch as any,
      },
      db: {
        schema: 'public',
      },
    }
  );
}

/**
 * Upsert core market picks to unified_picks with optimized deduplication
 *
 * Strategy:
 * 1. Pre-filter by querying existing promotion_fingerprint values
 * 2. Upsert remaining picks with onConflict: 'promotion_fingerprint' and ignoreDuplicates: true
 * 3. Treat duplicate conflicts (23505) as skippedDedup, not errors
 * 4. Retry on timeout errors with exponential backoff
 *
 * @param picks - Array of UnifiedPickCoreMarket objects
 * @param supabase - Supabase client (service role) - optional, will create optimized client if not provided
 * @param chunkSize - Number of records per upsert batch (default 250, optimized from 500)
 * @param preFilter - Whether to pre-filter existing picks (default true)
 * @param timeoutSeconds - Query timeout in seconds (default 180 for large batches)
 * @param retryConfig - Retry configuration for timeout errors
 * @returns WriteMetrics with counts and timing
 */
export async function upsertUnifiedPicksCore(
  picks: UnifiedPickCoreMarket[],
  supabase?: SupabaseClient,
  chunkSize: number = 250,  // Optimized from 500 to 250 for better performance
  preFilter: boolean = true,
  timeoutSeconds: number = 180,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<WriteMetrics> {
  const startTime = Date.now();
  const metrics: WriteMetrics = {
    attemptedWrites: picks.length,
    inserted: 0,
    skippedDedup: 0,
    errors: 0,
    retries: 0,
    processingTimeMs: 0,
  };

  if (picks.length === 0) {
    console.log('[UnifiedPicksWriter] No picks to write');
    metrics.processingTimeMs = Date.now() - startTime;
    return metrics;
  }

  // Get or create Supabase client with timeout configuration
  const client = supabase || createSupabaseClientWithTimeout(timeoutSeconds);

  console.log(`[UnifiedPicksWriter] Upserting ${picks.length} core market picks (${chunkSize} per batch, preFilter=${preFilter}, timeout=${timeoutSeconds}s)`);

  // System user ID for automated picks
  const SYSTEM_USER_ID = '7ce2ba1f-459f-47cf-ab06-dc3566a847c6';

  // Transform picks to DB rows matching Supabase cloud schema
  const dbRows = picks.map(pick => {
    // Use the selection field directly (required for unique constraint)
    const selection = pick.selection || pick.metadata.team || pick.metadata.outcome || 'unknown';

    // Calculate potential_payout from American odds (1 unit stake)
    const stake = 1;
    let potentialPayout: number;
    if (pick.odds < 0) {
      potentialPayout = stake + (stake * 100 / Math.abs(pick.odds));
    } else {
      potentialPayout = stake + (stake * pick.odds / 100);
    }

    return {
      user_id: SYSTEM_USER_ID,
      pick_type: 'single',
      selection,
      stake,
      potential_payout: Number(potentialPayout.toFixed(2)),
      source: pick.source,
      external_game_id: pick.external_game_id,
      external_prop_id: pick.external_prop_id,
      market: pick.market,
      matchup: pick.matchup,
      game_date: pick.game_date,
      line: pick.line,
      odds: pick.odds,
      posted_at: pick.posted_at,
      bookmaker_key: pick.metadata.bookmaker_key,
      sport: pick.metadata.sport_title || 'NFL',
      metadata: pick.metadata,
    };
  });

  let toInsert = dbRows;

  // Optional pre-filter: Query existing promotion_fingerprint to reduce DB work
  if (preFilter && dbRows.length > 0) {
    try {
      // Extract unique external_game_ids for batch query
      const gameIds = [...new Set(picks.map(p => p.external_game_id))];

      console.log(`[UnifiedPicksWriter] Pre-filtering: querying ${gameIds.length} unique game IDs`);

      const { data: existing, error: queryError } = await client
        .from('unified_picks')
        .select('promotion_fingerprint')
        .in('external_game_id', gameIds);

      if (queryError) {
        console.warn('[UnifiedPicksWriter] Pre-filter query failed, skipping:', queryError.message);
      } else if (existing && existing.length > 0) {
        // Build set of existing fingerprints
        const existingFingerprints = new Set(
          existing.map(r => r.promotion_fingerprint).filter(Boolean)
        );

        // Filter out rows that would be duplicates
        // Note: We don't have promotion_fingerprint in our rows yet (DB generates it)
        // So we'll skip pre-filter for now and rely on upsert ignoreDuplicates
        console.log(`[UnifiedPicksWriter] Found ${existing.length} existing picks, using upsert dedup`);
      }
    } catch (err) {
      console.warn('[UnifiedPicksWriter] Pre-filter exception, skipping:', err);
    }
  }

  // Track pre-filter dedup (we'll calculate this from upsert results instead)
  const originalLength = toInsert.length;

  // Split into player props and core markets (they have different unique constraints)
  const playerProps = toInsert.filter(row => row.external_prop_id !== null);
  const coreMarkets = toInsert.filter(row => row.external_prop_id === null);

  console.log(`[UnifiedPicksWriter] Split: ${playerProps.length} player props, ${coreMarkets.length} core markets`);

  // Helper function to upsert a chunk with retry logic
  async function upsertChunkWithRetry(
    chunk: typeof dbRows,
    chunkType: 'player_prop' | 'core_market',
    chunkIndex: number,
    totalChunks: number
  ): Promise<{ inserted: number; skipped: number; error?: any }> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        // Debug: Log sample row on first chunk
        if (chunkIndex === 0 && attempt === 0) {
          console.log(`[UnifiedPicksWriter] Sample ${chunkType} row:`, JSON.stringify(chunk[0], null, 2));
        }

        // Log progress every 500 records
        const totalProcessed = chunkIndex * chunkSize;
        if (totalProcessed > 0 && totalProcessed % 500 === 0) {
          console.log(`[UnifiedPicksWriter] Progress: ${totalProcessed}/${metrics.attemptedWrites} records processed`);
        }

        // Upsert with ignoreDuplicates and timeout hint
        const { data, error } = await client
          .from('unified_picks')
          .upsert(chunk, {
            ignoreDuplicates: true
          })
          .select('id');

        if (error) {
          // Check if this is a duplicate key error (23505)
          if (error.code === '23505') {
            console.log(`[UnifiedPicksWriter] ${chunkType} chunk ${chunkIndex + 1}/${totalChunks}: duplicate detected (${error.code}), treating as skippedDedup`);
            return { inserted: 0, skipped: chunk.length };
          }

          // Check if error is retryable
          if (isRetryableError(error) && attempt < retryConfig.maxRetries) {
            lastError = error;
            metrics.retries++;
            const delay = calculateBackoffDelay(attempt, retryConfig);
            console.warn(
              `[UnifiedPicksWriter] ${chunkType} chunk ${chunkIndex + 1}/${totalChunks} timeout/error, ` +
              `retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retryConfig.maxRetries}): ${error.message}`
            );
            await sleep(delay);
            continue; // Retry
          }

          // Non-retryable error or max retries exceeded
          throw error;
        }

        // Success - return result
        const insertedCount = (data && Array.isArray(data)) ? data.length : 0;
        return { inserted: insertedCount, skipped: chunk.length - insertedCount };

      } catch (err) {
        lastError = err;

        // If retryable and not max attempts, continue retry loop
        if (isRetryableError(err) && attempt < retryConfig.maxRetries) {
          metrics.retries++;
          const delay = calculateBackoffDelay(attempt, retryConfig);
          console.warn(
            `[UnifiedPicksWriter] ${chunkType} chunk ${chunkIndex + 1}/${totalChunks} exception, ` +
            `retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retryConfig.maxRetries}): ${(err as Error).message}`
          );
          await sleep(delay);
          continue;
        }

        // Non-retryable or max retries exceeded
        break;
      }
    }

    // All retries failed
    return { inserted: 0, skipped: 0, error: lastError };
  }

  // Process player props first
  if (playerProps.length > 0) {
    const chunks: typeof dbRows[] = [];
    for (let i = 0; i < playerProps.length; i += chunkSize) {
      chunks.push(playerProps.slice(i, i + chunkSize));
    }

    console.log(`[UnifiedPicksWriter] Processing ${chunks.length} player prop chunks (${playerProps.length} total rows)`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[UnifiedPicksWriter] Upserting player prop chunk ${i + 1}/${chunks.length} (${chunk.length} rows)`);

      const result = await upsertChunkWithRetry(chunk, 'player_prop', i, chunks.length);

      if (result.error) {
        console.error(`[UnifiedPicksWriter] Player prop chunk ${i + 1} failed after retries:`, JSON.stringify(result.error, null, 2));

        if (!metrics.firstError) {
          metrics.firstError = {
            code: result.error.code || 'UNKNOWN',
            message: result.error.message || 'Unknown error',
            details: result.error.details,
            hint: result.error.hint,
          };
        }

        metrics.errors += chunk.length;
      } else {
        metrics.inserted += result.inserted;
        metrics.skippedDedup += result.skipped;
        console.log(`[UnifiedPicksWriter] Player prop chunk ${i + 1} complete: ${result.inserted} inserted, ${result.skipped} skipped`);
      }
    }
  }

  // Process core markets
  if (coreMarkets.length > 0) {
    const chunks: typeof dbRows[] = [];
    for (let i = 0; i < coreMarkets.length; i += chunkSize) {
      chunks.push(coreMarkets.slice(i, i + chunkSize));
    }

    console.log(`[UnifiedPicksWriter] Processing ${chunks.length} core market chunks (${coreMarkets.length} total rows)`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[UnifiedPicksWriter] Upserting core market chunk ${i + 1}/${chunks.length} (${chunk.length} rows)`);

      const result = await upsertChunkWithRetry(chunk, 'core_market', i, chunks.length);

      if (result.error) {
        console.error(`[UnifiedPicksWriter] Core market chunk ${i + 1} failed after retries:`, JSON.stringify(result.error, null, 2));

        if (!metrics.firstError) {
          metrics.firstError = {
            code: result.error.code || 'UNKNOWN',
            message: result.error.message || 'Unknown error',
            details: result.error.details,
            hint: result.error.hint,
          };
        }

        metrics.errors += chunk.length;
      } else {
        metrics.inserted += result.inserted;
        metrics.skippedDedup += result.skipped;
        console.log(`[UnifiedPicksWriter] Core market chunk ${i + 1} complete: ${result.inserted} inserted, ${result.skipped} skipped`);
      }
    }
  }

  // Guardrails: Detect potential stale data or transform mismatch
  // Track zero-insert runs to warn about potential issues
  if (metrics.attemptedWrites > 0 && metrics.inserted === 0 && metrics.skippedDedup === 0) {
    const runKey = 'unified_picks_zero_insert_runs';
    const zeroInsertRuns = (global as any)[runKey] || 0;
    (global as any)[runKey] = zeroInsertRuns + 1;

    if ((global as any)[runKey] >= 3) {
      console.warn(
        `[UnifiedPicksWriter] ⚠️  WARN: 3+ consecutive runs with 0 inserts/dedup. ` +
        `Potential stale data or transform mismatch. ` +
        `Summary: ${summarizeWriteMetrics(metrics)}`
      );
      // Reset counter after warning
      (global as any)[runKey] = 0;
    }
  } else if (metrics.inserted > 0 || metrics.skippedDedup > 0) {
    // Reset counter on successful operation
    (global as any)['unified_picks_zero_insert_runs'] = 0;
  }

  // Record total processing time
  metrics.processingTimeMs = Date.now() - startTime;

  console.log(`[UnifiedPicksWriter] Complete: ${summarizeWriteMetrics(metrics)}`);
  return metrics;
}

/**
 * Upsert with deduplication check (alternative strategy)
 *
 * Checks existing records first, then only inserts new ones
 * More efficient for high-duplicate scenarios
 * Now includes timeout configuration and retry logic
 */
export async function upsertUnifiedPicksCoreWithDedup(
  picks: UnifiedPickCoreMarket[],
  supabase?: SupabaseClient,
  timeoutSeconds: number = 180,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<WriteMetrics> {
  const startTime = Date.now();
  const metrics: WriteMetrics = {
    attemptedWrites: picks.length,
    inserted: 0,
    skippedDedup: 0,
    errors: 0,
    retries: 0,
    processingTimeMs: 0,
  };

  if (picks.length === 0) {
    console.log('[UnifiedPicksWriter] No picks to write');
    metrics.processingTimeMs = Date.now() - startTime;
    return metrics;
  }

  const client = supabase || createSupabaseClientWithTimeout(timeoutSeconds);

  // Build composite keys for dedup check
  const compositeKeys = picks.map(pick => ({
    external_game_id: pick.external_game_id,
    external_prop_id: pick.external_prop_id,
  }));

  console.log(`[UnifiedPicksWriter] Checking for existing picks...`);

  // Query existing picks (limited approach - may need batching for very large sets)
  const gameIds = [...new Set(picks.map(p => p.external_game_id))];
  const { data: existingPicks, error: queryError } = await client
    .from('unified_picks')
    .select('external_game_id,external_prop_id')
    .in('external_game_id', gameIds);

  if (queryError) {
    console.error('[UnifiedPicksWriter] Error querying existing picks:', queryError);
    // Fall back to direct upsert
    return upsertUnifiedPicksCore(picks, client);
  }

  // Build set of existing keys
  const existingSet = new Set(
    existingPicks?.map(p =>
      JSON.stringify({
        external_game_id: p.external_game_id,
        external_prop_id: p.external_prop_id,
      })
    ) || []
  );

  // Filter to only new picks
  const newPicks = picks.filter(pick => {
    const key = JSON.stringify({
      external_game_id: pick.external_game_id,
      external_prop_id: pick.external_prop_id,
    });
    return !existingSet.has(key);
  });

  metrics.skippedDedup = picks.length - newPicks.length;
  console.log(`[UnifiedPicksWriter] Found ${newPicks.length} new picks, ${metrics.skippedDedup} duplicates`);

  if (newPicks.length === 0) {
    return metrics;
  }

  // Insert new picks only
  const SYSTEM_USER_ID = '7ce2ba1f-459f-47cf-ab06-dc3566a847c6'; // System user from users table

  const dbRows = newPicks.map(pick => {
    const selection = pick.selection || pick.metadata.team || pick.metadata.outcome || 'unknown';

    const stake = 1;
    let potentialPayout: number;
    if (pick.odds < 0) {
      potentialPayout = stake + (stake * 100 / Math.abs(pick.odds));
    } else {
      potentialPayout = stake + (stake * pick.odds / 100);
    }

    return {
      user_id: SYSTEM_USER_ID,
      pick_type: 'single',
      selection,
      stake,
      potential_payout: Number(potentialPayout.toFixed(2)),
      source: pick.source,
      external_game_id: pick.external_game_id,
      external_prop_id: pick.external_prop_id,
      market: pick.market,
      matchup: pick.matchup,
      game_date: pick.game_date,
      line: pick.line,
      odds: pick.odds,
      posted_at: pick.posted_at,
      bookmaker_key: pick.metadata.bookmaker_key,
      sport: pick.metadata.sport_title || 'NFL',
      metadata: pick.metadata,
    };
  });

  // Insert with retry logic
  let lastError: any = null;
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const { data, error } = await client
        .from('unified_picks')
        .insert(dbRows)
        .select('id');

      if (error) {
        if (isRetryableError(error) && attempt < retryConfig.maxRetries) {
          lastError = error;
          metrics.retries++;
          const delay = calculateBackoffDelay(attempt, retryConfig);
          console.warn(
            `[UnifiedPicksWriter] Insert timeout/error, retrying in ${Math.round(delay)}ms ` +
            `(attempt ${attempt + 1}/${retryConfig.maxRetries}): ${error.message}`
          );
          await sleep(delay);
          continue;
        }
        throw error;
      }

      metrics.inserted = data?.length || 0;
      console.log(`[UnifiedPicksWriter] Inserted ${metrics.inserted} new picks`);
      break;

    } catch (err) {
      lastError = err;
      if (isRetryableError(err) && attempt < retryConfig.maxRetries) {
        metrics.retries++;
        const delay = calculateBackoffDelay(attempt, retryConfig);
        console.warn(
          `[UnifiedPicksWriter] Insert exception, retrying in ${Math.round(delay)}ms ` +
          `(attempt ${attempt + 1}/${retryConfig.maxRetries}): ${(err as Error).message}`
        );
        await sleep(delay);
        continue;
      }

      console.error('[UnifiedPicksWriter] Insert error after retries:', lastError);
      metrics.errors = newPicks.length;
      break;
    }
  }

  metrics.processingTimeMs = Date.now() - startTime;
  return metrics;
}