/**
 * DiscordTicketWorker — Polls ticket_discord_outbox and posts Discord embeds.
 *
 * SPRINT-DISCORD-WORKER-AUTOSTART-087
 *
 * This worker polls the `ticket_discord_outbox` table for pending items,
 * posts Discord embeds for each ticket, and marks them as posted or failed.
 *
 * Gated behind ENABLE_DISCORD_TICKET_WORKER=true (default OFF, fail-closed).
 * Idempotent: UNIQUE(ticket_id) prevents duplicate posts.
 *
 * Fail-closed:
 * - If DISCORD_WEBHOOK_URL is missing, marks items as failed with clear error
 * - Discord API failures result in failed status with error details
 * - Retryable: failed items can be reset via reset_failed_discord_outbox()
 */

import axios from 'axios';

import { buildProductionFooter } from '../lib/embedPresentationContract';
import { supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('DiscordTicketWorker');

// ---- CONFIG ----
const POLL_INTERVAL = parseInt(process.env['TICKET_DISCORD_POLL_INTERVAL'] || '10000', 10);
const BATCH_SIZE = parseInt(process.env['TICKET_DISCORD_BATCH_SIZE'] || '10', 10);
const DISCORD_WEBHOOK_URL = process.env['DISCORD_WEBHOOK_URL'] || '';

let isRunning = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

// ---- TYPES ----
interface OutboxItem {
  outbox_id: string;
  ticket_id: string;
  bet_slip_id: string;
  ticket_type: string;
  total_stake: number;
  source: string;
  meta: Record<string, unknown>;
  legs: LegData[];
  created_at: string;
}

interface LegData {
  leg_index: number;
  selection: string;
  provider: string;
  provider_line: number | null;
  provider_odds: number | null;
  provider_value: {
    sport?: string;
    bet_type?: string;
    home_team?: string;
    away_team?: string;
    matchup_text?: string;
    player_name?: string;
    prop_type?: string;
    line?: number;
    odds?: number;
    selection?: string;
    provider?: string;
    entry_mode?: string;
  };
}

// ---- HELPERS ----
function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : odds.toString();
}

function formatTicketType(ticketType: string): string {
  switch (ticketType.toLowerCase()) {
    case 'single':
      return 'Single Bet';
    case 'parlay':
      return 'Parlay';
    case 'teaser':
      return 'Teaser';
    default:
      return ticketType;
  }
}

function calculateCombinedOdds(legs: LegData[]): number {
  let decimalProduct = 1;
  for (const leg of legs) {
    const odds = leg.provider_odds ?? leg.provider_value?.odds ?? -110;
    const decimal = odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
    decimalProduct *= decimal;
  }
  if (decimalProduct >= 2) {
    return Math.round((decimalProduct - 1) * 100);
  } else {
    return Math.round(-100 / (decimalProduct - 1));
  }
}

// eslint-disable-next-line complexity -- Leg formatting requires handling multiple bet types
function formatLegSummary(leg: LegData): string {
  const pv = leg.provider_value;
  if (!pv) {
    return `Leg ${leg.leg_index + 1}: ${leg.selection} @ ${formatOdds(leg.provider_odds ?? -110)}`;
  }

  const sel = pv.selection || leg.selection || '';
  const odds = formatOdds(pv.odds ?? leg.provider_odds ?? -110);
  const line = pv.line ?? leg.provider_line;
  const team = sel.toLowerCase() === 'home' ? pv.home_team || '' : pv.away_team || '';
  const lineStr = line != null ? (line > 0 ? `+${line}` : `${line}`) : '';
  const bt = pv.bet_type || '';

  if (bt === 'player_prop')
    return `${pv.player_name || ''} ${sel.toUpperCase()} ${line} ${pv.prop_type || ''} (${odds})`;
  if (bt === 'team_total') return `${pv.home_team || ''} TT ${sel.toUpperCase()} ${line} (${odds})`;
  if (['spread', 'puck_line', 'run_line'].includes(bt)) return `${team} ${lineStr} (${odds})`;
  if (bt === 'moneyline') return `${team} ML (${odds})`;
  if (['total', 'game_total'].includes(bt)) return `Total ${sel.toUpperCase()} ${line} (${odds})`;
  if (['nrfi', 'yrfi'].includes(bt))
    return `${bt.toUpperCase()} ${pv.matchup_text || ''} (${odds})`;
  return `${pv.sport || ''} ${bt}: ${sel} ${line ?? ''} (${odds})`;
}

// eslint-disable-next-line complexity -- Embed building requires multiple conditional fields
function buildTicketEmbed(item: OutboxItem) {
  const ticketType = formatTicketType(item.ticket_type);
  const legCount = item.legs?.length || 0;
  const combinedOdds =
    legCount > 1 ? calculateCombinedOdds(item.legs) : (item.legs?.[0]?.provider_odds ?? -110);
  const stake = item.total_stake || 1;
  const provider =
    item.legs?.[0]?.provider ?? item.legs?.[0]?.provider_value?.provider ?? 'Unknown';

  const legsDisplay = (item.legs || [])
    .slice(0, 10)
    .map((leg, i) => `${i + 1}. ${formatLegSummary(leg)}`)
    .join('\n');

  const color = legCount >= 5 ? 0xffd700 : legCount >= 3 ? 0x00ff00 : 0x5865f2;
  const footer = buildProductionFooter();

  return {
    title: `🎟️ ${ticketType}${legCount > 1 ? ` (${legCount} Legs)` : ''}`,
    color,
    description: legsDisplay || 'No legs data',
    fields: [
      { name: 'Combined Odds', value: formatOdds(combinedOdds), inline: true },
      { name: 'Stake', value: `${stake}U`, inline: true },
      { name: 'Provider', value: String(provider).toUpperCase(), inline: true },
    ],
    footer: { text: `${footer} | Bet Slip: ${item.bet_slip_id?.slice(0, 8) || 'N/A'}...` },
    timestamp: new Date().toISOString(),
  };
}

// ---- CORE PROCESSING ----

/**
 * Process a batch of pending outbox items.
 * Returns count of successfully processed items.
 */
// eslint-disable-next-line max-lines-per-function, complexity -- Batch processing requires handling multiple states
async function processBatch(): Promise<number> {
  // Fail-closed: If webhook URL is missing, mark all pending items as failed
  if (!DISCORD_WEBHOOK_URL) {
    const { data: pendingItems, error: fetchErr } = await supabaseClient.rpc(
      'get_pending_discord_outbox',
      { p_limit: BATCH_SIZE }
    );

    if (fetchErr || !pendingItems || pendingItems.length === 0) {
      return 0;
    }

    // Mark all as failed with clear error
    for (const item of pendingItems as OutboxItem[]) {
      await supabaseClient.rpc('mark_discord_outbox_failed', {
        p_outbox_id: item.outbox_id,
        p_error: 'DISCORD_WEBHOOK_URL not configured - worker cannot post',
      });
      logger.error('Marked as failed: missing DISCORD_WEBHOOK_URL', {
        outbox_id: item.outbox_id,
        ticket_id: item.ticket_id,
      });
    }
    return 0;
  }

  // Fetch pending items via RPC
  const { data: items, error } = await supabaseClient.rpc('get_pending_discord_outbox', {
    p_limit: BATCH_SIZE,
  });

  if (error) {
    logger.error('Failed to fetch pending outbox', { error: error.message });
    return 0;
  }

  if (!items || items.length === 0) {
    return 0;
  }

  logger.info(`Processing ${items.length} pending outbox item(s)`);

  let processed = 0;
  for (const item of items as OutboxItem[]) {
    const attemptNumber = (item as any).retry_count || 0;

    try {
      // Build embed
      const embed = buildTicketEmbed(item);

      // Post to Discord with wait=true to get message ID
      const response = await axios.post(`${DISCORD_WEBHOOK_URL}?wait=true`, {
        username: 'Unit Talk Tickets',
        embeds: [embed],
      });

      const messageId = response.data?.id;
      const channelId = response.data?.channel_id;

      // Mark as posted
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
        attempt: attemptNumber + 1,
      });

      processed++;
    } catch (err: unknown) {
      // Extract error details
      const axiosErr = err as {
        response?: { data?: { message?: string }; status?: number };
        message?: string;
      };
      const errorMessage = axiosErr.response?.data?.message || axiosErr.message || 'Unknown error';
      const statusCode = axiosErr.response?.status;

      // Mark as failed with error details
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
  }

  return processed;
}

// ---- LIFECYCLE ----

/**
 * Start the DiscordTicketWorker polling loop.
 * Controlled by ENABLE_DISCORD_TICKET_WORKER env var.
 */
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

  // Initial processing
  try {
    const count = await processBatch();
    if (count > 0) {
      logger.info(`Initial batch: processed ${count} item(s)`);
    }
  } catch (err) {
    logger.error('Initial batch failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Start polling
  pollTimer = setInterval(async () => {
    try {
      await processBatch();
    } catch (err) {
      logger.error('Poll cycle failed (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, POLL_INTERVAL);
}

/**
 * Stop the DiscordTicketWorker.
 */
export function stopDiscordTicketWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isRunning = false;
  logger.info('DiscordTicketWorker stopped');
}

/**
 * Check if the worker is running.
 */
export function isDiscordTicketWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Process batch once (for testing/scripts).
 */
export async function processDiscordOutboxOnce(): Promise<number> {
  return processBatch();
}

// Export helpers for testing
export { buildTicketEmbed, formatLegSummary, calculateCombinedOdds };
