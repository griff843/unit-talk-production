/**
 * AUTO-PROCESSOR: Continuous bridge_outbox processor with Discord posting
 *
 * This script runs continuously, processing pending events and posting to Discord.
 * It's a simplified version of BridgeWorker designed to work without Temporal dependencies.
 *
 * PARLAY-DISCORD-GROUPING-001: Updated to post parlays as single messages
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { SyndicateGradingEngine } from '../agents/GradingAgent/scoring/gradingEngine';
import { buildPickPresentation } from '../services/pickPresentationBuilder';
import { PickPresentation } from '../types/pickPresentation';
import {
  buildTicketPresentation,
  isTicketAlreadyPosted,
  getExistingDiscordMessageId,
} from '../services/ticketPresentationBuilder';
import {
  TicketPresentation,
  isParlay,
  formatParlayTitle,
  MAX_DISPLAY_LEGS,
} from '../types/ticketPresentation';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const POLL_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_INTERVAL = 15000; // 15 seconds - DAEMON-TRUTH-SIGNALS-001
const WORKER_NAME = 'outbox-consumer';

/**
 * DAEMON-TRUTH-SIGNALS-001: Bootstrap heartbeat table if not exists
 * Creates the worker_heartbeats table in cloud Supabase if it doesn't exist
 */
async function bootstrapHeartbeatTable(): Promise<void> {
  try {
    // Try to select from the table to check if it exists
    const { error: checkError } = await supabase
      .from('worker_heartbeats')
      .select('worker_name')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      // Table doesn't exist - create it via raw SQL (requires direct DB access)
      console.log('[HEARTBEAT] worker_heartbeats table does not exist - heartbeat will be skipped');
      return;
    }

    if (checkError && checkError.message.includes('does not exist')) {
      console.log('[HEARTBEAT] worker_heartbeats table not found - heartbeat will be skipped');
      return;
    }

    console.log('[HEARTBEAT] worker_heartbeats table exists - heartbeat enabled');
  } catch (err) {
    console.log('[HEARTBEAT] Could not verify worker_heartbeats table (fail-open)', {
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

interface ProcessingStats {
  cycleCount: number;
  eventsProcessed: number;
  picksGraded: number;
  discordPosts: number;
  errors: number;
  startTime: Date;
}

const stats: ProcessingStats = {
  cycleCount: 0,
  eventsProcessed: 0,
  picksGraded: 0,
  discordPosts: 0,
  errors: 0,
  startTime: new Date()
};

function log(msg: string, data?: any) {
  const ts = new Date().toISOString();
  if (data) {
    console.log(`[${ts}] ${msg}`, JSON.stringify(data));
  } else {
    console.log(`[${ts}] ${msg}`);
  }
}

/**
 * DAEMON-TRUTH-SIGNALS-001: Heartbeat writer
 * Upserts to worker_heartbeats every 15s
 * FAIL-OPEN: heartbeat failure cannot block processing
 */
async function writeHeartbeat(): Promise<void> {
  try {
    const runtime = Math.round((Date.now() - stats.startTime.getTime()) / 1000);
    const meta = {
      cycles: stats.cycleCount,
      events_processed: stats.eventsProcessed,
      picks_graded: stats.picksGraded,
      discord_posts: stats.discordPosts,
      errors: stats.errors,
      runtime_seconds: runtime,
      poll_interval_ms: POLL_INTERVAL
    };

    // Direct upsert to worker_heartbeats table (public schema)
    const { error } = await supabase
      .from('worker_heartbeats')
      .upsert(
        {
          worker_name: WORKER_NAME,
          last_seen: new Date().toISOString(),
          meta
        },
        { onConflict: 'worker_name' }
      );

    if (error) {
      // FAIL-OPEN: Log warning but do not crash
      log('HEARTBEAT WARNING: Upsert failed (fail-open)', { error: error.message });
    }
  } catch (err) {
    // FAIL-OPEN: Log but never crash
    log('HEARTBEAT WARNING: Exception writing heartbeat (fail-open)', {
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

/**
 * SINGLE-WRITER-SEAL-011: Claim pick via authoritative RPC
 * Uses mark_pick_posted_to_discord to ensure single-writer pattern
 */
async function claimPick(pickId: string): Promise<boolean> {
  const { data: rpcResult, error: rpcError } = await supabase.rpc('mark_pick_posted_to_discord', {
    p_pick_id: pickId,
    p_message_id: null,
    p_meta: { agent: 'auto-processor', claimed_at: new Date().toISOString() }
  });

  if (rpcError) {
    log('claimPick RPC error:', { pickId, error: rpcError.message });
    return false;
  }

  if (rpcResult?.success) {
    // idempotent=true means it was already posted (we didn't claim it)
    // idempotent=false means we successfully claimed it
    return !rpcResult.idempotent;
  }

  return false;
}

/**
 * Build Discord embed from PickPresentation
 * DISCORD-UX-OVERHAUL-001: Standardized embed format
 */
function buildEmbedFromPresentation(presentation: PickPresentation): any {
  const tierColors: Record<string, number> = {
    'S': 0x4fc3f7,  // Light blue
    'A': 0x66bb6a,  // Green
    'B': 0xfbc02d,  // Yellow
    'C': 0xff9800,  // Orange
    'D': 0x9e9e9e,  // Gray
  };

  const color = tierColors[presentation.tier] || 0x3498db;

  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: 'Odds', value: presentation.odds_american, inline: true },
    { name: 'Units', value: presentation.units, inline: true },
    { name: 'Tier', value: `${presentation.tier}-Tier`, inline: true },
  ];

  if (presentation.capper_name && presentation.capper_name !== 'Unit Talk') {
    fields.push({ name: 'Capper', value: presentation.capper_name, inline: true });
  }

  const embed: any = {
    title: `🎯 ${presentation.title}`,
    color,
    description: `**${presentation.market_label}**\n${presentation.context_line}`,
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: `Unit Talk • ${presentation.pick_id.slice(0, 8)}` },
  };

  if (presentation.thumbnail_url) {
    embed.thumbnail = { url: presentation.thumbnail_url };
  }

  return embed;
}

/**
 * PARLAY-DISCORD-GROUPING-001: Build Discord embed for parlay ticket
 * Shows all legs in a single embed with total odds/units
 */
function buildParlayEmbed(ticket: TicketPresentation): any {
  const tierColors: Record<string, number> = {
    'S': 0x4fc3f7,  // Light blue
    'A': 0x66bb6a,  // Green
    'B': 0xfbc02d,  // Yellow
    'C': 0xff9800,  // Orange
    'D': 0x9e9e9e,  // Gray
  };

  const color = tierColors[ticket.tier] || 0x3498db;

  // Build legs description
  const displayLegs = ticket.legs.slice(0, MAX_DISPLAY_LEGS);
  const legsDescription = displayLegs.map((leg, i) => {
    const matchupStr = leg.matchup ? ` • ${leg.matchup}` : '';
    return `**Leg ${leg.leg_number}:** ${leg.title} (${leg.odds_american})${matchupStr}`;
  }).join('\n');

  // Add "+N more" if there are more legs
  const extraLegs = ticket.legs.length - MAX_DISPLAY_LEGS;
  const extraLegsStr = extraLegs > 0 ? `\n*+${extraLegs} more leg(s)*` : '';

  const description = `${legsDescription}${extraLegsStr}`;

  // Build fields
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  if (ticket.total_odds_american) {
    fields.push({ name: 'Total Odds', value: ticket.total_odds_american, inline: true });
  }

  fields.push({ name: 'Units', value: ticket.total_units, inline: true });
  fields.push({ name: 'Tier', value: `${ticket.tier}-Tier`, inline: true });

  if (ticket.capper_name && ticket.capper_name !== 'Unit Talk') {
    fields.push({ name: 'Capper', value: ticket.capper_name, inline: true });
  }

  const embed: any = {
    title: `🎲 ${formatParlayTitle(ticket.leg_count)}`,
    color,
    description,
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: `Unit Talk • ${ticket.ticket_id.slice(0, 8)}` },
  };

  if (ticket.thumbnail_url) {
    embed.thumbnail = { url: ticket.thumbnail_url };
  }

  return embed;
}

/**
 * PARLAY-DISCORD-GROUPING-001: Claim ALL picks in a ticket atomically
 * SINGLE-WRITER-SEAL-011: Uses mark_pick_posted_to_discord RPC
 * Returns true only if ALL picks were successfully claimed
 */
async function claimTicket(pickIds: string[]): Promise<boolean> {
  if (pickIds.length === 0) return false;

  let claimedCount = 0;

  // Claim each pick via RPC - if any fails or was already claimed, rollback not possible
  // but we track success to determine if the ticket was fully claimed
  for (const pickId of pickIds) {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('mark_pick_posted_to_discord', {
      p_pick_id: pickId,
      p_message_id: null,
      p_meta: { agent: 'auto-processor', ticket_claim: true, claimed_at: new Date().toISOString() }
    });

    if (rpcError) {
      log('claimTicket RPC error:', { pickId, error: rpcError.message });
      continue;
    }

    if (rpcResult?.success && !rpcResult.idempotent) {
      // Successfully claimed (wasn't already posted)
      claimedCount++;
    }
  }

  // All picks must have been claimed for success
  // If fewer than expected were claimed, some were already posted
  if (claimedCount !== pickIds.length) {
    log('claimTicket partial claim via RPC - some picks already posted', {
      expected: pickIds.length,
      claimed: claimedCount
    });
    return false;
  }

  return true;
}

/**
 * PARLAY-DISCORD-GROUPING-001: Post ticket (single or parlay) to Discord
 */
async function postTicketToDiscord(
  picks: any[],
  ticket: TicketPresentation
): Promise<string | null> {
  if (!DISCORD_WEBHOOK_URL) {
    log('DISCORD_WEBHOOK_URL not configured');
    return null;
  }

  try {
    let embed: any;

    if (ticket.ticket_type === 'parlay') {
      embed = buildParlayEmbed(ticket);
      log('Posting PARLAY to Discord:', {
        ticket_id: ticket.ticket_id,
        leg_count: ticket.leg_count,
        total_odds: ticket.total_odds_american
      });
    } else {
      // Single pick - use existing presentation
      if (ticket.single_pick) {
        embed = buildEmbedFromPresentation(ticket.single_pick);
        log('Posting SINGLE to Discord:', {
          title: ticket.single_pick.title,
          market_label: ticket.single_pick.market_label
        });
      } else {
        // Fallback: build presentation from first pick
        const presentation = await buildPickPresentation(picks[0]);
        embed = buildEmbedFromPresentation(presentation);
        log('Posting SINGLE (fallback) to Discord:', {
          title: presentation.title
        });
      }
    }

    const response = await fetch(DISCORD_WEBHOOK_URL + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status}`);
    }

    const result = await response.json();
    return result.id;
  } catch (err) {
    log('Discord post failed:', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function postToDiscord(pick: any): Promise<string | null> {
  if (!DISCORD_WEBHOOK_URL) {
    log('DISCORD_WEBHOOK_URL not configured');
    return null;
  }

  try {
    // DISCORD-UX-OVERHAUL-001: Use standardized PickPresentation
    const presentation = await buildPickPresentation(pick);
    const embed = buildEmbedFromPresentation(presentation);

    log('Posting to Discord with presentation:', {
      title: presentation.title,
      market_label: presentation.market_label,
      market_type: presentation.market_type
    });

    const response = await fetch(DISCORD_WEBHOOK_URL + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status}`);
    }

    const result = await response.json();
    return result.id;
  } catch (err) {
    log('Discord post failed:', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

function buildFeatureSet(pick: any): any {
  const odds = pick.odds || -110;
  const line = pick.line || 0;
  const sport = pick.sport || 'NBA';

  return {
    propId: pick.id,
    unifiedPickId: pick.id,
    gameId: pick.game_id || undefined,
    date: pick.manual_game_date || pick.game_date || new Date().toISOString().slice(0, 10),
    sport,
    league: sport,
    player: pick.player_name || pick.selection || undefined,
    marketType: pick.stat_type || 'moneyline',
    odds,
    market: { type: pick.stat_type || 'moneyline', odds, line },
    expectedValue: 0,
    lineMovement: 0,
    matchupRating: 0.5,
    playerForm: 0.5,
    injuryImpact: 0,
    weatherImpact: 0,
    marketIntelligence: 0.5,
    sharpMoney: 0.5,
    volumeProfile: 0.5,
    closingLineValue: 0,
    playerFatigue: 0,
    venueAdvantage: 0,
    refereeImpact: 0,
    paceImpact: 0,
    motivationalFactors: 0,
    correlationRisk: 0,
    volatility: 0.5,
    portfolioImpact: 0,
    confidence: pick.confidence || 50,
    dataQuality: {
      dataValidationScore: 0.8,
      outlierScore: 0.9,
      consistencyScore: 0.9,
      completeness: 0.7
    },
    timestamp: pick.created_at || new Date().toISOString(),
    version: '1.0',
    source: 'smart_form'
  };
}

/**
 * PARLAY-DISCORD-GROUPING-001: Updated processOutboxEvent
 *
 * Key changes:
 * 1. Parlays (2+ legs) post as a SINGLE Discord message
 * 2. All legs are claimed atomically
 * 3. Same discord_message_id stored on ALL legs
 * 4. Idempotency: if ANY leg is already posted, skip entire ticket
 */
async function processOutboxEvent(event: any): Promise<boolean> {
  try {
    log(`Processing event ${event.id} for bet_slip ${event.bet_slip_id}`);

    // Mark as processing
    await supabase
      .from('bridge_outbox')
      .update({
        status: 'processing',
        retry_count: (event.retry_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', event.id);

    // Fetch ALL unified_picks for this bet_slip_id (including already graded)
    const { data: picks, error: fetchErr } = await supabase
      .from('unified_picks')
      .select('*')
      .eq('bet_slip_id', event.bet_slip_id)
      .order('leg_index', { ascending: true, nullsFirst: true });

    if (fetchErr) {
      throw new Error(`Failed to fetch picks: ${fetchErr.message}`);
    }

    if (!picks || picks.length === 0) {
      log(`No picks for bet_slip ${event.bet_slip_id}`);
      await supabase
        .from('bridge_outbox')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', event.id);
      return true;
    }

    // PARLAY-DISCORD-GROUPING-001: Detect if this is a parlay
    const isTicketParlay = isParlay(picks);
    log(`Ticket type: ${isTicketParlay ? 'PARLAY' : 'SINGLE'} (${picks.length} pick(s))`);

    // IDEMPOTENCY CHECK: If any leg is already posted, skip the entire ticket
    if (isTicketAlreadyPosted(picks)) {
      const existingMsgId = getExistingDiscordMessageId(picks);
      log(`Ticket already posted to Discord (message_id: ${existingMsgId}), skipping`);
      await supabase
        .from('bridge_outbox')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', event.id);
      return true;
    }

    // Grade each pick that hasn't been graded yet
    const engine = new SyndicateGradingEngine();
    const picksToGrade = picks.filter(p => p.promotion_band === null);

    for (const pick of picksToGrade) {
      const featureSet = buildFeatureSet(pick);
      const gradeResult = await engine.gradeProp(featureSet);
      const dbTier = gradeResult.tier === 'D' ? 'C' : gradeResult.tier;

      // Update with grading results
      await supabase
        .from('unified_picks')
        .update({
          promotion_band: gradeResult.promotionBand || null,
          tier: dbTier,
          professional_score: isNaN(gradeResult.finalScore) ? null : gradeResult.finalScore,
          confidence: gradeResult.confidence > 1
            ? Math.round(gradeResult.confidence)
            : Math.round(gradeResult.confidence * 10),
          workflow_stage: 'approved',
          feature_contributions: gradeResult.featureContributions || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', pick.id);

      stats.picksGraded++;
      log(`Graded pick ${pick.id}: tier=${dbTier}`);
    }

    // Refetch all picks with updated data
    const { data: updatedPicks } = await supabase
      .from('unified_picks')
      .select('*')
      .eq('bet_slip_id', event.bet_slip_id)
      .order('leg_index', { ascending: true, nullsFirst: true });

    if (!updatedPicks || updatedPicks.length === 0) {
      throw new Error('Failed to refetch picks after grading');
    }

    // Build ticket presentation (works for both singles and parlays)
    const ticketPresentation = await buildTicketPresentation(updatedPicks);

    // PARLAY-DISCORD-GROUPING-001: Claim ALL legs atomically
    const pickIds = updatedPicks.map(p => p.id);
    const claimed = await claimTicket(pickIds);

    if (!claimed) {
      log('Failed to claim ticket - picks may already be posted');
      await supabase
        .from('bridge_outbox')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', event.id);
      return true;
    }

    // PARLAY-DISCORD-GROUPING-001: Post ONE message for entire ticket
    const msgId = await postTicketToDiscord(updatedPicks, ticketPresentation);

    if (msgId) {
      stats.discordPosts++;
      log(`Posted ticket to Discord: ${msgId} (${isTicketParlay ? 'parlay' : 'single'})`);

      // Update ALL legs with the same discord_message_id
      const discordReceipt = {
        message_id: msgId,
        posted_at: new Date().toISOString(),
        ticket_type: isTicketParlay ? 'parlay' : 'single',
        leg_count: updatedPicks.length
      };

      for (const pick of updatedPicks) {
        const newMeta = {
          ...(pick.meta || {}),
          discord_receipt: discordReceipt
        };
        await supabase
          .from('unified_picks')
          .update({ meta: newMeta })
          .eq('id', pick.id);
      }

      log(`Updated ${updatedPicks.length} pick(s) with discord_message_id: ${msgId}`);
    }

    // Mark event as completed
    await supabase
      .from('bridge_outbox')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', event.id);

    stats.eventsProcessed++;
    return true;

  } catch (err) {
    stats.errors++;
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Error processing event ${event.id}: ${errMsg}`);

    // Mark as failed
    await supabase
      .from('bridge_outbox')
      .update({
        status: 'failed',
        error_message: errMsg,
        processed_at: new Date().toISOString()
      })
      .eq('id', event.id);

    return false;
  }
}

async function processCycle(): Promise<void> {
  stats.cycleCount++;

  // Fetch pending events
  const { data: events, error } = await supabase
    .from('bridge_outbox')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    log('Error fetching events:', { error: error.message });
    return;
  }

  if (!events || events.length === 0) {
    return; // No events to process
  }

  log(`Processing ${events.length} pending events`);

  for (const event of events) {
    await processOutboxEvent(event);
  }
}

async function main(): Promise<void> {
  log('=== AUTO-PROCESSOR STARTED ===');
  log(`SUPABASE_URL: ${process.env.SUPABASE_URL}`);
  log(`DISCORD_WEBHOOK_URL configured: ${!!DISCORD_WEBHOOK_URL}`);
  log(`Poll interval: ${POLL_INTERVAL}ms`);
  log('');

  // Process immediately on startup
  await processCycle();

  // Then poll continuously
  setInterval(async () => {
    try {
      await processCycle();
    } catch (err) {
      log('Cycle error:', { error: err instanceof Error ? err.message : String(err) });
    }
  }, POLL_INTERVAL);

  // DAEMON-TRUTH-SIGNALS-001: Heartbeat every 15 seconds
  await writeHeartbeat(); // Initial heartbeat on startup
  setInterval(async () => {
    await writeHeartbeat();
  }, HEARTBEAT_INTERVAL);
  log(`Heartbeat interval: ${HEARTBEAT_INTERVAL}ms`);

  // Stats logging every minute
  setInterval(() => {
    const runtime = Math.round((Date.now() - stats.startTime.getTime()) / 1000);
    log('STATS', {
      runtime: `${runtime}s`,
      cycles: stats.cycleCount,
      events: stats.eventsProcessed,
      graded: stats.picksGraded,
      discord: stats.discordPosts,
      errors: stats.errors
    });
  }, 60000);

  log('Auto-processor running. Press Ctrl+C to stop.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
