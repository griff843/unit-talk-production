/**
 * Unified Picks Writer - Supabase Cloud Edition (Production-Grade)
 *
 * Writes picks to unified_picks table with dedup tracking, diagnostics,
 * timeout configuration, and retry logic.
 *
 * Features:
 * - Configurable Supabase timeouts (default 180s for large batches)
 * - Optimized batch size (reduced from 500 to 250 for better performance)
 * - Exponential backoff retry logic for timeout errors
 * - Progress logging every N records
 * - Connection pooling via shared client
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type UnifiedPickInput = {
  game_id?: string | null;
  sport: string;                  // 'mlb'
  market: 'h2h' | 'spreads' | 'totals' | 'player_props';
  selection: string;
  odds: number;
  line?: number | null;
  bookmaker_key: string;
  game_date: string;              // ISO timestamptz
  source?: 'odds-api';
  posted_at?: string;
  user_id?: string | null;        // Cloud requires NOT NULL
  pick_type?: string;             // Cloud requires NOT NULL
  stake?: number;                 // Cloud requires NOT NULL
  potential_payout?: number;      // Cloud requires NOT NULL
};

export type WriteResult = {
  attemptedWrites: number;
  inserted: number;
  skippedDedup: number;
  errors: number;
  retries: number;
  processingTimeMs: number;
  sampleFile?: string;
  reasons?: string[];
};

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

const OUT_DIR = process.env.OPS_OUT_DIR || path.join(process.cwd(), 'apps/api/out/ops');

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function uniqKey(p: UnifiedPickInput) {
  // Must mirror the DB unique index:
  // (source, market, selection, bookmaker_key, game_date, coalesce(line,-9999), coalesce(game_id, '0000...'))
  const source = p.source ?? 'odds-api';
  const lineVal = p.line ?? -9999;
  const gid = p.game_id ?? '00000000-0000-0000-0000-000000000000';
  return [source, p.market, p.selection, p.bookmaker_key, p.game_date, lineVal, gid].join('|');
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
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  const code = error?.code || '';
  const message = error?.message?.toLowerCase() || '';

  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || message.includes('timeout')) {
    return true;
  }

  if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || message.includes('connection')) {
    return true;
  }

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
          'X-Client-Info': 'unified-picks-writer-cloud',
        },
        fetch: customFetch as any,
      },
      db: {
        schema: 'public',
      },
    }
  );
}

export async function writeUnifiedPicks(
  rows: UnifiedPickInput[],
  runId: string,
  timeoutSeconds: number = 180,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<WriteResult> {
  const startTime = Date.now();
  ensureDir(OUT_DIR);
  const res: WriteResult = {
    attemptedWrites: rows.length,
    inserted: 0,
    skippedDedup: 0,
    errors: 0,
    retries: 0,
    processingTimeMs: 0,
    reasons: [],
  };

  if (!rows.length) {
    res.processingTimeMs = Date.now() - startTime;
    return res;
  }

  // Normalize defaults (Cloud schema has additional NOT NULL constraints)
  const SYS_UID = process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000001';
  const normalized = rows.map(r => ({
    ...r,
    source: r.source ?? 'odds-api',
    posted_at: r.posted_at ?? new Date().toISOString(),
    line: r.line ?? null,
    user_id: r.user_id ?? SYS_UID,  // Use system user for automated picks
    pick_type: r.pick_type ?? 'single',
    stake: r.stake ?? 1,
    potential_payout: r.potential_payout ?? (r.stake ?? 1) * (r.odds > 0 ? (1 + r.odds / 100) : (1 - 100 / r.odds)),
  }));

  // Create Supabase client with timeout
  const supabase = createSupabaseClientWithTimeout(timeoutSeconds);

  // Optimized batch size (reduced from 500 to 250 for better performance)
  const BATCH = Number(process.env.ODDS_FEED_BATCH || 250);
  const totalChunks = Math.ceil(normalized.length / BATCH);

  console.log(`[writeUnifiedPicks] Writing ${normalized.length} picks in ${totalChunks} batches (size=${BATCH}, timeout=${timeoutSeconds}s)`);

  for (let i = 0; i < normalized.length; i += BATCH) {
    const chunk = normalized.slice(i, i + BATCH);
    const chunkIndex = Math.floor(i / BATCH);

    // Log progress every 500 records
    if (i > 0 && i % 500 === 0) {
      console.log(`[writeUnifiedPicks] Progress: ${i}/${normalized.length} records processed`);
    }

    console.log(`[writeUnifiedPicks] Processing batch ${chunkIndex + 1}/${totalChunks} (${chunk.length} rows)`);

    // Retry logic for this chunk
    let lastError: any = null;
    let success = false;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const { data, error, status } = await supabase
          .from('unified_picks')
          .upsert(chunk, { ignoreDuplicates: true })
          .select('id');

        if (error) {
          if (isRetryableError(error) && attempt < retryConfig.maxRetries) {
            lastError = error;
            res.retries++;
            const delay = calculateBackoffDelay(attempt, retryConfig);
            console.warn(
              `[writeUnifiedPicks] Batch ${chunkIndex + 1}/${totalChunks} timeout/error, ` +
              `retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retryConfig.maxRetries}): ${error.message}`
            );
            await sleep(delay);
            continue;
          }
          throw error;
        }

        // Success
        const insertedCount = Array.isArray(data) ? data.length : 0;
        res.inserted += insertedCount;
        res.skippedDedup += (chunk.length - insertedCount);
        console.log(`[writeUnifiedPicks] Batch ${chunkIndex + 1} complete: ${insertedCount} inserted, ${chunk.length - insertedCount} skipped`);
        success = true;
        break;

      } catch (err) {
        lastError = err;

        if (isRetryableError(err) && attempt < retryConfig.maxRetries) {
          res.retries++;
          const delay = calculateBackoffDelay(attempt, retryConfig);
          console.warn(
            `[writeUnifiedPicks] Batch ${chunkIndex + 1}/${totalChunks} exception, ` +
            `retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retryConfig.maxRetries}): ${(err as Error).message}`
          );
          await sleep(delay);
          continue;
        }
        break;
      }
    }

    // Handle failure after all retries
    if (!success) {
      res.errors += chunk.length;
      res.reasons?.push(`upsert_error_batch_${chunkIndex + 1}:${lastError?.message || 'Unknown error'}`);

      // Dump one sample payload for debugging
      if (!res.sampleFile) {
        const fp = path.join(OUT_DIR, `feedagent-sample-payload-${runId}.json`);
        fs.writeFileSync(fp, JSON.stringify({ chunk, error: lastError?.message }, null, 2));
        res.sampleFile = fp;
      }
    }
  }

  res.processingTimeMs = Date.now() - startTime;
  console.log(
    `[writeUnifiedPicks] Complete: ${res.inserted} inserted, ${res.skippedDedup} skipped, ` +
    `${res.errors} errors, ${res.retries} retries, ${res.processingTimeMs}ms`
  );

  return res;
}
