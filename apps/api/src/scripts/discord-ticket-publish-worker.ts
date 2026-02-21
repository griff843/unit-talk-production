/**
 * discord-ticket-publish-worker.ts
 * Sprint: SPRINT-V3-TICKET-DISCORD-PUBLISH-086
 *
 * @deprecated SPRINT-DISCORD-WORKER-AUTOSTART-087: Use DiscordTicketWorker consumer instead.
 * The worker is now automatically started by the API service when ENABLE_DISCORD_TICKET_WORKER=true.
 * See: src/consumers/DiscordTicketWorker.ts
 *
 * This standalone script is kept for manual/debugging runs only.
 *
 * Consumes ticket_discord_outbox and posts Discord embeds for V3 tickets.
 * - Polls pending outbox items
 * - Builds embed with ticket summary (ticket type, stake, legs, combined odds, provider)
 * - Posts to Discord webhook
 * - Marks as posted or failed (idempotent, fail-closed)
 *
 * Run:
 *   npx tsx src/scripts/discord-ticket-publish-worker.ts
 *   # Or with --once flag to process once and exit:
 *   npx tsx src/scripts/discord-ticket-publish-worker.ts --once
 */
/* eslint-disable no-console */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

import { buildProductionFooter } from '../lib/embedPresentationContract';

// ---- CONFIG ----
const DISCORD_WEBHOOK_URL = process.env['DISCORD_WEBHOOK_URL'] || '';
const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] || process.env['SUPABASE_URL'] || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';
const POLL_INTERVAL_MS = parseInt(process.env['TICKET_DISCORD_POLL_INTERVAL'] || '10000', 10);
const BATCH_SIZE = parseInt(process.env['TICKET_DISCORD_BATCH_SIZE'] || '10', 10);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- TYPES ----
interface OutboxItem {
  outbox_id: string;
  ticket_id: string;
  bet_slip_id: string;
  ticket_type: string;
  total_stake: number;
  source: string;
  meta: Record<string, any>;
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
  // Convert American odds to decimal, multiply, convert back
  let decimalProduct = 1;
  for (const leg of legs) {
    const odds = leg.provider_odds ?? leg.provider_value?.odds ?? -110;
    const decimal = odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
    decimalProduct *= decimal;
  }
  // Convert back to American
  if (decimalProduct >= 2) {
    return Math.round((decimalProduct - 1) * 100);
  } else {
    return Math.round(-100 / (decimalProduct - 1));
  }
}

// eslint-disable-next-line complexity
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

  // Player prop
  if (bt === 'player_prop')
    return `${pv.player_name || ''} ${sel.toUpperCase()} ${line} ${pv.prop_type || ''} (${odds})`;
  // Team total
  if (bt === 'team_total') return `${pv.home_team || ''} TT ${sel.toUpperCase()} ${line} (${odds})`;
  // Spread variants
  if (['spread', 'puck_line', 'run_line'].includes(bt)) return `${team} ${lineStr} (${odds})`;
  // Moneyline
  if (bt === 'moneyline') return `${team} ML (${odds})`;
  // Total variants
  if (['total', 'game_total'].includes(bt)) return `Total ${sel.toUpperCase()} ${line} (${odds})`;
  // NRFI/YRFI
  if (['nrfi', 'yrfi'].includes(bt))
    return `${bt.toUpperCase()} ${pv.matchup_text || ''} (${odds})`;
  // Fallback
  return `${pv.sport || ''} ${bt}: ${sel} ${line ?? ''} (${odds})`;
}

function buildTicketEmbed(item: OutboxItem) {
  const ticketType = formatTicketType(item.ticket_type);
  const legCount = item.legs.length;
  const combinedOdds =
    legCount > 1 ? calculateCombinedOdds(item.legs) : (item.legs[0]?.provider_odds ?? -110);
  const stake = item.total_stake || 1;
  const provider = item.legs[0]?.provider ?? item.legs[0]?.provider_value?.provider ?? 'Unknown';

  // Build legs summary (max 10 to avoid embed limits)
  const legsDisplay = item.legs
    .slice(0, 10)
    .map((leg, i) => {
      return `${i + 1}. ${formatLegSummary(leg)}`;
    })
    .join('\n');

  // Color based on leg count
  const color = legCount >= 5 ? 0xffd700 : legCount >= 3 ? 0x00ff00 : 0x5865f2;

  // Footer with production compliance
  const footer = buildProductionFooter();

  return {
    title: `🎟️ ${ticketType}${legCount > 1 ? ` (${legCount} Legs)` : ''}`,
    color,
    description: legsDisplay,
    fields: [
      { name: 'Combined Odds', value: formatOdds(combinedOdds), inline: true },
      { name: 'Stake', value: `${stake}U`, inline: true },
      { name: 'Provider', value: provider.toUpperCase(), inline: true },
    ],
    footer: { text: `${footer} | Bet Slip: ${item.bet_slip_id.slice(0, 8)}...` },
    timestamp: new Date().toISOString(),
  };
}

// ---- WORKER ----
async function processPendingOutbox(): Promise<number> {
  // Fetch pending items via RPC
  const { data: items, error } = await supabase.rpc('get_pending_discord_outbox', {
    p_limit: BATCH_SIZE,
  });

  if (error) {
    console.error('[Worker] Failed to fetch pending outbox:', error.message);
    return 0;
  }

  if (!items || items.length === 0) {
    return 0;
  }

  console.log(`[Worker] Processing ${items.length} pending items...`);

  let processed = 0;
  for (const item of items as OutboxItem[]) {
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
      await supabase.rpc('mark_discord_outbox_posted', {
        p_outbox_id: item.outbox_id,
        p_discord_message_id: messageId,
        p_discord_channel_id: channelId,
      });

      console.log(`[Worker] ✓ Posted ticket ${item.ticket_id.slice(0, 8)}... (msg: ${messageId})`);
      processed++;
    } catch (err: any) {
      // Mark as failed
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      await supabase.rpc('mark_discord_outbox_failed', {
        p_outbox_id: item.outbox_id,
        p_error: errorMessage,
      });

      console.error(`[Worker] ✗ Failed ticket ${item.ticket_id.slice(0, 8)}...: ${errorMessage}`);
    }
  }

  return processed;
}

async function runWorker() {
  console.log('=== DISCORD TICKET PUBLISH WORKER ===');
  console.log(`Sprint: SPRINT-V3-TICKET-DISCORD-PUBLISH-086`);
  console.log(`Webhook configured: ${DISCORD_WEBHOOK_URL ? 'YES' : 'NO'}`);
  console.log(`Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log('');

  if (!DISCORD_WEBHOOK_URL) {
    console.error('[Worker] DISCORD_WEBHOOK_URL not set! Exiting.');
    process.exit(1);
  }

  const runOnce = process.argv.includes('--once');

  if (runOnce) {
    console.log('[Worker] Running once...');
    const processed = await processPendingOutbox();
    console.log(`[Worker] Processed ${processed} items. Exiting.`);
    return;
  }

  console.log('[Worker] Starting polling loop...');
  let running = true;
  process.on('SIGINT', () => {
    running = false;
  });
  process.on('SIGTERM', () => {
    running = false;
  });

  while (running) {
    try {
      await processPendingOutbox();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Worker] Loop error:', errMsg);
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Export for testing
export { buildTicketEmbed, processPendingOutbox, formatLegSummary, calculateCombinedOdds };

// Run if main
runWorker().catch(err => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
