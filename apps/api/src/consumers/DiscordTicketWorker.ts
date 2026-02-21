/**
 * DiscordTicketWorker — Polls ticket_discord_outbox and posts Discord embeds.
 *
 * SPRINT-SMARTFORM-ENTITY-AUTOFILL-088 (updated)
 * SPRINT-DISCORD-WORKER-AUTOSTART-087 (original)
 *
 * This worker polls the `ticket_discord_outbox` table for pending items,
 * posts Discord embeds for each ticket, and marks them as posted or failed.
 *
 * Gated behind ENABLE_DISCORD_TICKET_WORKER=true (default OFF, fail-closed).
 * Idempotent: UNIQUE(ticket_id) prevents duplicate posts.
 *
 * Fail-closed:
 * - If DISCORD_WEBHOOK_URL is missing, marks items as failed with clear error
 * - If capper or matchup is missing, marks items as failed (SPRINT-088 contract)
 * - Discord API failures result in failed status with error details
 * - Retryable: failed items can be reset via reset_failed_discord_outbox()
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

let isRunning = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

// ---- CORE PROCESSING ----

async function markItemsFailed(items: OutboxItem[], errorMessage: string): Promise<void> {
  for (const item of items) {
    await supabaseClient.rpc('mark_discord_outbox_failed', {
      p_outbox_id: item.outbox_id,
      p_error: errorMessage,
    });
    logger.error('Marked as failed: missing DISCORD_WEBHOOK_URL', {
      outbox_id: item.outbox_id,
      ticket_id: item.ticket_id,
    });
  }
}

async function handleContractViolation(item: OutboxItem, missingFields: string[]): Promise<void> {
  const errorMsg = `contract_missing_fields: ${missingFields.join(', ')}`;
  await supabaseClient.rpc('mark_discord_outbox_failed', {
    p_outbox_id: item.outbox_id,
    p_error: JSON.stringify({
      type: 'CONTRACT_VIOLATION',
      message: errorMsg,
      missing_fields: missingFields,
      timestamp: new Date().toISOString(),
    }),
  });
  logger.error('Marked as failed: contract violation', {
    outbox_id: item.outbox_id,
    ticket_id: item.ticket_id,
    missing_fields: missingFields,
  });
}

async function handlePostError(
  item: OutboxItem,
  err: unknown,
  attemptNumber: number
): Promise<void> {
  const axiosErr = err as {
    response?: { data?: { message?: string }; status?: number };
    message?: string;
  };
  const errorMessage = axiosErr.response?.data?.message || axiosErr.message || 'Unknown error';
  const statusCode = axiosErr.response?.status;

  await supabaseClient.rpc('mark_discord_outbox_failed', {
    p_outbox_id: item.outbox_id,
    p_error: JSON.stringify({
      message: errorMessage,
      status_code: statusCode,
      attempt: attemptNumber + 1,
      timestamp: new Date().toISOString(),
    }),
  });

  logger.error('Failed to post ticket to Discord', {
    outbox_id: item.outbox_id,
    ticket_id: item.ticket_id,
    error: errorMessage,
    status_code: statusCode,
    attempt: attemptNumber + 1,
  });
}

async function postToDiscord(
  item: OutboxItem,
  embed: object,
  attemptNumber: number,
  contract: { capper_name?: string; matchup_text?: string }
): Promise<boolean> {
  try {
    const response = await axios.post(`${DISCORD_WEBHOOK_URL}?wait=true`, {
      username: 'Unit Talk Tickets',
      embeds: [embed],
    });

    const messageId = response.data?.id;
    const channelId = response.data?.channel_id;

    await supabaseClient.rpc('mark_discord_outbox_posted', {
      p_outbox_id: item.outbox_id,
      p_discord_message_id: messageId,
      p_discord_channel_id: channelId,
    });

    logger.info('Posted ticket to Discord', {
      outbox_id: item.outbox_id,
      ticket_id: item.ticket_id,
      discord_message_id: messageId,
      discord_channel_id: channelId,
      capper: contract.capper_name,
      matchup: contract.matchup_text,
      attempt: attemptNumber + 1,
    });

    return true;
  } catch (err: unknown) {
    await handlePostError(item, err, attemptNumber);
    return false;
  }
}

async function handleMissingWebhook(): Promise<number> {
  const { data: pendingItems, error: fetchErr } = await supabaseClient.rpc(
    'get_pending_discord_outbox',
    { p_limit: BATCH_SIZE }
  );
  if (!fetchErr && pendingItems && pendingItems.length > 0) {
    await markItemsFailed(
      pendingItems as OutboxItem[],
      'DISCORD_WEBHOOK_URL not configured - worker cannot post'
    );
  }
  return 0;
}

async function processItem(item: OutboxItem): Promise<boolean> {
  const attemptNumber = (item as any).retry_count || 0;
  const contract = validateTicketContract(item);

  if (!contract.valid) {
    await handleContractViolation(item, contract.missingFields);
    return false;
  }

  const embed = buildTicketEmbed(item, contract);
  return postToDiscord(item, embed, attemptNumber, contract);
}

async function fetchPendingItems(): Promise<OutboxItem[] | null> {
  const { data: items, error } = await supabaseClient.rpc('get_pending_discord_outbox', {
    p_limit: BATCH_SIZE,
  });
  if (error) {
    logger.error('Failed to fetch pending outbox', { error: error.message });
    return null;
  }
  return (items || []) as OutboxItem[];
}

// SPRINT-SMARTFORM-CANONICAL-ENTITIES-089: Mark stale pending items as failed
const STALE_THRESHOLD_SECONDS = 60;

async function markStaleItemsFailed(): Promise<number> {
  // Find items pending for more than 60 seconds and mark them failed
  const { data: staleItems, error: fetchErr } = await supabaseClient
    .from('ticket_discord_outbox')
    .select('id, ticket_id, created_at')
    .eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - STALE_THRESHOLD_SECONDS * 1000).toISOString());

  if (fetchErr) {
    logger.error('Failed to fetch stale items', { error: fetchErr.message });
    return 0;
  }

  if (!staleItems || staleItems.length === 0) return 0;

  let markedCount = 0;
  for (const item of staleItems) {
    const ageSeconds = Math.round((Date.now() - new Date(item.created_at).getTime()) / 1000);
    const { error: updateErr } = await supabaseClient.rpc('mark_discord_outbox_failed', {
      p_outbox_id: item.id,
      p_error: JSON.stringify({
        type: 'STALE_TIMEOUT',
        message: `Ticket pending for ${ageSeconds}s (threshold: ${STALE_THRESHOLD_SECONDS}s)`,
        threshold_seconds: STALE_THRESHOLD_SECONDS,
        actual_seconds: ageSeconds,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!updateErr) {
      logger.warn('Marked stale ticket as failed', {
        outbox_id: item.id,
        ticket_id: item.ticket_id,
        age_seconds: ageSeconds,
      });
      markedCount++;
    }
  }

  if (markedCount > 0) {
    logger.info(`Marked ${markedCount} stale item(s) as failed`);
  }

  return markedCount;
}

/**
 * Process a batch of pending outbox items.
 * Returns count of successfully processed items.
 */
async function processBatch(): Promise<number> {
  if (!DISCORD_WEBHOOK_URL) return handleMissingWebhook();

  const items = await fetchPendingItems();
  if (!items || items.length === 0) return 0;

  logger.info(`Processing ${items.length} pending outbox item(s)`);

  let processed = 0;
  for (const item of items) {
    if (await processItem(item)) processed++;
  }
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
  });

  if (!DISCORD_WEBHOOK_URL) {
    logger.warn('DISCORD_WEBHOOK_URL not set - worker will mark items as failed');
  }

  try {
    const count = await processBatch();
    if (count > 0) logger.info(`Initial batch: processed ${count} item(s)`);
  } catch (err) {
    logger.error('Initial batch failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  pollTimer = setInterval(async () => {
    try {
      // SPRINT-SMARTFORM-CANONICAL-ENTITIES-089: Check for stale pending items
      await markStaleItemsFailed();
      await processBatch();
    } catch (err) {
      logger.error('Poll cycle failed (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, POLL_INTERVAL);
}

export function stopDiscordTicketWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isRunning = false;
  logger.info('DiscordTicketWorker stopped');
}

export function isDiscordTicketWorkerRunning(): boolean {
  return isRunning;
}

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
