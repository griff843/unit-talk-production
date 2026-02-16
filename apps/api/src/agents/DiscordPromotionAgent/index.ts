/* eslint-disable max-lines */
import 'dotenv/config';
import axios from 'axios';
import FormData from 'form-data';

import { autopilotGuard } from '../../lib/AutopilotGuard';
import { logger } from '../../services/logging';
import { supabase } from '../../services/supabaseClient';
import { buildPickPresentation } from '../../services/pickPresentationBuilder';
import { PickPresentation } from '../../types/pickPresentation';
import { parsePromotionPolicyConfig } from '../GradingAgent/scoring/promotionPolicy';
import { calculateParlayOdds } from '../AlertAgent/parlayEmbedBuilder';

// ---- CONFIG ----
const DISCORD_WEBHOOK_URL = process.env['DISCORD_WEBHOOK_URL'] || '';
const PROMOTION_SHADOW_MODE = process.env['PROMOTION_SHADOW_MODE'] !== 'false';

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
  const lineDisplay = pick.line !== null && pick.line !== undefined && pick.line !== 0
    ? ` ${pick.line}`
    : '';
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
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
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
    const line = leg.line !== null && leg.line !== undefined ? ` ${leg.line > 0 ? '+' : ''}${leg.line}` : '';
    return `Spread${line}`;
  }
  if (statType.includes('total') || betType.includes('total') || statType.includes('over') || statType.includes('under')) {
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
function buildParlayEmbed(legs: any[]) {
  const capper = getCapperFromPick(legs[0]);
  const sports = [...new Set(legs.map(l => l.sport || 'Sports'))].join('/');
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
  const legsText = legs.map((leg) => {
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
  }).join('\n\n');

  return {
    title: `🎯 PARLAY ALERT • ${legs.length} Legs`,
    color: highestTier === 'S' ? 0xff5252 : highestTier === 'A' ? 0x66bb6a : 0xfbc02d,
    fields: [
      { name: '🎯 Parlay Legs', value: legsText, inline: false },
      { name: 'Total Odds', value: `${formatOdds(totalOdds)}`, inline: true },
      { name: 'Units', value: formatUnit(totalUnits), inline: true },
      { name: 'Tier', value: `${highestTier}-Tier`, inline: true },
      { name: 'Capper', value: capper, inline: true },
      { name: 'Sports', value: sports, inline: true },
    ],
    footer: { text: 'Unit Talk' },
  };
}

/**
 * DISCORD-UX-OVERHAUL-001: Build embed from PickPresentation
 * Uses the standardized presentation format for consistent Discord display.
 * @see docs/contracts/PICK_PRESENTATION_STANDARD.md
 */
function buildEmbedFromPresentation(presentation: PickPresentation) {
  const tierColors: Record<string, number> = {
    'S': 0x4fc3f7, // Cyan for S-tier
    'A': 0x66bb6a, // Green for A-tier
    'B': 0xfbc02d, // Yellow for B-tier
    'C': 0xff9800, // Orange for C-tier
    'D': 0x9e9e9e, // Gray for D-tier
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

  const embed: any = {
    // DISCORD-UX-OVERHAUL-001: Title is now the actual pick (e.g., "Texas Tech", "Furman -3.5", "Over 220.5")
    title: `🎯 ${presentation.title}`,
    color,
    // Market label as description line 1, context as line 2
    description: `**${presentation.market_label}**\n${presentation.context_line}`,
    fields,
    footer: { text: 'Unit Talk' },
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

  // PARLAY-DISCORD-FIX-001: Legacy parlay detection (now handled upstream)
  if (Array.isArray(pick.legs) && pick.legs.length > 1) {
    const contextLine = [sport, matchup, gameTime].filter(Boolean).join(' • ');
    return {
      title: `🎯 PARLAY ALERT • ${pick.legs.length} Legs`,
      color: 0xff5252,
      image: { url: 'attachment://pick.png' },
      fields: [
        { name: 'Odds', value: `${formatOdds(pick.odds)}`, inline: true },
        { name: 'Units', value: formatUnit(pick.unit_size), inline: true },
        { name: 'Tier', value: `${pick.tier || 'N/A'}-Tier`, inline: true },
        { name: 'Capper', value: capper, inline: true },
      ],
      description: contextLine ? `${contextLine}` : undefined,
      footer: { text: 'Unit Talk' },
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
    footer: { text: 'Unit Talk' },
  };
}

// ---- POSTER ----
/**
 * DISCORD-UX-OVERHAUL-001: Post single pick to Discord using PickPresentation standard
 * Uses buildPickPresentation for consistent display format.
 * PARLAY-DISCORD-GROUPING-001: Returns message_id for storage
 */
// eslint-disable-next-line max-lines-per-function
async function postEliteCardToDiscord(pick: any): Promise<string | null> {
  if (!DISCORD_WEBHOOK_URL) {
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

  try {
    // DISCORD-UX-OVERHAUL-001: Build presentation-ready format
    const presentation = await buildPickPresentation(pick);

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
    const response = await axios.post(`${DISCORD_WEBHOOK_URL}?wait=true`, {
      username: 'Unit Talk Picks',
      embeds: [embed],
    });
    const messageId = response.data?.id || null;

    logger.info({ pickId: pick.id, title: presentation.title, messageId }, 'Posted pick to Discord');
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
      const fallbackResponse = await axios.post(`${DISCORD_WEBHOOK_URL}?wait=true`, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      const fallbackMsgId = fallbackResponse.data?.id || null;
      logger.info({ pickId: pick.id, messageId: fallbackMsgId }, 'Posted pick to Discord (legacy fallback)');
      return fallbackMsgId;
    } catch (fallbackErr: any) {
      logger.error({ id: pick.id, error: fallbackErr?.message || fallbackErr }, 'Discord fallback post error');
      return null;
    }
  }
}

// PARLAY-DISCORD-FIX-001: Post parlay to Discord
// PARLAY-DISCORD-GROUPING-001: Returns message_id for storage
async function postParlayToDiscord(legs: any[]): Promise<string | null> {
  if (!DISCORD_WEBHOOK_URL) {
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

  try {
    // PARLAY-DISCORD-GROUPING-001: Use ?wait=true to get message_id back
    const response = await axios.post(`${DISCORD_WEBHOOK_URL}?wait=true`, {
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

async function claimPick(pickId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('unified_picks')
    .update({ posted_to_discord: true })
    .eq('id', pickId)
    .eq('posted_to_discord', false)
    .select('id');
  if (error || !data || data.length === 0) {
    logger.info({ id: pickId }, 'Pick already claimed — skipping (idempotent)');
    return false;
  }
  return true;
}

// PARLAY-DISCORD-FIX-001: Claim all parlay legs atomically
async function claimParlayLegs(pickIds: string[]): Promise<boolean> {
  const { data, error } = await supabase
    .from('unified_picks')
    .update({ posted_to_discord: true })
    .in('id', pickIds)
    .eq('posted_to_discord', false)
    .select('id');
  if (error || !data || data.length === 0) {
    logger.info({ pickIds }, 'Parlay legs already claimed — skipping (idempotent)');
    return false;
  }
  // Ensure all legs were claimed
  if (data.length !== pickIds.length) {
    logger.warn(
      { expected: pickIds.length, claimed: data.length },
      'Partial parlay claim — some legs already posted'
    );
  }
  return data.length > 0;
}

// PARLAY-DISCORD-GROUPING-001: Added message_id, ticket_type, leg_count params
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
    const { data: cur } = await supabase
      .from('unified_picks')
      .select('meta')
      .eq('id', pickId)
      .single();
    const meta = {
      ...((cur?.meta as Record<string, any>) || {}),
      discord_receipt: { ...receipt, posted_at: new Date().toISOString() },
    };
    await supabase.from('unified_picks').update({ meta }).eq('id', pickId);
  } catch (err) {
    logger.warn({ pickId }, 'Failed to persist discord receipt (non-fatal)');
  }
}

// ---- POSTING AUTHORITY ROUTER ----
// POSTING-AUTHORITY-001: Origin-gated posting per POSTING_AUTHORITY_CONTRACT.md

/** Rule 1: Capper picks ALWAYS post — no band/tier/score gate */
/** PARLAY-DISCORD-GROUPING-001: Always query ALL legs by bet_slip_id before posting */
// eslint-disable-next-line max-lines-per-function, complexity
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
        (leg) => leg.posted_to_discord === true || leg.meta?.discord_receipt?.message_id
      );
      if (anyPosted) {
        logger.info(
          { betSlipId, legCount: allLegs.length },
          'PARLAY-DISCORD-GROUPING-001: Parlay already posted — skipping (idempotent)'
        );
        continue;
      }

      // Claim ALL legs atomically
      const pickIds = allLegs.map((l) => l.id);
      if (!(await claimParlayLegs(pickIds))) continue;

      logger.info(
        { betSlipId, legCount: allLegs.length, capper },
        'PARLAY-DISCORD-GROUPING-001: Posting parlay as SINGLE Discord message'
      );

      if (PROMOTION_SHADOW_MODE) {
        logger.info(
          { betSlipId, legCount: allLegs.length, capper, origin: 'capper' },
          'Shadow mode — skipped capper parlay post'
        );
      } else {
        const messageId = await postParlayToDiscord(allLegs);

        // Persist SAME message_id on ALL legs
        for (const leg of allLegs) {
          await persistDiscordReceipt(leg.id, {
            poster: 'DiscordPromotionAgent',
            channel_id: `capper-thread:${capper}`,
            message_id: messageId || undefined,
            ticket_type: 'parlay',
            leg_count: allLegs.length,
          });
        }
      }
      processedCount += allLegs.length;
    } else {
      // Single pick — post normally
      if (!(await claimPick(pick.id))) continue;

      if (PROMOTION_SHADOW_MODE) {
        logger.info({ id: pick.id, capper, origin: 'capper' }, 'Shadow mode — skipped capper post');
      } else {
        const messageId = await postEliteCardToDiscord(pick);
        await persistDiscordReceipt(pick.id, {
          poster: 'DiscordPromotionAgent',
          channel_id: `capper-thread:${capper}`,
          message_id: messageId || undefined,
          ticket_type: 'single',
          leg_count: 1,
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
  for (const pick of picks) {
    if (!(await claimPick(pick.id))) continue;
    if (PROMOTION_SHADOW_MODE) {
      logger.info({ id: pick.id, origin: 'system' }, 'Shadow mode — skipped system post');
    } else {
      await postEliteCardToDiscord(pick);
      await persistDiscordReceipt(pick.id, {
        poster: 'DiscordPromotionAgent',
        channel_id: 'system-picks',
      });
    }
  }
  return picks.length;
}

/** Legacy fallback: picks without origin tag use promotion_band='HARD' */
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
  for (const pick of picks) {
    if (!(await claimPick(pick.id))) continue;
    if (PROMOTION_SHADOW_MODE) {
      logger.info({ id: pick.id, band: pick.promotion_band }, 'Shadow mode — skipped legacy post');
    } else {
      await postEliteCardToDiscord(pick);
    }
  }
  return picks.length;
}

// ---- MAIN AGENT ----
export async function promoteToDiscord() {
  if (parsePromotionPolicyConfig().killSwitch) {
    logger.info('POSTING-AUTHORITY: Kill switch active — ALL Discord posting blocked');
    return;
  }
  const total =
    (await processCapperPicks()) + (await processSystemPicks()) + (await processLegacyPicks());
  if (total === 0) logger.info('POSTING-AUTHORITY: No eligible picks found.');
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
  if (config.killSwitch || !DISCORD_WEBHOOK_URL) {
    status = 'unhealthy';
  } else if (PROMOTION_SHADOW_MODE) {
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
    webhookConfigured: !!DISCORD_WEBHOOK_URL,
    shadowModeEnabled: PROMOTION_SHADOW_MODE,
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
  // eslint-disable-next-line no-console
  promoteToDiscord().then(() => {
    console.log('DiscordPromotionAgent complete');
  });
}
