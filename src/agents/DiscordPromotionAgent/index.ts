import 'dotenv/config';
import { BaseAgentConfig, BaseAgentDependencies, AgentStatus, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { supabase } from '../../services/supabaseClient';
import axios from 'axios';
import * as FormData from 'form-data';
// import { createCanvas, loadImage } from 'canvas'; // Commented out - canvas module not available
import { logger } from '../../services/logging';

// ---- CONFIG ----
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const PLAYER_HEADSHOT_CDN = process.env.PLAYER_HEADSHOT_CDN || 'https://your.cdn.com/headshots/';

// ---- UTILS ----
function getHeadshotUrl(player_slug: string) {
  return player_slug ? `${PLAYER_HEADSHOT_CDN}${player_slug}.png` : '';
}
function getTierEmoji(tier: string) {
  if (tier === 'S') return '💎 S-TIER LOCK 💎';
  if (tier === 'A') return '🔥 A-TIER';
  if (tier === 'B') return '🟨 B-TIER';
  return '';
}
function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : odds;
}
function formatUnit(size: any) {
  return size ? `${size}U` : '1U';
}
function formatEV(ev: any) {
  return ev !== undefined && ev !== null ? `${ev}% EV` : 'N/A';
}
function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
}

// ---- IMAGE GENERATOR ----
async function generateEliteCard(pick: any): Promise<Buffer> {
  // Canvas module not available - returning empty buffer as fallback
  // TODO: Implement image generation when canvas module is available
  return Buffer.from('');
}

// ---- EMBED BUILDER ----
function buildEliteEmbed(pick: any) {
  if (Array.isArray(pick.legs) && pick.legs.length > 1) {
    return {
      title: `🔥 PARLAY/TEASER ALERT • ${pick.legs.length} Legs`,
      color: 0xFF5252,
      image: { url: 'attachment://pick.png' },
      description: `**Tier:** ${pick.tier || 'N/A'} • **Odds:** ${formatOdds(pick.odds)} • **Units:** ${formatUnit(pick.unit_size)} • **Edge Score:** ${pick.edge_score ?? 'N/A'}\n**Payout:** TBD\n\n#parlay #unitTalk`,
      footer: { text: 'Best Bets by Unit Talk | Not Financial Advice' }
    };
  }
  // Single
  return {
    title: '🔥 LOCK OF THE DAY 🔥',
    color: pick.tier === 'S' ? 0x4fc3f7 : pick.tier === 'A' ? 0x66bb6a : 0xfbc02d,
    image: { url: 'attachment://pick.png' },
    description: `**${pick.player_name}**\n${pick.stat_type} ${pick.direction?.toUpperCase() || ''} ${pick.line}\n\n**Odds:** ${formatOdds(pick.odds)} • **Units:** ${formatUnit(pick.unit_size)}\n**Edge Score:** ${pick.edge_score ?? 'N/A'} • **EV:** ${formatEV(pick.ev_percent)}\n${pick.matchup ? `**Matchup:** ${pick.matchup}` : ''}`,
    footer: { text: '#sportsbetting #unitTalk | Not Financial Advice' }
  };
}

// ---- POSTER ----
async function postEliteCardToDiscord(pick: any) {
  if (!DISCORD_WEBHOOK_URL) {
    logger.error('No Discord webhook URL set!');
    return;
  }
  const imageBuffer = await generateEliteCard(pick);
  const form = new FormData();
  form.append('file', imageBuffer, { filename: 'pick.png', contentType: 'image/png' });
  const embed = buildEliteEmbed(pick);

  form.append('payload_json', JSON.stringify({
    username: 'Unit Talk Picks',
    embeds: [embed],
  }));

  try {
    await axios.post(DISCORD_WEBHOOK_URL, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  } catch (err: any) {
    logger.error({ id: pick.id, error: err?.message || err }, 'Discord image-card post error');
    console.error('Discord image-card post error:', err);
  }
}

// ---- AGENT ----
export async function promoteToDiscord() {
  const { data: picks, error } = await supabase
    .from('final_picks')
    .select('*')
    .eq('posted_to_discord', false)
    .eq('auto_approved', true)
    .or('tier.in.("{S,A}"),bet_type.in.("{parlay,teaser,rr}")')
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
      await supabase.from('final_picks').update({ posted_to_discord: true }).eq('id', pick.id);
      logger.info({ id: pick.id }, 'Posted pick to Discord with image-card');
    } catch (err: any) {
      logger.error({ id: pick.id, error: err?.message || err }, 'Failed to update posted_to_discord flag');
    }
  }
}

promoteToDiscord().then(() => {
  console.log('DiscordPromotionAgent complete');
});
