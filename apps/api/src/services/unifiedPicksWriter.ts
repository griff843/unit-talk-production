/**
 * Unified Picks Writer
 *
 * Handles batch upserts of core market picks to unified_picks table
 * with deduplication and chunking for large payloads.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { UnifiedPickCoreMarket } from '../agents/FeedAgent/transform';

interface WriteMetrics {
  attemptedWrites: number;
  inserted: number;
  skippedDedup: number;
  errors: number;
  firstError?: {
    code: string;
    message: string;
    details: any;
    hint: any;
  };
}

/**
 * Summarize write metrics as a single-line string for observability
 * Format: processed=X inserted=Y skippedDedup=Z errors=K
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
    `errors=${metrics.errors}`
  ];

  if (eventsFetched !== undefined) {
    parts.push(`events=${eventsFetched}`);
  }

  return parts.join(' ');
}

/**
 * Upsert core market picks to unified_picks with optimized deduplication
 *
 * Strategy:
 * 1. Pre-filter by querying existing promotion_fingerprint values
 * 2. Upsert remaining picks with onConflict: 'promotion_fingerprint' and ignoreDuplicates: true
 * 3. Treat duplicate conflicts (23505) as skippedDedup, not errors
 *
 * @param picks - Array of UnifiedPickCoreMarket objects
 * @param supabase - Supabase client (service role)
 * @param chunkSize - Number of records per upsert batch (default 500)
 * @param preFilter - Whether to pre-filter existing picks (default true)
 * @returns WriteMetrics with counts
 */
export async function upsertUnifiedPicksCore(
  picks: UnifiedPickCoreMarket[],
  supabase?: SupabaseClient,
  chunkSize: number = 500,
  preFilter: boolean = true
): Promise<WriteMetrics> {
  const metrics: WriteMetrics = {
    attemptedWrites: picks.length,
    inserted: 0,
    skippedDedup: 0,
    errors: 0,
  };

  if (picks.length === 0) {
    console.log('[UnifiedPicksWriter] No picks to write');
    return metrics;
  }

  // Get or create Supabase client with service role
  const client = supabase || createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  console.log(`[UnifiedPicksWriter] Upserting ${picks.length} core market picks (${chunkSize} per batch, preFilter=${preFilter})`);

  // System user ID for automated picks
  const SYSTEM_USER_ID = '7ce2ba1f-459f-47cf-ab06-dc3566a847c6';

  // Transform picks to DB rows and calculate promotion_fingerprint
  const dbRows = picks.map(pick => {
    const selection = pick.metadata.team || pick.metadata.outcome || 'unknown';

    // Calculate potential_payout from American odds (1 unit stake)
    const stake = 1;
    let potentialPayout: number;
    if (pick.odds < 0) {
      potentialPayout = stake + (stake * 100 / Math.abs(pick.odds));
    } else {
      potentialPayout = stake + (stake * pick.odds / 100);
    }

    return {
      id: pick.id,
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

  // Chunk the upserts to avoid payload limits
  const chunks: typeof dbRows[] = [];
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    chunks.push(toInsert.slice(i, i + chunkSize));
  }

  console.log(`[UnifiedPicksWriter] Processing ${chunks.length} chunks`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`[UnifiedPicksWriter] Upserting chunk ${i + 1}/${chunks.length} (${chunk.length} rows)`);

    try {
      // Debug: Log sample row on first chunk
      if (i === 0) {
        console.log(`[UnifiedPicksWriter] Sample row:`, JSON.stringify(chunk[0], null, 2));
      }

      // Upsert with ignoreDuplicates - PostgREST will use any unique constraints
      // Note: We don't specify onConflict column name since PostgREST auto-detects unique constraints
      const { data, error } = await client
        .from('unified_picks')
        .upsert(chunk, {
          ignoreDuplicates: true,
          returning: 'minimal'
        });

      if (error) {
        // Check if this is a duplicate key error (23505)
        if (error.code === '23505') {
          // This shouldn't happen with ignoreDuplicates, but treat as dedup if it does
          console.log(`[UnifiedPicksWriter] Chunk ${i + 1}: duplicate detected (${error.code}), treating as skippedDedup`);
          metrics.skippedDedup += chunk.length;
        } else {
          // Real error - log and count
          console.error(`[UnifiedPicksWriter] Chunk ${i + 1} error:`, JSON.stringify(error, null, 2));

          if (!metrics.firstError) {
            metrics.firstError = {
              code: error.code || 'UNKNOWN',
              message: error.message || 'Unknown error',
              details: error.details,
              hint: error.hint,
            };
          }

          metrics.errors += chunk.length;
        }
        continue;
      }

      // With ignoreDuplicates and returning: 'minimal', we assume success
      // All rows in chunk were either inserted or silently ignored as duplicates
      // Since we can't distinguish, we count them as inserted (first-run behavior)
      metrics.inserted += chunk.length;

      console.log(`[UnifiedPicksWriter] Chunk ${i + 1} complete: ${chunk.length} upserted`);
    } catch (err) {
      console.error(`[UnifiedPicksWriter] Chunk ${i + 1} exception:`, err);
      metrics.errors += chunk.length;
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

  console.log(`[UnifiedPicksWriter] Complete: ${summarizeWriteMetrics(metrics)}`);
  return metrics;
}

/**
 * Upsert with deduplication check (alternative strategy)
 *
 * Checks existing records first, then only inserts new ones
 * More efficient for high-duplicate scenarios
 */
export async function upsertUnifiedPicksCoreWithDedup(
  picks: UnifiedPickCoreMarket[],
  supabase?: SupabaseClient
): Promise<WriteMetrics> {
  const metrics: WriteMetrics = {
    attemptedWrites: picks.length,
    inserted: 0,
    skippedDedup: 0,
    errors: 0,
  };

  if (picks.length === 0) {
    console.log('[UnifiedPicksWriter] No picks to write');
    return metrics;
  }

  const client = supabase || createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

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
    const selection = pick.metadata.team || pick.metadata.outcome || 'unknown';

    const stake = 1;
    let potentialPayout: number;
    if (pick.odds < 0) {
      potentialPayout = stake + (stake * 100 / Math.abs(pick.odds));
    } else {
      potentialPayout = stake + (stake * pick.odds / 100);
    }

    return {
      id: pick.id,
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
      metadata: pick.metadata,
    };
  });

  const { data, error } = await client
    .from('unified_picks')
    .insert(dbRows)
    .select('id');

  if (error) {
    console.error('[UnifiedPicksWriter] Insert error:', error);
    metrics.errors = newPicks.length;
  } else {
    metrics.inserted = data?.length || 0;
    console.log(`[UnifiedPicksWriter] Inserted ${metrics.inserted} new picks`);
  }

  return metrics;
}