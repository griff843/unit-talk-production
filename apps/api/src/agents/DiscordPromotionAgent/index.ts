/**
 * DiscordPromotionAgent - Canonical Pick Publishing Pipeline
 *
 * GAP-001 FIX: This agent now consumes ONLY from pick_publish outbox table.
 * The pick_publish table is the ONE canonical publish pipeline.
 *
 * Flow:
 * 1. Atomic claim: status='pending' → 'processing' with worker_id
 * 2. Join unified_picks via pick_id for pick data
 * 3. Post to Discord via AutopilotGuard
 * 4. Update pick_publish with result (sent/failed)
 * 5. Optionally set unified_picks.posted_to_discord as side-effect
 *
 * @author Unit Talk Platform
 * @date 2026-01-20
 */

import 'dotenv/config';
import axios from 'axios';
import FormData from 'form-data';
import { randomUUID } from 'crypto';

import { logger } from '../../services/logging';
import { supabase } from '../../services/supabaseClient';
import { autopilotGuard } from '../../lib/AutopilotGuard';

// ============================================================================
// Configuration
// ============================================================================

const DISCORD_WEBHOOK_URL = process.env['DISCORD_WEBHOOK_URL'] || '';
const WORKER_ID = `worker_${randomUUID().substring(0, 8)}`;
const BATCH_SIZE = parseInt(process.env['PUBLISH_BATCH_SIZE'] || '10', 10);
const PROCESSING_TIMEOUT_MS = 60000; // 1 minute

// ============================================================================
// Types
// ============================================================================

interface PickPublishRow {
  id: string;
  pick_id: string;
  tenant_id: string;
  channel: string;
  status: string;
  discord_channel_id: string;
  attempts: number;
  max_attempts: number;
  dedupe_key: string;
  metadata: Record<string, any>;
  created_at: string;
  processing_started_at?: string;
  worker_id?: string;
  sent_at?: string;
  external_message_id?: string;
  error?: string;
}

interface UnifiedPick {
  id: string;
  bet_slip_id: string;
  user_id: string;
  sport: string;
  stat_type: string;
  line: number;
  odds: number;
  selection: string;
  confidence: number;
  form_source: string;
  tier?: string;
  player_name?: string;
  team_name?: string;
  matchup?: string;
  unit_size?: number;
  stake?: number;
  edge_score?: number;
  ev_percent?: number;
  legs?: any[];
  direction?: string;
  trace_id?: string;
}

interface OutboxHealthMetrics {
  pending_count: number;
  processing_count: number;
  failed_count: number;
  sent_today_count: number;
  oldest_pending_age_seconds: number | null;
}

// ============================================================================
// Formatting Utilities (unchanged from original)
// ============================================================================

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : String(odds);
}

function formatUnit(size: any): string {
  return size ? `${size}U` : '1U';
}

function formatEV(ev: any): string {
  return ev !== undefined && ev !== null ? `${ev}% EV` : 'N/A';
}

// ============================================================================
// Image Generation (placeholder - canvas not available)
// ============================================================================

async function generateEliteCard(_: any): Promise<Buffer> {
  // Canvas module not available - returning empty buffer as fallback
  // TODO: Implement image generation when canvas module is available
  return Buffer.from('');
}

// ============================================================================
// Embed Builder (unchanged from original)
// ============================================================================

function buildEliteEmbed(pick: UnifiedPick) {
  if (Array.isArray(pick.legs) && pick.legs.length > 1) {
    return {
      title: `🔥 PARLAY/TEASER ALERT • ${pick.legs.length} Legs`,
      color: 0xFF5252,
      image: { url: 'attachment://pick.png' },
      description: `**Tier:** ${pick.tier || 'N/A'} • **Odds:** ${formatOdds(pick.odds)} • **Units:** ${formatUnit(pick.unit_size || pick.stake)} • **Edge Score:** ${pick.edge_score ?? 'N/A'}\n**Payout:** TBD\n\n#parlay #unitTalk`,
      footer: { text: 'Best Bets by Unit Talk | Not Financial Advice' }
    };
  }
  // Single pick
  return {
    title: '🔥 LOCK OF THE DAY 🔥',
    color: pick.tier === 'S' ? 0x4fc3f7 : pick.tier === 'A' ? 0x66bb6a : 0xfbc02d,
    image: { url: 'attachment://pick.png' },
    description: `**${pick.player_name || 'Player'}**\n${pick.stat_type} ${pick.direction?.toUpperCase() || ''} ${pick.line}\n\n**Odds:** ${formatOdds(pick.odds)} • **Units:** ${formatUnit(pick.unit_size || pick.stake)}\n**Edge Score:** ${pick.edge_score ?? 'N/A'} • **EV:** ${formatEV(pick.ev_percent)}\n${pick.matchup ? `**Matchup:** ${pick.matchup}` : ''}`,
    footer: { text: '#sportsbetting #unitTalk | Not Financial Advice' }
  };
}

// ============================================================================
// Outbox Health Metrics
// ============================================================================

async function getOutboxHealthMetrics(): Promise<OutboxHealthMetrics> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Get counts by status
  const { data: pendingData } = await supabase
    .from('pick_publish')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { data: processingData } = await supabase
    .from('pick_publish')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'processing');

  const { data: failedData } = await supabase
    .from('pick_publish')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed');

  const { data: sentTodayData } = await supabase
    .from('pick_publish')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', todayStart);

  // Get oldest pending record
  const { data: oldestPending } = await supabase
    .from('pick_publish')
    .select('created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  let oldest_pending_age_seconds: number | null = null;
  if (oldestPending?.created_at) {
    oldest_pending_age_seconds = Math.floor(
      (now.getTime() - new Date(oldestPending.created_at).getTime()) / 1000
    );
  }

  return {
    pending_count: (pendingData as any)?.length || 0,
    processing_count: (processingData as any)?.length || 0,
    failed_count: (failedData as any)?.length || 0,
    sent_today_count: (sentTodayData as any)?.length || 0,
    oldest_pending_age_seconds,
  };
}

// ============================================================================
// Atomic Claim - Core of GAP-001 Fix
// ============================================================================

/**
 * Atomically claim pending pick_publish records for processing.
 * Uses UPDATE...WHERE to ensure only one worker claims each record.
 *
 * @returns Array of claimed pick_publish records with joined unified_picks data
 */
async function claimPendingRecords(): Promise<Array<PickPublishRow & { unified_picks: UnifiedPick }>> {
  const processingStartedAt = new Date().toISOString();

  // Step 1: Atomically claim records by updating status from 'pending' to 'processing'
  // This uses a subquery pattern to ensure atomic claim
  const { data: claimedIds, error: claimError } = await supabase
    .from('pick_publish')
    .update({
      status: 'processing',
      worker_id: WORKER_ID,
      processing_started_at: processingStartedAt,
    })
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
    .select('id');

  if (claimError) {
    logger.error({ error: claimError.message, worker_id: WORKER_ID }, 'Failed to claim pick_publish records');
    return [];
  }

  if (!claimedIds || claimedIds.length === 0) {
    logger.debug({ worker_id: WORKER_ID }, 'No pending pick_publish records to claim');
    return [];
  }

  const claimedIdList = claimedIds.map((r: any) => r.id);

  logger.info({
    worker_id: WORKER_ID,
    claimed_count: claimedIdList.length,
    claimed_ids: claimedIdList,
  }, 'Claimed pick_publish records for processing');

  // Step 2: Fetch full records with joined unified_picks data
  const { data: fullRecords, error: fetchError } = await supabase
    .from('pick_publish')
    .select(`
      *,
      unified_picks!pick_publish_pick_id_fkey (
        id,
        bet_slip_id,
        user_id,
        sport,
        stat_type,
        line,
        odds,
        selection,
        confidence,
        form_source,
        tier,
        player_name,
        team_name,
        matchup,
        unit_size,
        stake,
        edge_score,
        ev_percent,
        legs,
        direction,
        trace_id
      )
    `)
    .in('id', claimedIdList);

  if (fetchError) {
    logger.error({ error: fetchError.message, ids: claimedIdList }, 'Failed to fetch claimed records with unified_picks');

    // Rollback: reset status to pending
    await supabase
      .from('pick_publish')
      .update({ status: 'pending', worker_id: null, processing_started_at: null })
      .in('id', claimedIdList);

    return [];
  }

  return (fullRecords || []) as Array<PickPublishRow & { unified_picks: UnifiedPick }>;
}

// ============================================================================
// Discord Posting with AutopilotGuard
// ============================================================================

interface PostResult {
  success: boolean;
  external_message_id?: string;
  error?: string;
  blocked_by_guard?: boolean;
}

/**
 * Post a pick to Discord via webhook.
 * All posts go through AutopilotGuard for environment gating.
 */
async function postPickToDiscord(
  publishRecord: PickPublishRow,
  pick: UnifiedPick
): Promise<PostResult> {
  // Extract trace_id for logging if present
  const traceId = pick.trace_id || publishRecord.metadata?.trace_id;

  if (!DISCORD_WEBHOOK_URL) {
    logger.error({ trace_id: traceId }, 'No Discord webhook URL configured');
    return { success: false, error: 'No Discord webhook URL configured' };
  }

  // Phase 6.5: AutopilotGuard is the SOLE authority for side effects
  const guardResult = await autopilotGuard.assertMayPerformSideEffect({
    action: 'DISCORD_POST',
    agent_name: 'DiscordPromotionAgent',
    pick_id: pick.id,
    correlation_id: traceId,
    metadata: {
      tier: pick.tier,
      player: pick.player_name,
      form_source: pick.form_source,
      channel: publishRecord.channel,
      discord_channel_id: publishRecord.discord_channel_id,
    }
  });

  if (!guardResult.allowed) {
    logger.info({
      pick_id: pick.id,
      publish_id: publishRecord.id,
      reason: guardResult.reason,
      mode: guardResult.mode,
      trace_id: traceId,
    }, 'Discord post blocked by AutopilotGuard');

    return { success: false, blocked_by_guard: true, error: guardResult.reason };
  }

  // Build embed and post
  const imageBuffer = await generateEliteCard(pick);
  const form = new FormData();
  form.append('file', imageBuffer, { filename: 'pick.png', contentType: 'image/png' });

  const embed = buildEliteEmbed(pick);
  form.append('payload_json', JSON.stringify({
    username: 'Unit Talk Picks',
    embeds: [embed],
  }));

  try {
    const response = await axios.post(DISCORD_WEBHOOK_URL, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Discord webhooks return 204 No Content on success, or 200 with message data
    // The message ID is in response.data.id if available
    const externalMessageId = response.data?.id || `webhook_${Date.now()}`;

    logger.info({
      pick_id: pick.id,
      publish_id: publishRecord.id,
      external_message_id: externalMessageId,
      trace_id: traceId,
      channel: publishRecord.discord_channel_id,
    }, 'Successfully posted pick to Discord');

    return { success: true, external_message_id: externalMessageId };

  } catch (err: any) {
    const errorMessage = err?.response?.data?.message || err?.message || 'Unknown Discord error';
    logger.error({
      pick_id: pick.id,
      publish_id: publishRecord.id,
      error: errorMessage,
      trace_id: traceId,
    }, 'Discord post failed');

    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Record Update - Success/Failure Handling
// ============================================================================

/**
 * Update pick_publish record after successful Discord post.
 */
async function markRecordSent(
  publishRecord: PickPublishRow,
  externalMessageId: string
): Promise<void> {
  const sentAt = new Date().toISOString();

  const { error } = await supabase
    .from('pick_publish')
    .update({
      status: 'sent',
      sent_at: sentAt,
      external_message_id: externalMessageId,
      attempts: publishRecord.attempts + 1,
      error: null, // Clear any previous error
    })
    .eq('id', publishRecord.id);

  if (error) {
    logger.error({
      publish_id: publishRecord.id,
      error: error.message,
    }, 'Failed to mark pick_publish as sent');
  }

  // Side effect: Update unified_picks.posted_to_discord (optional, for backward compat)
  // This does NOT drive selection - pick_publish is the source of truth
  await supabase
    .from('unified_picks')
    .update({ posted_to_discord: true })
    .eq('id', publishRecord.pick_id);
}

/**
 * Update pick_publish record after failed Discord post.
 */
async function markRecordFailed(
  publishRecord: PickPublishRow,
  errorMessage: string,
  blockedByGuard: boolean = false
): Promise<void> {
  const newAttempts = publishRecord.attempts + 1;
  const maxAttempts = publishRecord.max_attempts || 3;

  // If blocked by AutopilotGuard, don't count as failure - leave as pending
  // It will be retried when guard mode changes
  if (blockedByGuard) {
    const { error } = await supabase
      .from('pick_publish')
      .update({
        status: 'pending',
        worker_id: null,
        processing_started_at: null,
        // Don't increment attempts for guard blocks
        error: `AutopilotGuard blocked: ${errorMessage}`,
      })
      .eq('id', publishRecord.id);

    if (error) {
      logger.error({
        publish_id: publishRecord.id,
        error: error.message,
      }, 'Failed to reset pick_publish after guard block');
    }
    return;
  }

  // Determine new status based on attempts
  const newStatus = newAttempts >= maxAttempts ? 'failed' : 'pending';

  const { error } = await supabase
    .from('pick_publish')
    .update({
      status: newStatus,
      attempts: newAttempts,
      error: errorMessage,
      worker_id: newStatus === 'pending' ? null : publishRecord.worker_id,
      processing_started_at: newStatus === 'pending' ? null : publishRecord.processing_started_at,
    })
    .eq('id', publishRecord.id);

  if (error) {
    logger.error({
      publish_id: publishRecord.id,
      error: error.message,
    }, 'Failed to update pick_publish failure status');
  }

  if (newStatus === 'failed') {
    logger.warn({
      publish_id: publishRecord.id,
      pick_id: publishRecord.pick_id,
      attempts: newAttempts,
      max_attempts: maxAttempts,
    }, 'pick_publish record permanently failed after max attempts');
  }
}

// ============================================================================
// Stale Processing Recovery
// ============================================================================

/**
 * Reset stale 'processing' records that have timed out.
 * This handles cases where a worker crashed mid-processing.
 */
async function resetStaleProcessingRecords(): Promise<number> {
  const cutoffTime = new Date(Date.now() - PROCESSING_TIMEOUT_MS).toISOString();

  const { data, error } = await supabase
    .from('pick_publish')
    .update({
      status: 'pending',
      worker_id: null,
      processing_started_at: null,
      error: 'Reset: processing timeout',
    })
    .eq('status', 'processing')
    .lt('processing_started_at', cutoffTime)
    .select('id');

  if (error) {
    logger.error({ error: error.message }, 'Failed to reset stale processing records');
    return 0;
  }

  const resetCount = data?.length || 0;
  if (resetCount > 0) {
    logger.info({
      reset_count: resetCount,
      cutoff_time: cutoffTime,
    }, 'Reset stale processing records');
  }

  return resetCount;
}

// ============================================================================
// Main Processing Function - GAP-001 Core Fix
// ============================================================================

/**
 * Main entry point: Process pick_publish outbox.
 *
 * This replaces the old unified_picks.posted_to_discord selector logic.
 * pick_publish is now the ONE canonical publish pipeline.
 */
export async function promoteToDiscord(): Promise<void> {
  const runId = randomUUID().substring(0, 8);

  logger.info({
    worker_id: WORKER_ID,
    run_id: runId,
    batch_size: BATCH_SIZE,
  }, 'DiscordPromotionAgent starting - consuming from pick_publish outbox');

  // Step 0: Log outbox health metrics
  const healthMetrics = await getOutboxHealthMetrics();
  logger.info({
    ...healthMetrics,
    worker_id: WORKER_ID,
    run_id: runId,
  }, 'Outbox health metrics');

  // Step 1: Reset any stale processing records (crash recovery)
  await resetStaleProcessingRecords();

  // Step 2: Atomically claim pending records
  const claimedRecords = await claimPendingRecords();

  if (claimedRecords.length === 0) {
    logger.info({ worker_id: WORKER_ID, run_id: runId }, 'No records to process');
    return;
  }

  // Step 3: Process each claimed record
  let successCount = 0;
  let failureCount = 0;
  let guardBlockCount = 0;

  for (const record of claimedRecords) {
    const pick = record.unified_picks;

    if (!pick) {
      logger.error({
        publish_id: record.id,
        pick_id: record.pick_id,
      }, 'pick_publish record has no associated unified_pick');

      await markRecordFailed(record, 'Missing unified_pick data');
      failureCount++;
      continue;
    }

    const traceId = pick.trace_id || record.metadata?.trace_id;
    logger.debug({
      publish_id: record.id,
      pick_id: pick.id,
      trace_id: traceId,
      form_source: pick.form_source,
    }, 'Processing pick_publish record');

    const result = await postPickToDiscord(record, pick);

    if (result.success) {
      await markRecordSent(record, result.external_message_id!);
      successCount++;
    } else if (result.blocked_by_guard) {
      await markRecordFailed(record, result.error || 'Blocked by guard', true);
      guardBlockCount++;
    } else {
      await markRecordFailed(record, result.error || 'Unknown error');
      failureCount++;
    }
  }

  // Step 4: Log summary
  logger.info({
    worker_id: WORKER_ID,
    run_id: runId,
    total_processed: claimedRecords.length,
    success_count: successCount,
    failure_count: failureCount,
    guard_block_count: guardBlockCount,
  }, 'DiscordPromotionAgent run complete');
}

// ============================================================================
// DEPRECATED: Old selector logic
// ============================================================================

/**
 * @deprecated Use promoteToDiscord() which consumes from pick_publish outbox.
 * This function is kept for reference only and should not be called.
 *
 * The unified_picks.posted_to_discord flag is now set as a SIDE EFFECT
 * after successful publishing, not used for selection.
 */
export async function promoteToDiscord_DEPRECATED_DO_NOT_USE(): Promise<void> {
  throw new Error(
    'DEPRECATED: Use promoteToDiscord() which consumes from pick_publish outbox. ' +
    'The unified_picks.posted_to_discord selector logic has been removed per GAP-001 fix.'
  );
}

// ============================================================================
// Module Execution
// ============================================================================

// Only run if executed directly (not imported)
if (require.main === module) {
  promoteToDiscord()
    .then(() => {
      console.log('DiscordPromotionAgent complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('DiscordPromotionAgent failed:', err);
      process.exit(1);
    });
}
