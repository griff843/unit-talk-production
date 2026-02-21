/**
 * DiscordTicketWorker — Polls ticket_discord_outbox and posts Discord embeds.
 *
 * SPRINT-END-TO-END-TICKET-LIFECYCLE-TRUTH-093 (heartbeat integration)
 * SPRINT-DISCORD-OUTBOX-ROUTING-CLAIM-092 (atomic claim)
 * SPRINT-SMARTFORM-ENTITY-AUTOFILL-088 (contract validation)
 * SPRINT-DISCORD-WORKER-AUTOSTART-087 (original)
 *
 * This worker polls the `ticket_discord_outbox` table for pending items,
 * posts Discord embeds for each ticket, and marks them as posted or failed.
 *
 * Gated behind ENABLE_DISCORD_TICKET_WORKER=true (default OFF, fail-closed).
 * Idempotent: UNIQUE(ticket_id) prevents duplicate posts.
 *
 * SPRINT-092 Features:
 * - Atomic claim with SKIP LOCKED (status='processing')
 * - Stale claim reset (60s threshold)
 * - Null-channel cleanup (ROUTE_MISSING)
 * - Structured error logging
 *
 * SPRINT-093 Features:
 * - Worker heartbeat every poll cycle (ops_worker_heartbeats)
 * - Tracks last successful post and last error for observability
 */

import axios from 'axios';

import {
  OutboxItem,
  validateTicketContract,
  buildTicketEmbed,
  formatOdds,
  formatLegSummary,
  calculateCombinedOdds,
} from '../lib/ticketEmbedBuilder';
import { supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('DiscordTicketWorker');

// ---- CONFIG ----
const POLL_INTERVAL = parseInt(process.env['TICKET_DISCORD_POLL_INTERVAL'] || '10000', 10);
const BATCH_SIZE = parseInt(process.env['TICKET_DISCORD_BATCH_SIZE'] || '10', 10);
const DISCORD_WEBHOOK_URL = process.env['DISCORD_WEBHOOK_URL'] || '';
const STALE_CLAIM_THRESHOLD_SECONDS = 60;
const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

let isRunning = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

// SPRINT-093: Heartbeat state
let lastSuccessfulPostAt: Date | null = null;
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -- tracked for diagnostics
let lastErrorTracked: string | null = null;
let totalItemsProcessed = 0;

// ---- TYPES ----
interface ClaimedItem extends OutboxItem {
  discord_channel_id: string;
  retry_count: number;
}

// ---- HEARTBEAT ----

/**
 * SPRINT-093: Write worker heartbeat to ops_worker_heartbeats table.
 * Called every poll cycle to indicate worker is alive and track metrics.
 */
async function writeHeartbeat(
  itemsProcessed: number,
  errorMessage: string | null = null
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseClient.rpc as any)('upsert_worker_heartbeat', {
      p_worker_name: 'discord-ticket-worker',
      p_worker_id: WORKER_ID,
      p_status: errorMessage ? 'degraded' : 'healthy',
      p_last_error: errorMessage,
      p_items_processed: itemsProcessed,
      p_last_successful_post_at: lastSuccessfulPostAt?.toISOString() || null,
      p_meta: {
        poll_interval_ms: POLL_INTERVAL,
        batch_size: BATCH_SIZE,
        webhook_configured: !!DISCORD_WEBHOOK_URL,
        total_items_processed: totalItemsProcessed,
      },
    });
  } catch (err) {
    // Non-fatal: log but don't crash the worker
    logger.warn('Failed to write worker heartbeat', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---- ATOMIC CLAIM ----

/**
 * SPRINT-092: Claim a batch of pending items using atomic SKIP LOCKED
 */
async function claimBatch(): Promise<ClaimedItem[]> {
  const { data, error } = await supabaseClient.rpc('claim_discord_outbox_batch', {
    p_limit: BATCH_SIZE,
    p_worker_id: WORKER_ID,
  });

  if (error) {
    logger.error('Failed to claim batch', { error: error.message });
    return [];
  }

  return (data || []) as ClaimedItem[];
}

interface ReleaseClaimOpts {
  messageId?: string;
  channelId?: string;
  errorMsg?: string;
}

/** SPRINT-092: Release claim after processing */
async function releaseClaim(
  outboxId: string,
  success: boolean,
  opts: ReleaseClaimOpts = {}
): Promise<boolean> {
  const { data, error } = await supabaseClient.rpc('release_discord_outbox_claim', {
    p_outbox_id: outboxId,
    p_success: success,
    p_discord_message_id: opts.messageId || null,
    p_discord_channel_id: opts.channelId || null,
    p_error: opts.errorMsg || null,
  });
  if (error) {
    logger.error('Failed to release claim', { outbox_id: outboxId, error: error.message });
    return false;
  }
  return data === true;
}

/**
 * SPRINT-092: Reset stale claims back to pending
 */
async function resetStaleClaims(): Promise<number> {
  const { data, error } = await supabaseClient.rpc('reset_stale_discord_outbox_claims', {
    p_stale_seconds: STALE_CLAIM_THRESHOLD_SECONDS,
  });

  if (error) {
    logger.error('Failed to reset stale claims', { error: error.message });
    return 0;
  }

  const count = data as number;
  if (count > 0) {
    logger.warn(`Reset ${count} stale claim(s) back to pending`);
  }
  return count;
}

/**
 * SPRINT-092: Cleanup null-channel pending rows
 */
async function cleanupNullChannelRows(): Promise<number> {
  const { data, error } = await supabaseClient.rpc('cleanup_null_channel_outbox');

  if (error) {
    logger.error('Failed to cleanup null-channel rows', { error: error.message });
    return 0;
  }

  const count = data as number;
  if (count > 0) {
    logger.info(`Marked ${count} null-channel row(s) as failed with ROUTE_MISSING`);
  }
  return count;
}

// ---- POSTING LOGIC ----

function buildErrorPayload(type: string, message: string, extra?: Record<string, unknown>): string {
  return JSON.stringify({
    type,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

type PostResult = { success: boolean; messageId?: string; channelId?: string; error?: string };

async function postToDiscord(
  item: ClaimedItem,
  embed: object,
  contract: { capper_name?: string; matchup_text?: string }
): Promise<PostResult> {
  if (!DISCORD_WEBHOOK_URL) {
    return {
      success: false,
      error: buildErrorPayload('WEBHOOK_MISSING', 'DISCORD_WEBHOOK_URL not configured'),
    };
  }
  try {
    const response = await axios.post(`${DISCORD_WEBHOOK_URL}?wait=true`, {
      username: 'Unit Talk Tickets',
      embeds: [embed],
    });
    const { id: messageId, channel_id: channelId } = response.data || {};
    logger.info('Posted ticket to Discord', {
      outbox_id: item.outbox_id,
      ticket_id: item.ticket_id,
      discord_message_id: messageId,
      discord_channel_id: channelId,
      capper: contract.capper_name,
      matchup: contract.matchup_text,
      attempt: item.retry_count + 1,
    });
    return { success: true, messageId, channelId };
  } catch (err: unknown) {
    const axiosErr = err as {
      response?: { data?: { message?: string }; status?: number };
      message?: string;
    };
    const errorMessage = axiosErr.response?.data?.message || axiosErr.message || 'Unknown error';
    const statusCode = axiosErr.response?.status;
    logger.error('Failed to post ticket to Discord', {
      outbox_id: item.outbox_id,
      ticket_id: item.ticket_id,
      error: errorMessage,
      status_code: statusCode,
      attempt: item.retry_count + 1,
    });
    return {
      success: false,
      error: buildErrorPayload('DISCORD_API_ERROR', errorMessage, {
        status_code: statusCode,
        attempt: item.retry_count + 1,
      }),
    };
  }
}

async function processItem(item: ClaimedItem): Promise<boolean> {
  // Validate contract (capper, matchup required)
  const contract = validateTicketContract(item);

  if (!contract.valid) {
    const errorMsg = buildErrorPayload(
      'CONTRACT_VIOLATION',
      `Missing: ${contract.missingFields.join(', ')}`,
      {
        missing_fields: contract.missingFields,
      }
    );
    logger.error('Contract violation', {
      outbox_id: item.outbox_id,
      ticket_id: item.ticket_id,
      missing_fields: contract.missingFields,
    });
    await releaseClaim(item.outbox_id, false, { errorMsg });
    return false;
  }

  // Build embed
  const embed = buildTicketEmbed(item, contract);

  // Post to Discord
  const result = await postToDiscord(item, embed, contract);

  // Release claim with result
  await releaseClaim(item.outbox_id, result.success, {
    messageId: result.messageId,
    channelId: result.channelId || item.discord_channel_id,
    errorMsg: result.error,
  });

  return result.success;
}

// ---- BATCH PROCESSING ----

/**
 * Process a batch of claimed items.
 * Returns count of successfully processed items.
 */
async function processBatch(): Promise<number> {
  // First, reset any stale claims
  await resetStaleClaims();

  // Cleanup any legacy null-channel rows
  await cleanupNullChannelRows();

  // Check webhook before claiming
  if (!DISCORD_WEBHOOK_URL) {
    logger.warn('DISCORD_WEBHOOK_URL not set - skipping batch processing');
    return 0;
  }

  // Claim batch atomically
  const items = await claimBatch();
  if (items.length === 0) return 0;

  logger.info(`Processing ${items.length} claimed outbox item(s)`, { worker_id: WORKER_ID });

  let processed = 0;
  for (const item of items) {
    if (await processItem(item)) {
      processed++;
      // SPRINT-093: Track last successful post time
      lastSuccessfulPostAt = new Date();
    }
  }

  // SPRINT-093: Update cumulative total
  totalItemsProcessed += processed;

  return processed;
}

// ---- LIFECYCLE ----

export async function startDiscordTicketWorker(): Promise<void> {
  if (process.env.ENABLE_DISCORD_TICKET_WORKER !== 'true') {
    logger.info('DiscordTicketWorker SKIPPED (ENABLE_DISCORD_TICKET_WORKER not set to true)');
    return;
  }

  if (isRunning) {
    logger.warn('DiscordTicketWorker already running');
    return;
  }

  isRunning = true;
  logger.info('DiscordTicketWorker started', {
    pollInterval: POLL_INTERVAL,
    batchSize: BATCH_SIZE,
    webhookConfigured: !!DISCORD_WEBHOOK_URL,
    workerId: WORKER_ID,
    staleThresholdSeconds: STALE_CLAIM_THRESHOLD_SECONDS,
  });

  if (!DISCORD_WEBHOOK_URL) {
    logger.warn('DISCORD_WEBHOOK_URL not set - worker will skip processing until configured');
  }

  // SPRINT-093: Write initial heartbeat on startup
  await writeHeartbeat(0, null);
  logger.info('Initial heartbeat written');

  // Initial batch
  try {
    const count = await processBatch();
    if (count > 0) logger.info(`Initial batch: processed ${count} item(s)`);
    lastErrorTracked = null;
    await writeHeartbeat(count, null);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Initial batch failed (non-fatal)', { error: errorMsg });
    lastErrorTracked = errorMsg;
    await writeHeartbeat(0, errorMsg);
  }

  // Poll loop with heartbeat
  pollTimer = setInterval(async () => {
    try {
      const count = await processBatch();
      lastErrorTracked = null;
      await writeHeartbeat(count, null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Poll cycle failed (non-fatal)', { error: errorMsg });
      lastErrorTracked = errorMsg;
      await writeHeartbeat(0, errorMsg);
    }
  }, POLL_INTERVAL);
}

export async function stopDiscordTicketWorker(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isRunning = false;

  // SPRINT-093: Write final heartbeat indicating stopped
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseClient.rpc as any)('upsert_worker_heartbeat', {
      p_worker_name: 'discord-ticket-worker',
      p_worker_id: WORKER_ID,
      p_status: 'stopped',
      p_last_error: null,
      p_items_processed: 0,
      p_last_successful_post_at: lastSuccessfulPostAt?.toISOString() || null,
      p_meta: { total_items_processed: totalItemsProcessed, stopped_at: new Date().toISOString() },
    });
  } catch {
    // Best effort
  }

  logger.info('DiscordTicketWorker stopped');
}

export function isDiscordTicketWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Process outbox once (for testing/verification)
 */
export async function processDiscordOutboxOnce(): Promise<number> {
  return processBatch();
}

// Re-export helpers for testing
export {
  buildTicketEmbed,
  formatLegSummary,
  calculateCombinedOdds,
  validateTicketContract,
  formatOdds,
};
