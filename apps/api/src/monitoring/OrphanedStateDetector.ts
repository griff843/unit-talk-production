/**
 * OrphanedStateDetector
 * SPRINT-OPERATIONAL-OBSERVABILITY (FM-5)
 *
 * Detects picks stuck in lifecycle states without progressing:
 *   FM-5a: approved (promoted) but not posted to Discord for > 24 hours
 *   FM-5b: posted to Discord but not settled > 48 hours after game date
 *
 * Called from health checks for advisory reporting.
 * Does NOT mutate any state — read-only diagnostic only.
 */

import { createLogger } from '../utils/logger';

import type { SupabaseClient } from '@supabase/supabase-js';

const logger = createLogger('OrphanedStateDetector');

export interface OrphanedPickSummary {
  /** FM-5a: approved/promoted but not posted to Discord for > 24h */
  stuckInApproved: number;
  /** FM-5b: posted to Discord but not settled > 48h after game date */
  stuckInPosted: number;
  /** Sample IDs of stuck-approved picks (up to 5) */
  sampleStuckApprovedIds: string[];
  /** Sample IDs of stuck-posted picks (up to 5) */
  sampleStuckPostedIds: string[];
}

/**
 * Detect picks orphaned in lifecycle states.
 * Safe to call frequently — read-only, lightweight queries.
 */
export async function detectOrphanedPicks(supabase: SupabaseClient): Promise<OrphanedPickSummary> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const [approvedResult, postedResult] = await Promise.all([
    // FM-5a: approved but not posted for > 24h
    supabase
      .from('unified_picks')
      .select('id', { count: 'exact' })
      .eq('workflow_stage', 'approved')
      .eq('posted_to_discord', false)
      .lt('updated_at', twentyFourHoursAgo)
      .limit(5),

    // FM-5b: posted but game date + 48h passed, still not settled
    supabase
      .from('unified_picks')
      .select('id', { count: 'exact' })
      .eq('posted_to_discord', true)
      .is('settlement_status', null)
      .lt('game_date', fortyEightHoursAgo)
      .limit(5),
  ]);

  const stuckInApproved = approvedResult.count ?? 0;
  const stuckInPosted = postedResult.count ?? 0;
  const sampleStuckApprovedIds = (approvedResult.data ?? []).map(r => r.id as string);
  const sampleStuckPostedIds = (postedResult.data ?? []).map(r => r.id as string);

  if (stuckInApproved > 0 || stuckInPosted > 0) {
    logger.warn('Orphaned picks detected (FM-5)', {
      stuckInApproved,
      stuckInPosted,
      sampleStuckApprovedIds,
      sampleStuckPostedIds,
    });
  }

  return { stuckInApproved, stuckInPosted, sampleStuckApprovedIds, sampleStuckPostedIds };
}
