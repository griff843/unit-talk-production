import 'dotenv/config';
import axios from 'axios';
import FormData from 'form-data';

// import { createCanvas, loadImage } from 'canvas'; // Commented out - canvas module not available
import { logger } from '../../services/logging';
import { supabase } from '../../services/supabaseClient';

import { autopilotGuard } from '../../lib/AutopilotGuard';
import {
  getCompliantPickTitle,
  getTierColor,
  buildCompliantEmbed,
  FORBIDDEN_PHRASES,
} from '../../lib/embedPresentationContract';
import { getBuildInfo, formatEmbedFooter } from '../../lib/buildInfo';
import {
  persistDiscordReceipt,
  generateWebhookReceiptId,
} from '../../lib/discordReceiptContract';

// ---- CONFIG ----
const DISCORD_WEBHOOK_URL = process.env['DISCORD_WEBHOOK_URL'] || '';

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : odds;
}
function formatUnit(size: any) {
  return size ? `${size}U` : '1U';
}
function formatEV(ev: any) {
  return ev !== undefined && ev !== null ? `${ev}% EV` : 'N/A';
}

// ---- IMAGE GENERATOR ----
async function generateEliteCard(_: any): Promise<Buffer> {
  // Canvas module not available - returning empty buffer as fallback
  // TODO: Implement image generation when canvas module is available
  return Buffer.from('');
}

// ---- EMBED BUILDER ----
// PHASE-2-PRODUCTION-READINESS-019: Compliant embed builder
// Removed forbidden phrases (e.g., "LOCK OF THE DAY")
function buildEliteEmbed(pick: any, gauntletRunId?: string) {
  const buildInfo = getBuildInfo('DiscordPromotionAgent');
  const footerBase = formatEmbedFooter(buildInfo, gauntletRunId);

  if (Array.isArray(pick.legs) && pick.legs.length > 1) {
    // Parlay/Teaser
    const title = getCompliantPickTitle(pick.tier || 'A', true, pick.legs.length);
    return {
      title,
      color: getTierColor(pick.tier || 'A'),
      image: { url: 'attachment://pick.png' },
      description: `**Tier:** ${pick.tier || 'N/A'} • **Odds:** ${formatOdds(pick.odds)} • **Units:** ${formatUnit(pick.unit_size)} • **Edge Score:** ${pick.edge_score ?? 'N/A'}\n**Payout:** TBD\n\n#parlay #unitTalk`,
      footer: { text: `${footerBase} | Not Financial Advice` }
    };
  }

  // Single pick - NO LONGER uses "LOCK OF THE DAY"
  const title = getCompliantPickTitle(pick.tier || 'A', false);
  return {
    title,
    color: getTierColor(pick.tier || 'A'),
    image: { url: 'attachment://pick.png' },
    description: `**${pick.player_name}**\n${pick.stat_type} ${pick.direction?.toUpperCase() || ''} ${pick.line}\n\n**Odds:** ${formatOdds(pick.odds)} • **Units:** ${formatUnit(pick.unit_size)}\n**Edge Score:** ${pick.edge_score ?? 'N/A'} • **EV:** ${formatEV(pick.ev_percent)}\n${pick.matchup ? `**Matchup:** ${pick.matchup}` : ''}`,
    footer: { text: `${footerBase} | Not Financial Advice` }
  };
}

// ---- POSTER ----
// Phase 6.5: All Discord posts MUST go through AutopilotGuard
// PHASE-2-PRODUCTION-READINESS-019: Single posting authority + receipt contract
async function postEliteCardToDiscord(pick: any, gauntletRunId?: string) {
  if (!DISCORD_WEBHOOK_URL) {
    logger.error('No Discord webhook URL set!');
    return { success: false, error: 'No webhook URL' };
  }

  // Phase 6.5: AutopilotGuard is the SOLE authority for side effects
  const guardResult = await autopilotGuard.assertMayPerformSideEffect({
    action: 'DISCORD_POST',
    agent_name: 'DiscordPromotionAgent',
    pick_id: pick.id,
    metadata: { tier: pick.tier, player: pick.player_name }
  });

  if (!guardResult.allowed) {
    logger.info({
      pickId: pick.id,
      reason: guardResult.reason,
      mode: guardResult.mode
    }, 'Discord post blocked by AutopilotGuard');
    return { success: false, blocked: true, reason: guardResult.reason };
  }

  const imageBuffer = await generateEliteCard(pick);
  const form = new FormData();
  form.append('file', imageBuffer, { filename: 'pick.png', contentType: 'image/png' });
  const embed = buildEliteEmbed(pick, gauntletRunId);

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

    // PHASE-2-PRODUCTION-READINESS-019: Persist receipt on success
    const receiptId = generateWebhookReceiptId();
    const channelId = DISCORD_WEBHOOK_URL.split('/').slice(-2, -1)[0] || 'webhook';

    await persistDiscordReceipt({
      pick_id: pick.id,
      discord_channel_id: channelId,
      discord_message_id: receiptId,
      posted_at: new Date().toISOString(),
      posted_by: `DiscordPromotionAgent:${getBuildInfo('DiscordPromotionAgent').commitShort}`,
      gauntlet_run_id: gauntletRunId,
      embed_title: embed.title,
      embed_footer: embed.footer?.text,
    });

    logger.info({ id: pick.id, receiptId }, 'Discord post successful with receipt');
    return { success: true, receiptId };

  } catch (err: any) {
    logger.error({ id: pick.id, error: err?.message || err }, 'Discord image-card post error');
    console.error('Discord image-card post error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

// ---- AGENT ----
export async function promoteToDiscord() {
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('posted_to_discord', false)
    .eq('status', 'approved')
    .or('tier.in.(S,A),bet_type.in.(parlay,teaser,rr)')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    logger.error(error, 'Error fetching picks for Discord promotion');
    throw error;
  }
  if (!picks || picks.length === 0) {
    logger.info('No eligible picks found for Discord promotion.');
    return;
  }

  for (const pick of picks) {
    await postEliteCardToDiscord(pick);
    try {
      await supabase.from('unified_picks').update({ posted_to_discord: true }).eq('id', pick.id);
      logger.info({ id: pick.id }, 'Posted pick to Discord with image-card');
    } catch (err: any) {
      logger.error({ id: pick.id, error: err?.message || err }, 'Failed to update posted_to_discord flag');
    }
  }
}

promoteToDiscord().then(() => {
  console.log('DiscordPromotionAgent complete');
});
