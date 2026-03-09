/* eslint-disable max-lines */
import 'dotenv/config';
import axios from 'axios';
import FormData from 'form-data';

// SPRINT-REPO-TRUTH-LOCK-002: Distribution domain boundary — type-only import

import { resolveDiscordRoutingConfig } from '../../config/discordRouting';
import { autopilotGuard } from '../../lib/AutopilotGuard';
import { getBuildInfo } from '../../lib/buildInfo';
import {
  buildProductionFooter,
  validatePickPresentation,
  validatePostingGate,
  validateBuildProvenance,
  assertEmbedReadiness,
  isEmbedStrictMode,
} from '../../lib/embedPresentationContract';
import {
  createExecutionTelemetry,
  updateExecutionTelemetryPublished,
  updateExecutionTelemetryFailed,
  resolveTargetSurface,
} from '../../lib/executionTelemetry';
import { atomicClaimForPost, atomicClaimParlayForPost, lifecycleUpdate } from '../../lib/lifecycle';
import { BlockedError } from '../../lib/lifecycle/errors';
import { logger } from '../../services/logging';
import { buildPickPresentation } from '../../services/pickPresentationBuilder';
import {
  enqueueForPublish,
  markPublished as markOutboxPublished,
  markFailed as markOutboxFailed,
} from '../../services/publishOutbox';
import { supabase } from '../../services/supabaseClient';
import { PickPresentation } from '../../types/pickPresentation';
import { calculateParlayOdds } from '../AlertAgent/parlayEmbedBuilder';
import { parsePromotionPolicyConfig } from '../GradingAgent/scoring/promotionPolicy';

import type { DistributionChannel, DistributionResult } from '@unit-talk/distribution';

// ---- CONFIG ----
// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
// Returns undefined if not set (fail-closed: callers must handle)
function getDiscordWebhookUrl(): string | undefined {
  return process.env['DISCORD_WEBHOOK_URL'];
}
// REQUIRED env var - throws if not configured
function requireDiscordWebhookUrl(): string {
  const url = process.env['DISCORD_WEBHOOK_URL'];
  if (!url) {
    throw new Error(
      'DISCORD_WEBHOOK_URL is required but not configured. See apps/api/CLAUDE.md for env requirements.'
    );
  }
  return url;
}
// SPRINT-PROMOTION-PIPELINE-ACTIVATION: Changed to opt-in (=== 'true') to match all other
// shadow mode patterns in the codebase. Previously inverted default blocked all posting.
// Set PROMOTION_SHADOW_MODE=true to re-enable shadow mode. Default is now ACTIVE posting.
function isPromotionShadowMode(): boolean {
  return process.env['PROMOTION_SHADOW_MODE'] === 'true';
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : odds;
}
function formatUnit(size: any) {
  return size ? `${size}U` : '1U';
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _formatEV(ev: any) {
  return ev !== undefined && ev !== null ? `${ev}% EV` : 'N/A';
}

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
async function generateEliteCard(_: any): Promise<Buffer> {
  return Buffer.from('');
}

// ---- OUTBOX INTEGRATION (SPRINT-023-PRODUCTION-SURFACE-LOCK) ----
// All Discord publishing now goes through pick_publish outbox:
//   1. enqueueForPublish() — create outbox row (idempotent)
//   2. Post to Discord
//   3. markOutboxPublished() — write receipt
// If Discord post fails: markOutboxFailed() with structured error_code

/**
 * Enqueue pick into publish outbox before Discord post.
 * Returns outbox row id for receipt tracking.
 * Fail-closed: throws if outbox insert fails (prevents untracked posts).
 */
async function enqueuePickToOutbox(
  pick: any,
  channel: string = 'picks'
): Promise<{ outboxId: string; alreadyPosted: boolean }> {
  try {
    const result = await enqueueForPublish(supabase, {
      pickId: pick.id,
      channel,
      discordChannelId: pick.discord_channel_id ?? undefined,
      threadId: pick.thread_id ?? undefined,
      payload: {
        pick_id: pick.id,
        tier: pick.tier,
        player_name: pick.player_name,
        stat_type: pick.stat_type,
        line: pick.line,
        sport: pick.sport,
      },
      promotionBand: pick.promotion_band ?? 'HARD',
      tier: pick.tier ?? 'D',
      modelVersion: pick.model_version ?? undefined,
    });

    if (result.alreadyExists) {
      // Check if already posted (outbox says so)
      const { data: existing } = await supabase
        .from('pick_publish')
        .select('status')
        .eq('id', result.outboxId)
        .single();

      if (existing?.status === 'posted') {
        return { outboxId: result.outboxId, alreadyPosted: true };
      }
    }

    return { outboxId: result.outboxId, alreadyPosted: false };
  } catch (err) {
    logger.error({ pickId: pick.id, error: err }, 'OUTBOX-023: Failed to enqueue to outbox');
    throw err;
  }
}

/**
 * Record successful Discord post in outbox.
 */
async function recordOutboxReceipt(outboxId: string, messageId: string): Promise<void> {
  // SPRINT-SETTLEMENT-IDEMPOTENCY-HARDENING: Add retry; posted_to_discord already set atomically (GAP-03)
  try {
    await markOutboxPublished(supabase, outboxId, { externalMessageId: messageId });
    return;
  } catch (firstErr) {
    logger.warn(
      { outboxId, messageId, error: firstErr },
      'OUTBOX-023: Failed to record outbox receipt (attempt 1/2) — retrying'
    );
  }
  await new Promise(resolve => setTimeout(resolve, 200));
  try {
    await markOutboxPublished(supabase, outboxId, { externalMessageId: messageId });
  } catch (secondErr) {
    logger.warn(
      { outboxId, messageId, error: secondErr },
      'OUTBOX-023: Failed to record outbox receipt after retry — pick_publish may be stale'
    );
  }
}

/**
 * Record failed Discord post in outbox.
 */
async function recordOutboxFailure(
  outboxId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  try {
    await markOutboxFailed(supabase, outboxId, { errorCode, errorMessage });
  } catch (err) {
    logger.error(
      { outboxId, error: err },
      'OUTBOX-023: Failed to record outbox failure (non-fatal)'
    );
  }
}

function getMatchupFromPick(pick: any): string | null {
  // Priority 1: Direct matchup field
  if (pick.matchup) return pick.matchup;

  // Priority 2: manual_fields_blob.matchup (from Smart Form)
  if (pick.manual_fields_blob?.matchup) return pick.manual_fields_blob.matchup;

  // Priority 3: Construct from manual_matchup_home/away
  if (pick.manual_matchup_home && pick.manual_matchup_away) {
    return `${pick.manual_matchup_away} @ ${pick.manual_matchup_home}`;
  }

  // Priority 4: meta.matchup
  const meta = pick.meta || {};
  if (meta.matchup) return meta.matchup;

  return null;
}

// ML-DISPLAY-FIX-001: Check if this is a moneyline bet
function isMoneylineBet(pick: any): boolean {
  const statType = (pick.stat_type || '').toLowerCase();
  const betType = (pick.bet_type || '').toLowerCase();
  const mlTypes = ['moneyline', 'ml', 'money line', 'winner', 'to_win'];
  return mlTypes.some(t => statType.includes(t) || betType.includes(t));
}

// ML-DISPLAY-FIX-001: Format pick details based on bet type
function formatPickDetails(pick: any): string {
  const isMl = isMoneylineBet(pick);

  if (isMl) {
    // For ML picks: show selection and odds prominently
    return `**${pick.selection || pick.player_name}** (${formatOdds(pick.odds)})`;
  }

  // For player props and spreads: show player, stat, line
  const lineDisplay =
    pick.line !== null && pick.line !== undefined && pick.line !== 0 ? ` ${pick.line}` : '';
  const direction = pick.direction?.toUpperCase() || pick.side || '';

  return `**${pick.player_name || pick.selection}**\n${pick.stat_type} ${direction}${lineDisplay}`;
}

function getMarketTypeLabel(pick: any): string {
  const statType = (pick.stat_type || '').toLowerCase();
  const betType = (pick.bet_type || '').toLowerCase();

  if (statType.includes('points') || betType.includes('total')) return 'Total Points';
  if (statType.includes('moneyline') || betType.includes('ml')) return 'Money Line';
  if (statType.includes('spread') || betType.includes('spread')) return 'Spread';
  if (statType) return statType.charAt(0).toUpperCase() + statType.slice(1).replace(/_/g, ' ');
  return 'Player Prop';
}

function formatGameTime(pick: any): string | null {
  const gameTime = pick.game_time || pick.game_date || pick.meta?.game_time;
  if (!gameTime) return null;

  try {
    const date = new Date(gameTime);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase();
    return `(${month} ${day}, ${year}, ${time})`;
  } catch {
    return null;
  }
}

function getCapperFromPick(pick: any): string {
  const meta = pick.meta || {};
  return meta.capper || pick.capper_username || pick.capper || 'Unit Talk';
}

// PARLAY-PRESENTATION-REFINE-001: Get short market label for parlay leg
// eslint-disable-next-line complexity
function getParlayLegMarketLabel(leg: any): string {
  const statType = (leg.stat_type || '').toLowerCase();
  const betType = (leg.bet_type || '').toLowerCase();

  if (statType.includes('moneyline') || betType.includes('ml') || statType === 'ml') return 'ML';
  if (statType.includes('spread') || betType.includes('spread')) {
    const line =
      leg.line !== null && leg.line !== undefined ? ` ${leg.line > 0 ? '+' : ''}${leg.line}` : '';
    return `Spread${line}`;
  }
  if (
    statType.includes('total') ||
    betType.includes('total') ||
    statType.includes('over') ||
    statType.includes('under')
  ) {
    const direction = (leg.direction || leg.side || '').toUpperCase();
    const line = leg.line !== null && leg.line !== undefined ? ` ${leg.line}` : '';
    return direction ? `${direction}${line}` : `Total${line}`;
  }
  // Player prop: show stat type
  if (statType) {
    const direction = (leg.direction || leg.side || '').toUpperCase();
    const line = leg.line !== null && leg.line !== undefined ? ` ${leg.line}` : '';
    return `${statType.charAt(0).toUpperCase() + statType.slice(1).replace(/_/g, ' ')}${direction ? ' ' + direction : ''}${line}`;
  }
  return '';
}

// PARLAY-DISCORD-FIX-001: Build parlay embed from multiple legs
// PARLAY-PRESENTATION-REFINE-001: Clean block format without "Leg X:" labels
// EMBED-FIX-031: Removed "Sports" field per production contract
function buildParlayEmbed(legs: any[]) {
  const capper = getCapperFromPick(legs[0]);
  const totalOdds = calculateParlayOdds(legs.map(l => l.odds || -110));
  const totalUnits = legs[0].unit_size || legs[0].units || 1;
  const highestTier = legs.reduce((best, leg) => {
    const tiers = ['S', 'A', 'B', 'C', 'D'];
    const legTier = leg.tier || 'C';
    const bestIdx = tiers.indexOf(best);
    const legIdx = tiers.indexOf(legTier);
    return legIdx < bestIdx ? legTier : best;
  }, 'D');

  // PARLAY-PRESENTATION-REFINE-001: Format each leg with clean block format
  // Format: Selection + Market Label (Odds)
  //         Matchup
  const legsText = legs
    .map(leg => {
      const matchup = getMatchupFromPick(leg);
      const selection = leg.selection || leg.player_name || 'Unknown';
      const marketLabel = getParlayLegMarketLabel(leg);
      const oddsStr = formatOdds(leg.odds);

      // Line 1: Selection + Market Label + (Odds)
      const line1 = marketLabel
        ? `**${selection} ${marketLabel}** (${oddsStr})`
        : `**${selection}** (${oddsStr})`;

      // Line 2: Matchup
      const line2 = matchup || '';

      return line2 ? `${line1}\n${line2}` : line1;
    })
    .join('\n\n');

  // EMBED-PRODUCTION-CONTRACT-030: Production footer with build info
  const footer = buildProductionFooter();

  // EMBED-FIX-031: Removed "Sports" field - redundant with matchup info
  return {
    title: `🔥 ${legs.length}-Leg Parlay`,
    color: highestTier === 'S' ? 0xff5252 : highestTier === 'A' ? 0x66bb6a : 0xfbc02d,
    fields: [
      { name: 'Legs', value: legsText, inline: false },
      { name: 'Total Odds', value: `${formatOdds(totalOdds)}`, inline: true },
      { name: 'Units', value: formatUnit(totalUnits), inline: true },
      { name: 'Tier', value: `${highestTier}-Tier`, inline: true },
      { name: 'Capper', value: capper, inline: true },
    ],
    footer: { text: footer },
  };
}

/**
 * DISCORD-UX-OVERHAUL-001: Build embed from PickPresentation
 * Uses the standardized presentation format for consistent Discord display.
 * @see docs/contracts/PICK_PRESENTATION_STANDARD.md
 */
function buildEmbedFromPresentation(presentation: PickPresentation) {
  const tierColors: Record<string, number> = {
    S: 0x4fc3f7, // Cyan for S-tier
    A: 0x66bb6a, // Green for A-tier
    B: 0xfbc02d, // Yellow for B-tier
    C: 0xff9800, // Orange for C-tier
    D: 0x9e9e9e, // Gray for D-tier
  };

  const color = tierColors[presentation.tier] || 0xfbc02d;

  // Build embed fields - only include non-empty values
  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: 'Odds', value: presentation.odds_american, inline: true },
    { name: 'Units', value: presentation.units, inline: true },
    { name: 'Tier', value: `${presentation.tier}-Tier`, inline: true },
  ];

  // Add capper field
  if (presentation.capper_name && presentation.capper_name !== 'Unit Talk') {
    fields.push({ name: 'Capper', value: presentation.capper_name, inline: true });
  }

  // EMBED-PRODUCTION-CONTRACT-030: Production footer with build info
  const footer = buildProductionFooter();

  const embed: any = {
    // DISCORD-UX-OVERHAUL-001: Title is now the actual pick (e.g., "Texas Tech", "Furman -3.5", "Over 220.5")
    title: `🎯 ${presentation.title}`,
    color,
    // Market label as description line 1, context as line 2
    description: `**${presentation.market_label}**\n${presentation.context_line}`,
    fields,
    footer: { text: footer },
  };

  // Add thumbnail if available (team logo or player headshot)
  if (presentation.thumbnail_url) {
    embed.thumbnail = { url: presentation.thumbnail_url };
  }

  return embed;
}

/**
 * Legacy buildEliteEmbed - kept for backward compatibility with parlay detection
 * Single picks now use buildEmbedFromPresentation via postEliteCardToDiscord
 */
// eslint-disable-next-line complexity
function buildEliteEmbed(pick: any) {
  const matchup = getMatchupFromPick(pick);
  const _isMl = isMoneylineBet(pick);
  const marketType = getMarketTypeLabel(pick);
  const gameTime = formatGameTime(pick);
  const capper = getCapperFromPick(pick);
  const sport = pick.sport || pick.league || 'Sports';

  // EMBED-PRODUCTION-CONTRACT-030: Production footer with build info
  const footer = buildProductionFooter();

  // PARLAY-DISCORD-FIX-001: Legacy parlay detection (now handled upstream)
  if (Array.isArray(pick.legs) && pick.legs.length > 1) {
    const contextLine = [sport, matchup, gameTime].filter(Boolean).join(' • ');
    return {
      title: `🔥 ${pick.legs.length}-Leg Parlay`,
      color: 0xff5252,
      image: { url: 'attachment://pick.png' },
      fields: [
        { name: 'Odds', value: `${formatOdds(pick.odds)}`, inline: true },
        { name: 'Units', value: formatUnit(pick.unit_size), inline: true },
        { name: 'Tier', value: `${pick.tier || 'N/A'}-Tier`, inline: true },
        { name: 'Capper', value: capper, inline: true },
      ],
      description: contextLine ? `${contextLine}` : undefined,
      footer: { text: footer },
    };
  }

  // Build context line: League • Matchup • (Date, Time)
  const contextParts = [sport];
  if (matchup) contextParts.push(matchup);
  if (gameTime) contextParts.push(gameTime);
  const contextLine = contextParts.join(' • ');

  // DISCORD-UX-OVERHAUL-001: Removed direction field, using new title format
  // This legacy path is only for fallback - main path uses buildEmbedFromPresentation
  const pickDetails = formatPickDetails(pick);

  return {
    title: '🎯 PICK ALERT',
    color: pick.tier === 'S' ? 0x4fc3f7 : pick.tier === 'A' ? 0x66bb6a : 0xfbc02d,
    image: { url: 'attachment://pick.png' },
    fields: [
      { name: 'Selection', value: pickDetails, inline: false },
      { name: 'Odds', value: `${formatOdds(pick.odds)}`, inline: true },
      { name: 'Market', value: marketType, inline: true },
      { name: 'Units', value: formatUnit(pick.unit_size), inline: true },
      { name: 'Capper', value: capper, inline: true },
      { name: 'Tier', value: `${pick.tier || 'N/A'}-Tier`, inline: true },
    ],
    description: contextLine,
    footer: { text: footer },
  };
}

// ---- POSTER ----
/**
 * DISCORD-UX-OVERHAUL-001: Post single pick to Discord using PickPresentation standard
 * Uses buildPickPresentation for consistent display format.
 * PARLAY-DISCORD-GROUPING-001: Returns message_id for storage
 */
// eslint-disable-next-line max-lines-per-function, complexity
async function postEliteCardToDiscord(pick: any): Promise<string | null> {
  // SPRINT-SCORING-PIPELINE-ACTIVATION-018: Promotion guardrail (P0)
  // Fail-closed: block any pick that should not reach Discord.
  // Must run BEFORE autopilot guard to prevent any bypass.
  if (pick.tier === 'F') {
    throw new BlockedError(
      'BLOCKED_PROMOTION_INELIGIBLE',
      `Pick ${pick.id} blocked: tier F cannot be posted to Discord`
    );
  }
  if (!pick.promotion_band) {
    throw new BlockedError(
      'BLOCKED_PROMOTION_INELIGIBLE',
      `Pick ${pick.id} blocked: promotion_band is missing or NULL`
    );
  }
  if (pick.promotion_band !== 'HARD') {
    throw new BlockedError(
      'BLOCKED_PROMOTION_INELIGIBLE',
      `Pick ${pick.id} blocked: promotion_band is '${pick.promotion_band}', must be 'HARD'`
    );
  }

  if (!getDiscordWebhookUrl()) {
    logger.error('No Discord webhook URL set!');
    return null;
  }

  const guardResult = await autopilotGuard.assertMayPerformSideEffect({
    action: 'DISCORD_POST',
    agent_name: 'DiscordPromotionAgent',
    pick_id: pick.id,
    metadata: { tier: pick.tier, player: pick.player_name },
  });
  if (!guardResult.allowed) {
    logger.info(
      { pickId: pick.id, reason: guardResult.reason },
      'Discord post blocked by AutopilotGuard'
    );
    return null;
  }

  // EMBED-TRUTH-FIX-031: Posting gate validation - refuse to post if critical fields missing
  const postingGate = validatePostingGate({
    player_name: pick.player_name,
    team: pick.team,
    selection: pick.selection,
    stat_type: pick.stat_type,
    bet_type: pick.bet_type,
    line: pick.line,
    direction: pick.direction || pick.side,
  });

  if (!postingGate.canPost) {
    logger.error(
      {
        pickId: pick.id,
        violations: postingGate.violations,
        marketType: postingGate.marketType,
        parsedFields: postingGate.parsedFields,
      },
      'EMBED-TRUTH-FIX-031: Posting gate BLOCKED - missing required fields'
    );
    return null;
  }

  if (postingGate.warnings.length > 0) {
    logger.warn(
      {
        pickId: pick.id,
        warnings: postingGate.warnings,
        marketType: postingGate.marketType,
      },
      'EMBED-TRUTH-FIX-031: Posting gate warnings'
    );
  }

  // SPRINT-EMBED-MIN-REQ-GATE-ENFORCEMENT-051: Embed readiness gate
  const embedReadiness = assertEmbedReadiness({
    id: pick.id,
    sport: pick.sport,
    league: pick.league,
    matchup: pick.matchup,
    manual_matchup_home: pick.manual_matchup_home,
    manual_matchup_away: pick.manual_matchup_away,
    manual_fields_blob: pick.manual_fields_blob,
    meta: pick.meta,
    game_date: pick.game_date,
    manual_game_date: pick.manual_game_date,
    game_time: pick.game_time,
    game_start_time: pick.game_start_time,
    placed_at: pick.placed_at,
    selection: pick.selection,
    title: pick.title,
    line: pick.line,
    direction: pick.direction,
  });

  if (!embedReadiness.ready) {
    logger.error(
      {
        pickId: pick.id,
        mode: embedReadiness.mode,
        missingFields: embedReadiness.missingFields,
        violations: embedReadiness.violations,
      },
      'EMBED-MIN-REQ-051: Embed readiness gate BLOCKED'
    );

    // In strict mode, write audit log and set blocked_reason
    if (isEmbedStrictMode()) {
      await supabase.from('audit_log').insert({
        actor: 'DiscordPromotionAgent',
        action: 'EMBED_READINESS_BLOCKED',
        entity_type: 'unified_picks',
        entity_id: pick.id,
        details: {
          mode: embedReadiness.mode,
          missing_fields: embedReadiness.missingFields,
          violations: embedReadiness.violations,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });

      // Set blocked_reason on pick
      await lifecycleUpdate(
        supabase,
        pick.id,
        {
          blocked_reason: `EMBED_READINESS: ${embedReadiness.missingFields.join(', ')}`,
        },
        {
          writerRole: 'poster',
          traceId: `embed-readiness-${pick.id}`,
          skipTransitionValidation: true,
        }
      );
    }

    return null;
  }

  // Log warnings for soft mode fallbacks
  if (embedReadiness.warnings.length > 0) {
    logger.warn(
      {
        pickId: pick.id,
        mode: embedReadiness.mode,
        warnings: embedReadiness.warnings,
        sanitizedValues: embedReadiness.sanitizedValues,
      },
      'EMBED-MIN-REQ-051: Embed readiness warnings (using fallbacks)'
    );

    // Audit log for soft mode fallbacks
    await supabase.from('audit_log').insert({
      actor: 'DiscordPromotionAgent',
      action: 'EMBED_READINESS_FALLBACK',
      entity_type: 'unified_picks',
      entity_id: pick.id,
      details: {
        mode: embedReadiness.mode,
        warnings: embedReadiness.warnings,
        sanitized_values: embedReadiness.sanitizedValues,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  }

  // EMBED-TRUTH-FIX-031: Build provenance validation
  const buildInfo = getBuildInfo('DiscordPromotionAgent');
  const provenanceCheck = validateBuildProvenance(buildInfo.commitShort, buildInfo.environment);
  if (!provenanceCheck.valid) {
    logger.error(
      {
        pickId: pick.id,
        commitShort: buildInfo.commitShort,
        environment: buildInfo.environment,
        error: provenanceCheck.error,
      },
      'EMBED-TRUTH-FIX-031: Build provenance validation FAILED'
    );
    // In production, this is a hard block. In dev, we allow it.
    if (buildInfo.environment === 'production') {
      return null;
    }
  }

  try {
    // DISCORD-UX-OVERHAUL-001: Build presentation-ready format
    const presentation = await buildPickPresentation(pick);

    // EMBED-FIX-031: Validate presentation before posting
    const presentationValidation = validatePickPresentation({
      title: presentation.title,
      market_label: presentation.market_label,
      market_type: presentation.market_type,
      thumbnail_url: presentation.thumbnail_url,
      context_line: presentation.context_line,
    });

    if (!presentationValidation.valid) {
      logger.error(
        {
          pickId: pick.id,
          violations: presentationValidation.violations,
        },
        'EMBED-FIX-031: Presentation validation failed - blocking post'
      );
      return null;
    }

    if (presentationValidation.warnings.length > 0) {
      logger.warn(
        {
          pickId: pick.id,
          warnings: presentationValidation.warnings,
        },
        'EMBED-FIX-031: Presentation validation warnings'
      );
    }

    logger.info(
      {
        pickId: pick.id,
        title: presentation.title,
        marketType: presentation.market_type,
        marketLabel: presentation.market_label,
      },
      'DISCORD-UX-OVERHAUL-001: Built pick presentation'
    );

    // Build embed from presentation
    const embed = buildEmbedFromPresentation(presentation);

    // PARLAY-DISCORD-GROUPING-001: Use ?wait=true to get message_id
    // SPRINT-SCHEMA-ENV-GATES-002: Use requireDiscordWebhookUrl for fail-closed posting
    const response = await axios.post(`${requireDiscordWebhookUrl()}?wait=true`, {
      username: 'Unit Talk Picks',
      embeds: [embed],
    });
    const messageId = response.data?.id || null;

    logger.info(
      { pickId: pick.id, title: presentation.title, messageId },
      'Posted pick to Discord'
    );
    return messageId;
  } catch (err: any) {
    logger.error({ id: pick.id, error: err?.message || err }, 'Discord post error');

    // Fallback to legacy embed if presentation fails
    try {
      const form = new FormData();
      form.append('file', await generateEliteCard(pick), {
        filename: 'pick.png',
        contentType: 'image/png',
      });
      form.append(
        'payload_json',
        JSON.stringify({ username: 'Unit Talk Picks', embeds: [buildEliteEmbed(pick)] })
      );
      // SPRINT-SCHEMA-ENV-GATES-002: Use requireDiscordWebhookUrl for fail-closed posting
      const fallbackResponse = await axios.post(`${requireDiscordWebhookUrl()}?wait=true`, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      const fallbackMsgId = fallbackResponse.data?.id || null;
      logger.info(
        { pickId: pick.id, messageId: fallbackMsgId },
        'Posted pick to Discord (legacy fallback)'
      );
      return fallbackMsgId;
    } catch (fallbackErr: any) {
      logger.error(
        { id: pick.id, error: fallbackErr?.message || fallbackErr },
        'Discord fallback post error'
      );
      return null;
    }
  }
}

// PARLAY-DISCORD-FIX-001: Post parlay to Discord
// PARLAY-DISCORD-GROUPING-001: Returns message_id for storage
// eslint-disable-next-line max-lines-per-function, complexity
async function postParlayToDiscord(legs: any[]): Promise<string | null> {
  if (!getDiscordWebhookUrl()) {
    logger.error('No Discord webhook URL set!');
    return null;
  }

  const primaryLeg = legs[0];
  const guardResult = await autopilotGuard.assertMayPerformSideEffect({
    action: 'DISCORD_POST',
    agent_name: 'DiscordPromotionAgent',
    pick_id: primaryLeg.id,
    metadata: {
      tier: primaryLeg.tier,
      parlay_legs: legs.length,
      bet_slip_id: primaryLeg.bet_slip_id,
    },
  });
  if (!guardResult.allowed) {
    logger.info(
      { betSlipId: primaryLeg.bet_slip_id, reason: guardResult.reason },
      'Discord parlay post blocked by AutopilotGuard'
    );
    return null;
  }

  // EMBED-TRUTH-FIX-031: Validate ALL legs pass posting gate
  for (const leg of legs) {
    const postingGate = validatePostingGate({
      player_name: leg.player_name,
      team: leg.team,
      selection: leg.selection,
      stat_type: leg.stat_type,
      bet_type: leg.bet_type,
      line: leg.line,
      direction: leg.direction || leg.side,
    });

    if (!postingGate.canPost) {
      logger.error(
        {
          betSlipId: primaryLeg.bet_slip_id,
          legId: leg.id,
          legIndex: leg.leg_index,
          violations: postingGate.violations,
          marketType: postingGate.marketType,
          parsedFields: postingGate.parsedFields,
        },
        'EMBED-TRUTH-FIX-031: Parlay leg BLOCKED by posting gate - missing required fields'
      );
      return null;
    }
  }

  // SPRINT-EMBED-MIN-REQ-GATE-ENFORCEMENT-051: Embed readiness gate for ALL parlay legs
  for (const leg of legs) {
    const embedReadiness = assertEmbedReadiness({
      id: leg.id,
      sport: leg.sport,
      league: leg.league,
      matchup: leg.matchup,
      manual_matchup_home: leg.manual_matchup_home,
      manual_matchup_away: leg.manual_matchup_away,
      manual_fields_blob: leg.manual_fields_blob,
      meta: leg.meta,
      game_date: leg.game_date,
      manual_game_date: leg.manual_game_date,
      game_time: leg.game_time,
      game_start_time: leg.game_start_time,
      placed_at: leg.placed_at,
      selection: leg.selection,
      title: leg.title,
      line: leg.line,
      direction: leg.direction,
    });

    if (!embedReadiness.ready) {
      logger.error(
        {
          betSlipId: primaryLeg.bet_slip_id,
          legId: leg.id,
          legIndex: leg.leg_index,
          mode: embedReadiness.mode,
          missingFields: embedReadiness.missingFields,
          violations: embedReadiness.violations,
        },
        'EMBED-MIN-REQ-051: Parlay leg BLOCKED by embed readiness gate'
      );

      if (isEmbedStrictMode()) {
        await supabase.from('audit_log').insert({
          actor: 'DiscordPromotionAgent',
          action: 'EMBED_READINESS_BLOCKED',
          entity_type: 'unified_picks',
          entity_id: leg.id,
          details: {
            mode: embedReadiness.mode,
            parlay_bet_slip_id: primaryLeg.bet_slip_id,
            leg_index: leg.leg_index,
            missing_fields: embedReadiness.missingFields,
            violations: embedReadiness.violations,
            timestamp: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        });

        await lifecycleUpdate(
          supabase,
          leg.id,
          {
            blocked_reason: `EMBED_READINESS: ${embedReadiness.missingFields.join(', ')}`,
          },
          {
            writerRole: 'poster',
            traceId: `embed-readiness-parlay-${leg.id}`,
            skipTransitionValidation: true,
          }
        );
      }

      return null;
    }

    if (embedReadiness.warnings.length > 0) {
      logger.warn(
        {
          betSlipId: primaryLeg.bet_slip_id,
          legId: leg.id,
          legIndex: leg.leg_index,
          mode: embedReadiness.mode,
          warnings: embedReadiness.warnings,
          sanitizedValues: embedReadiness.sanitizedValues,
        },
        'EMBED-MIN-REQ-051: Parlay leg readiness warnings (using fallbacks)'
      );
    }
  }

  // EMBED-TRUTH-FIX-031: Build provenance validation for parlays
  const buildInfo = getBuildInfo('DiscordPromotionAgent');
  const provenanceCheck = validateBuildProvenance(buildInfo.commitShort, buildInfo.environment);
  if (!provenanceCheck.valid && buildInfo.environment === 'production') {
    logger.error(
      {
        betSlipId: primaryLeg.bet_slip_id,
        commitShort: buildInfo.commitShort,
        environment: buildInfo.environment,
        error: provenanceCheck.error,
      },
      'EMBED-TRUTH-FIX-031: Parlay build provenance validation FAILED'
    );
    return null;
  }

  try {
    // PARLAY-DISCORD-GROUPING-001: Use ?wait=true to get message_id back
    // SPRINT-SCHEMA-ENV-GATES-002: Use requireDiscordWebhookUrl for fail-closed posting
    const response = await axios.post(`${requireDiscordWebhookUrl()}?wait=true`, {
      username: 'Unit Talk Picks',
      embeds: [buildParlayEmbed(legs)],
    });
    const messageId = response.data?.id || null;
    logger.info(
      { betSlipId: primaryLeg.bet_slip_id, legCount: legs.length, messageId },
      'Posted parlay to Discord'
    );
    return messageId;
  } catch (err: any) {
    logger.error(
      { betSlipId: primaryLeg.bet_slip_id, error: err?.message || err },
      'Discord parlay post error'
    );
    return null;
  }
}

// ---- CLAIM + RECEIPT ----
// LIFECYCLE-WRITE-SURFACE-MIGRATION-038: Use lifecycle idempotency adapter

/**
 * SPRINT-REAL-DISCORD-RECEIPT-PROOF-049: Validate Discord snowflake ID
 * Discord message IDs are numeric snowflakes (17-20 digits).
 * Reject stub IDs like "GAUNTLET-MSG-*" or "webhook-receipt-*".
 */
function isValidDiscordSnowflake(messageId: string | null | undefined): boolean {
  if (!messageId) return false;
  // Discord snowflakes are 17-20 digit numeric strings
  return /^\d{17,20}$/.test(messageId);
}

/**
 * SPRINT-REAL-DISCORD-RECEIPT-PROOF-049: Confirm post with real Discord ID
 * Sets discord_message_id column ONLY if we have a valid numeric snowflake.
 * This enforces fail-closed: no stub IDs allowed.
 */
async function confirmPostWithReceipt(
  pickId: string,
  messageId: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!isValidDiscordSnowflake(messageId)) {
    logger.error(
      { pickId, messageId },
      'REAL-DISCORD-RECEIPT-049: Invalid Discord message ID (not a numeric snowflake)'
    );
    return { success: false, error: `Invalid Discord ID: ${messageId}` };
  }

  // Update discord_message_id column with validated snowflake
  const result = await lifecycleUpdate(
    supabase,
    pickId,
    {
      discord_message_id: messageId,
    },
    {
      writerRole: 'poster',
      traceId: `confirm-post-${pickId}`,
      skipTransitionValidation: true,
    }
  );

  if (!result.success) {
    logger.error(
      { pickId, messageId, error: result.error },
      'REAL-DISCORD-RECEIPT-049: Failed to save discord_message_id'
    );
    return { success: false, error: result.error };
  }

  logger.info(
    { pickId, messageId },
    'REAL-DISCORD-RECEIPT-049: Confirmed post with valid Discord snowflake'
  );
  return { success: true };
}

/**
 * SPRINT-REAL-DISCORD-RECEIPT-PROOF-049: Reset posting claim on failure
 * If Discord call fails, we must reset posted_to_discord to false
 * so the pick can be retried.
 */
async function resetPostingOnFailure(pickId: string, reason: string): Promise<void> {
  try {
    const updateResult = await lifecycleUpdate(
      supabase,
      pickId,
      { posted_to_discord: false, promotion_posted_at: null },
      { writerRole: 'poster', skipTransitionValidation: true }
    );

    if (!updateResult.success) {
      logger.error(
        { pickId, error: updateResult.error },
        'REAL-DISCORD-RECEIPT-049: Failed to reset posting claim'
      );
    } else {
      logger.warn(
        { pickId, reason },
        'REAL-DISCORD-RECEIPT-049: Reset posting claim (Discord call failed)'
      );
    }

    // Write audit log entry
    await supabase.from('audit_log').insert({
      actor: 'DiscordPromotionAgent',
      action: 'DISCORD_POST_FAILED',
      entity_type: 'unified_picks',
      entity_id: pickId,
      details: {
        reason,
        reset_posted_to_discord: true,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(
      { pickId, error: err instanceof Error ? err.message : String(err) },
      'REAL-DISCORD-RECEIPT-049: Error in resetPostingOnFailure'
    );
  }
}

async function claimPick(pickId: string): Promise<boolean> {
  const result = await atomicClaimForPost(supabase, pickId);
  if (!result.claimed) {
    logger.info({ id: pickId }, 'Pick already claimed — skipping (idempotent)');
    return false;
  }
  return true;
}

// PARLAY-DISCORD-FIX-001: Claim all parlay legs atomically
// LIFECYCLE-WRITE-SURFACE-MIGRATION-038: Use lifecycle idempotency adapter
async function claimParlayLegs(pickIds: string[]): Promise<boolean> {
  const result = await atomicClaimParlayForPost(supabase, pickIds);
  if (!result.claimed) {
    logger.info({ pickIds }, 'Parlay legs already claimed — skipping (idempotent)');
    return false;
  }
  // Lifecycle adapter already logs partial claims
  return result.claimedCount > 0;
}

// PARLAY-DISCORD-GROUPING-001: Added message_id, ticket_type, leg_count params
// EMBED-PRODUCTION-CONTRACT-030: Added commit_sha to discord receipt
// LIFECYCLE-WRITE-SURFACE-MIGRATION-038: Use lifecycle adapter for meta update
async function persistDiscordReceipt(
  pickId: string,
  receipt: {
    channel_id?: string;
    poster: string;
    message_id?: string;
    ticket_type?: 'single' | 'parlay';
    leg_count?: number;
  }
) {
  try {
    const buildInfo = getBuildInfo('DiscordPromotionAgent');
    const { data: cur } = await supabase
      .from('unified_picks')
      .select('meta')
      .eq('id', pickId)
      .single();
    const meta = {
      ...((cur?.meta as Record<string, any>) || {}),
      discord_receipt: {
        ...receipt,
        posted_at: new Date().toISOString(),
        commit_sha: buildInfo.commit,
        commit_short: buildInfo.commitShort,
        environment: buildInfo.environment,
      },
    };
    const result = await lifecycleUpdate(
      supabase,
      pickId,
      { meta },
      {
        writerRole: 'poster',
        traceId: `discord-receipt-${pickId}`,
        skipTransitionValidation: true, // Meta update doesn't change stage
      }
    );
    if (!result.success) {
      logger.warn({ pickId, error: result.error }, 'Failed to persist discord receipt');
    }
  } catch (err) {
    logger.warn({ pickId }, 'Failed to persist discord receipt (non-fatal)');
  }
}

// ---- POSTING AUTHORITY ROUTER ----
// POSTING-AUTHORITY-001: Origin-gated posting per POSTING_AUTHORITY_CONTRACT.md

/** Rule 1: Capper picks ALWAYS post — no band/tier/score gate */
/** PARLAY-DISCORD-GROUPING-001: Always query ALL legs by bet_slip_id before posting */
// eslint-disable-next-line max-lines-per-function, complexity, max-depth
async function processCapperPicks(): Promise<number> {
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('posted_to_discord', false)
    .eq('meta->>pick_origin', 'capper')
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) {
    logger.error(error, 'Error fetching capper picks');
    return 0;
  }
  if (!picks?.length) return 0;

  // PARLAY-DISCORD-GROUPING-001: Track unique bet_slip_ids to process
  const processedBetSlips = new Set<string>();
  let processedCount = 0;

  for (const pick of picks) {
    const betSlipId = pick.bet_slip_id || pick.id;

    // Skip if we already processed this bet_slip in this cycle
    if (processedBetSlips.has(betSlipId)) continue;
    processedBetSlips.add(betSlipId);

    const meta = (pick.meta as Record<string, any>) || {};
    const capper = meta.capper || pick.capper_username || pick.capper || 'unknown';

    // PARLAY-DISCORD-GROUPING-001: Check if this is a parlay by querying ALL legs
    const isParlay = pick.ticket_type === 'parlay';

    if (isParlay) {
      // Fetch ALL legs from DB (regardless of posted_to_discord status)
      const { data: allLegs, error: legsError } = await supabase
        .from('unified_picks')
        .select('*')
        .eq('bet_slip_id', betSlipId)
        .order('leg_index', { ascending: true });

      if (legsError || !allLegs?.length) {
        logger.error({ betSlipId, error: legsError }, 'Failed to fetch parlay legs');
        continue;
      }

      // IDEMPOTENCY: If ANY leg already posted, skip entire parlay
      const anyPosted = allLegs.some(
        leg => leg.posted_to_discord === true || leg.meta?.discord_receipt?.message_id
      );
      if (anyPosted) {
        logger.info(
          { betSlipId, legCount: allLegs.length },
          'PARLAY-DISCORD-GROUPING-001: Parlay already posted — skipping (idempotent)'
        );
        continue;
      }

      // Claim ALL legs atomically
      const pickIds = allLegs.map(l => l.id);
      if (!(await claimParlayLegs(pickIds))) continue;

      logger.info(
        { betSlipId, legCount: allLegs.length, capper },
        'PARLAY-DISCORD-GROUPING-001: Posting parlay as SINGLE Discord message'
      );

      // EXECUTION-TELEMETRY-ACTIVATION-003: Resolve routing for telemetry
      const routingConfig = resolveDiscordRoutingConfig();
      const targetSurface = resolveTargetSurface(routingConfig.mode, 'TRADER_INSIGHTS');
      const requestStartTime = Date.now();

      // EXECUTION-TELEMETRY-ACTIVATION-003: Create telemetry BEFORE POST for all legs
      for (const leg of allLegs) {
        await createExecutionTelemetry(supabase, {
          pickId: leg.id,
          routeType: 'WEBHOOK',
          targetSurface,
          targetChannelId: `capper-thread:${capper}`,
          entryLine: leg.line,
          entryOdds: leg.odds,
          entryBook: leg.provider || null,
        });
      }

      if (isPromotionShadowMode()) {
        logger.info(
          { betSlipId, legCount: allLegs.length, capper, origin: 'capper' },
          'Shadow mode — skipped capper parlay post'
        );
      } else {
        const messageId = await postParlayToDiscord(allLegs);
        const publishLatencyMs = Date.now() - requestStartTime;

        // SPRINT-REAL-DISCORD-RECEIPT-PROOF-049: Validate and confirm with real snowflake
        if (!isValidDiscordSnowflake(messageId)) {
          logger.error(
            { betSlipId, messageId, legCount: allLegs.length },
            'REAL-DISCORD-RECEIPT-049: Parlay post failed - invalid Discord ID'
          );
          // Reset all legs since Discord call failed
          for (const leg of allLegs) {
            await resetPostingOnFailure(leg.id, `Parlay post returned invalid ID: ${messageId}`);
            // EXECUTION-TELEMETRY-ACTIVATION-003: Record failure
            await updateExecutionTelemetryFailed(supabase, {
              pickId: leg.id,
              errorMessage: `Parlay post returned invalid ID: ${messageId}`,
              executionNotes: 'PARLAY_DISCORD_POST_FAILED',
            });
          }
          continue;
        }

        // Confirm post and persist receipt on ALL legs with valid snowflake
        for (const leg of allLegs) {
          await confirmPostWithReceipt(leg.id, messageId);
          await persistDiscordReceipt(leg.id, {
            poster: 'DiscordPromotionAgent',
            channel_id: `capper-thread:${capper}`,
            message_id: messageId,
            ticket_type: 'parlay',
            leg_count: allLegs.length,
          });
          // EXECUTION-TELEMETRY-ACTIVATION-003: Update with receipt
          await updateExecutionTelemetryPublished(supabase, {
            pickId: leg.id,
            discordMessageId: messageId!,
            publishLatencyMs,
          });
        }
      }
      processedCount += allLegs.length;
    } else {
      // Single pick — post normally
      if (!(await claimPick(pick.id))) continue;

      // EXECUTION-TELEMETRY-ACTIVATION-003: Resolve routing for telemetry
      const singleRoutingConfig = resolveDiscordRoutingConfig();
      const singleTargetSurface = resolveTargetSurface(singleRoutingConfig.mode, 'TRADER_INSIGHTS');
      const singleRequestStartTime = Date.now();

      // EXECUTION-TELEMETRY-ACTIVATION-003: Create telemetry BEFORE POST
      await createExecutionTelemetry(supabase, {
        pickId: pick.id,
        routeType: 'WEBHOOK',
        targetSurface: singleTargetSurface,
        targetChannelId: `capper-thread:${capper}`,
        entryLine: pick.line,
        entryOdds: pick.odds,
        entryBook: pick.provider || null,
      });

      if (isPromotionShadowMode()) {
        logger.info({ id: pick.id, capper, origin: 'capper' }, 'Shadow mode — skipped capper post');
      } else {
        // SPRINT-023-PRODUCTION-SURFACE-LOCK: Outbox-first publishing
        const outbox = await enqueuePickToOutbox(pick, `capper-thread:${capper}`);
        if (outbox.alreadyPosted) {
          logger.info({ pickId: pick.id }, 'OUTBOX-023: Already posted per outbox — skipping');
          continue;
        }

        const messageId = await postEliteCardToDiscord(pick);
        const singlePublishLatencyMs = Date.now() - singleRequestStartTime;

        // SPRINT-REAL-DISCORD-RECEIPT-PROOF-049: Validate and confirm with real snowflake
        if (!isValidDiscordSnowflake(messageId)) {
          logger.error(
            { pickId: pick.id, messageId },
            'REAL-DISCORD-RECEIPT-049: Single pick post failed - invalid Discord ID'
          );
          await resetPostingOnFailure(pick.id, `Post returned invalid ID: ${messageId}`);
          await recordOutboxFailure(
            outbox.outboxId,
            'INVALID_DISCORD_ID',
            `Post returned invalid ID: ${messageId}`
          );
          // EXECUTION-TELEMETRY-ACTIVATION-003: Record failure
          await updateExecutionTelemetryFailed(supabase, {
            pickId: pick.id,
            errorMessage: `Post returned invalid ID: ${messageId}`,
            executionNotes: 'SINGLE_DISCORD_POST_FAILED',
          });
          continue;
        }

        // OUTBOX-023: Record receipt in outbox BEFORE confirming on pick
        await recordOutboxReceipt(outbox.outboxId, messageId!);

        await confirmPostWithReceipt(pick.id, messageId);
        await persistDiscordReceipt(pick.id, {
          poster: 'DiscordPromotionAgent',
          channel_id: `capper-thread:${capper}`,
          message_id: messageId,
          ticket_type: 'single',
          leg_count: 1,
        });
        // EXECUTION-TELEMETRY-ACTIVATION-003: Update with receipt
        await updateExecutionTelemetryPublished(supabase, {
          pickId: pick.id,
          discordMessageId: messageId!,
          publishLatencyMs: singlePublishLatencyMs,
        });
      }
      processedCount += 1;
    }
  }

  logger.info(
    { processedCount, betSlipsProcessed: processedBetSlips.size },
    'POSTING-AUTHORITY: Capper picks processing complete'
  );

  return processedCount;
}

/** Rule 2: System picks only post when meta.system_approved=true */
// eslint-disable-next-line max-lines-per-function
async function processSystemPicks(): Promise<number> {
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('posted_to_discord', false)
    .eq('meta->>pick_origin', 'system')
    .eq('meta->>system_approved', 'true')
    .order('created_at', { ascending: true })
    .limit(10);
  if (error) {
    logger.error(error, 'Error fetching approved system picks');
    return 0;
  }
  if (!picks?.length) return 0;

  logger.info({ count: picks.length }, 'POSTING-AUTHORITY: Processing approved system picks');
  let processedCount = 0;
  for (const pick of picks) {
    if (!(await claimPick(pick.id))) continue;

    // EXECUTION-TELEMETRY-ACTIVATION-003: Resolve routing for telemetry
    const routingConfig = resolveDiscordRoutingConfig();
    const targetSurface = resolveTargetSurface(routingConfig.mode, 'BEST_BETS');
    const requestStartTime = Date.now();

    // EXECUTION-TELEMETRY-ACTIVATION-003: Create telemetry BEFORE POST
    await createExecutionTelemetry(supabase, {
      pickId: pick.id,
      routeType: 'WEBHOOK',
      targetSurface,
      targetChannelId: 'system-picks',
      entryLine: pick.line,
      entryOdds: pick.odds,
      entryBook: pick.provider || null,
    });

    if (isPromotionShadowMode()) {
      logger.info({ id: pick.id, origin: 'system' }, 'Shadow mode — skipped system post');
    } else {
      // SPRINT-023-PRODUCTION-SURFACE-LOCK: Outbox-first publishing
      const outbox = await enqueuePickToOutbox(pick, 'system-picks');
      if (outbox.alreadyPosted) {
        logger.info({ pickId: pick.id }, 'OUTBOX-023: Already posted per outbox — skipping');
        continue;
      }

      const messageId = await postEliteCardToDiscord(pick);
      const publishLatencyMs = Date.now() - requestStartTime;

      // SPRINT-REAL-DISCORD-RECEIPT-PROOF-049: Validate and confirm with real snowflake
      if (!isValidDiscordSnowflake(messageId)) {
        logger.error(
          { pickId: pick.id, messageId },
          'REAL-DISCORD-RECEIPT-049: System pick post failed - invalid Discord ID'
        );
        await resetPostingOnFailure(pick.id, `Post returned invalid ID: ${messageId}`);
        await recordOutboxFailure(
          outbox.outboxId,
          'INVALID_DISCORD_ID',
          `Post returned invalid ID: ${messageId}`
        );
        // EXECUTION-TELEMETRY-ACTIVATION-003: Record failure
        await updateExecutionTelemetryFailed(supabase, {
          pickId: pick.id,
          errorMessage: `Post returned invalid ID: ${messageId}`,
          executionNotes: 'SYSTEM_DISCORD_POST_FAILED',
        });
        continue;
      }

      // OUTBOX-023: Record receipt in outbox BEFORE confirming on pick
      await recordOutboxReceipt(outbox.outboxId, messageId!);

      await confirmPostWithReceipt(pick.id, messageId);
      await persistDiscordReceipt(pick.id, {
        poster: 'DiscordPromotionAgent',
        channel_id: 'system-picks',
        message_id: messageId,
      });
      // EXECUTION-TELEMETRY-ACTIVATION-003: Update with receipt
      await updateExecutionTelemetryPublished(supabase, {
        pickId: pick.id,
        discordMessageId: messageId!,
        publishLatencyMs,
      });
    }
    processedCount += 1;
  }
  return processedCount;
}

/** Legacy fallback: picks without origin tag use promotion_band='HARD' */
// eslint-disable-next-line max-lines-per-function
async function processLegacyPicks(): Promise<number> {
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('posted_to_discord', false)
    .eq('promotion_band', 'HARD')
    .is('meta->>pick_origin', null)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    logger.error(error, 'Error fetching legacy HARD-band picks');
    return 0;
  }
  if (!picks?.length) return 0;

  logger.info({ count: picks.length }, 'POSTING-AUTHORITY: Processing legacy HARD-band picks');
  let processedCount = 0;
  for (const pick of picks) {
    if (!(await claimPick(pick.id))) continue;

    // EXECUTION-TELEMETRY-ACTIVATION-003: Resolve routing for telemetry
    const routingConfig = resolveDiscordRoutingConfig();
    const targetSurface = resolveTargetSurface(routingConfig.mode, 'FREE_DAILY_PICKS');
    const requestStartTime = Date.now();

    // EXECUTION-TELEMETRY-ACTIVATION-003: Create telemetry BEFORE POST
    await createExecutionTelemetry(supabase, {
      pickId: pick.id,
      routeType: 'WEBHOOK',
      targetSurface,
      targetChannelId: 'legacy-picks',
      entryLine: pick.line,
      entryOdds: pick.odds,
      entryBook: pick.provider || null,
    });

    if (isPromotionShadowMode()) {
      logger.info({ id: pick.id, band: pick.promotion_band }, 'Shadow mode — skipped legacy post');
    } else {
      // SPRINT-023-PRODUCTION-SURFACE-LOCK: Outbox-first publishing
      const outbox = await enqueuePickToOutbox(pick, 'legacy-picks');
      if (outbox.alreadyPosted) {
        logger.info({ pickId: pick.id }, 'OUTBOX-023: Already posted per outbox — skipping');
        continue;
      }

      const messageId = await postEliteCardToDiscord(pick);
      const publishLatencyMs = Date.now() - requestStartTime;

      // SPRINT-REAL-DISCORD-RECEIPT-PROOF-049: Validate and confirm with real snowflake
      if (!isValidDiscordSnowflake(messageId)) {
        logger.error(
          { pickId: pick.id, messageId },
          'REAL-DISCORD-RECEIPT-049: Legacy pick post failed - invalid Discord ID'
        );
        await resetPostingOnFailure(pick.id, `Post returned invalid ID: ${messageId}`);
        await recordOutboxFailure(
          outbox.outboxId,
          'INVALID_DISCORD_ID',
          `Post returned invalid ID: ${messageId}`
        );
        // EXECUTION-TELEMETRY-ACTIVATION-003: Record failure
        await updateExecutionTelemetryFailed(supabase, {
          pickId: pick.id,
          errorMessage: `Post returned invalid ID: ${messageId}`,
          executionNotes: 'LEGACY_DISCORD_POST_FAILED',
        });
        continue;
      }

      // OUTBOX-023: Record receipt in outbox BEFORE confirming on pick
      await recordOutboxReceipt(outbox.outboxId, messageId!);

      await confirmPostWithReceipt(pick.id, messageId);
      await persistDiscordReceipt(pick.id, {
        poster: 'DiscordPromotionAgent',
        channel_id: 'legacy-picks',
        message_id: messageId,
      });
      // EXECUTION-TELEMETRY-ACTIVATION-003: Update with receipt
      await updateExecutionTelemetryPublished(supabase, {
        pickId: pick.id,
        discordMessageId: messageId!,
        publishLatencyMs,
      });
    }
    processedCount += 1;
  }
  return processedCount;
}

// ---- MAIN AGENT ----
export async function promoteToDiscord() {
  // SPRINT-PROMOTION-PIPELINE-ACTIVATION: Gate status diagnostics at startup.
  // If any gate is blocking, log actionable message so operators know what to set.
  const shadowMode = isPromotionShadowMode();
  const webhookConfigured = !!getDiscordWebhookUrl();
  const autopilotMode = process.env.AUTOPILOT_MODE || '(not set — defaults to off)';
  const promotionPolicyCfg = parsePromotionPolicyConfig();

  logger.info('POSTING-AUTHORITY: Promotion cycle started', {
    shadowModeEnabled: shadowMode,
    webhookConfigured,
    autopilotMode,
    killSwitch: promotionPolicyCfg.killSwitch,
    promotionPolicyEnabled: promotionPolicyCfg.policyEnabled,
    actionRequired: shadowMode
      ? 'Set PROMOTION_SHADOW_MODE=true to suppress (or unset to allow posting)'
      : !webhookConfigured
        ? 'Set DISCORD_WEBHOOK_URL to enable posting'
        : !['prod', 'canary'].includes(process.env.AUTOPILOT_MODE?.toLowerCase() || '')
          ? 'Set AUTOPILOT_MODE=prod to allow Discord posts'
          : null,
  });

  if (promotionPolicyCfg.killSwitch) {
    logger.info('POSTING-AUTHORITY: Kill switch active — ALL Discord posting blocked');
    return;
  }
  const total =
    (await processCapperPicks()) + (await processSystemPicks()) + (await processLegacyPicks());
  if (total === 0) logger.info('POSTING-AUTHORITY: No eligible picks found.');
  else logger.info('POSTING-AUTHORITY: Promotion cycle complete', { totalProcessed: total });
}

// ---- AUTO-DISCORD-POSTING-001: OBSERVABILITY HOOK ----
export interface DiscordPublishHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  pendingCount: number;
  recentlyPostedCount: number;
  oldestPendingMinutes: number | null;
  webhookConfigured: boolean;
  shadowModeEnabled: boolean;
  killSwitchActive: boolean;
  checkedAt: string;
}

// eslint-disable-next-line complexity
export async function getDiscordPublishHealth(): Promise<DiscordPublishHealth> {
  const config = parsePromotionPolicyConfig();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const _twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  // Count pending picks (not yet posted to Discord)
  const { data: pending } = await supabase
    .from('unified_picks')
    .select('id, created_at')
    .eq('posted_to_discord', false)
    .eq('workflow_stage', 'approved')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: true })
    .limit(100);

  // Count recently posted picks (last 24h)
  const { data: recentlyPosted } = await supabase
    .from('unified_picks')
    .select('id')
    .eq('posted_to_discord', true)
    .gte('updated_at', twentyFourHoursAgo)
    .limit(100);

  const pendingCount = pending?.length || 0;
  const recentlyPostedCount = recentlyPosted?.length || 0;

  // Calculate oldest pending age in minutes
  let oldestPendingMinutes: number | null = null;
  if (pending && pending.length > 0) {
    const oldestCreatedAt = new Date(pending[0].created_at).getTime();
    oldestPendingMinutes = Math.round((now.getTime() - oldestCreatedAt) / (1000 * 60));
  }

  // Determine health status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (config.killSwitch || !getDiscordWebhookUrl()) {
    status = 'unhealthy';
  } else if (isPromotionShadowMode()) {
    status = 'degraded';
  } else if (oldestPendingMinutes !== null && oldestPendingMinutes > 120) {
    // Picks pending for >2 hours = degraded
    status = 'degraded';
  }

  return {
    status,
    pendingCount,
    recentlyPostedCount,
    oldestPendingMinutes,
    webhookConfigured: !!getDiscordWebhookUrl(),
    shadowModeEnabled: isPromotionShadowMode(),
    killSwitchActive: config.killSwitch || false,
    checkedAt: now.toISOString(),
  };
}

// ---- DISCORD-UX-OVERHAUL-001: RENDER EXPORT ----
/**
 * Render a Discord embed for a pick without posting.
 * Used for testing and verification.
 */
export async function renderDiscordEmbed(pickId: string): Promise<{
  presentation: PickPresentation;
  embed: any;
} | null> {
  const { data: pick, error } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('id', pickId)
    .single();

  if (error || !pick) {
    logger.error({ pickId, error }, 'Failed to fetch pick for rendering');
    return null;
  }

  const presentation = await buildPickPresentation(pick);
  const embed = buildEmbedFromPresentation(presentation);

  return { presentation, embed };
}

// Only run on direct execution, not when imported
if (require.main === module) {
  promoteToDiscord().then(() => {
    // eslint-disable-next-line no-console
    console.log('DiscordPromotionAgent complete');
  });
}
