import 'dotenv/config';
import { BaseAgentConfig, BaseAgentDependencies, AgentStatus, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { supabase } from '../../services/supabaseClient';
import axios from 'axios';
import FormData from 'form-data';
import { createCanvas, loadImage } from 'canvas';
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
  // Multi-leg (Parlay/Teaser/RR)
  if (Array.isArray(pick.legs) && pick.legs.length > 1) {
    const width = 780;
    const height = 210 + 52 * pick.legs.length;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#232526');
    bgGrad.addColorStop(1, '#414345');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Red alert banner
    ctx.fillStyle = '#ff5252';
    ctx.fillRect(0, 0, width, 50);
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('🔥 PARLAY/TEASER ALERT!', 30, 38);

    // Tier
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffe082';
    ctx.fillText(getTierEmoji(pick.tier), 440, 36);

    // Legs
    let y = 95;
    for (const leg of pick.legs) {
      // Headshot circle
      if (leg.player_slug) {
        try {
          const img = await loadImage(getHeadshotUrl(leg.player_slug));
          ctx.save();
          ctx.beginPath();
          ctx.arc(55, y - 12, 23, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, 22, y - 38, 65, 65);
          ctx.restore();
        } catch { /* ignore */ }
      }
      ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(leg.player_name, 95, y);

      ctx.font = '22px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#b0bec5';
      ctx.fillText(`${leg.stat_type || ''} ${leg.direction?.toUpperCase() || ''} ${leg.line} (${formatOdds(leg.odds)})`, 320, y);

      y += 50;
    }

    // Summary Row
    ctx.font = '22px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(`Payout: ${formatOdds(pick.odds)} • Units: ${formatUnit(pick.unit_size)} • ${formatEV(pick.ev_percent)}`, 24, height - 45);
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#90caf9';
    ctx.fillText(`Edge Score: ${pick.edge_score || 'N/A'}   ${pick.matchup || ''}`, 24, height - 17);

    return canvas.toBuffer('image/png');
  }

  // Single Pick
  const width = 700;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  // Gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#222831');
  grad.addColorStop(1, '#374151');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Banner
  ctx.fillStyle = '#43e97b';
  ctx.fillRect(0, 0, width, 54);
  ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('🔥 LOCK OF THE DAY 🔥', 30, 40);

  ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${pick.player_name}`, 190, 95);

  // Headshot
  if (pick.player_slug) {
    try {
      const img = await loadImage(getHeadshotUrl(pick.player_slug));
      ctx.save();
      ctx.beginPath();
      ctx.arc(100, 120, 70, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 20, 50, 160, 160);
      ctx.restore();
    } catch { }
  }

  ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffe082';
  ctx.fillText(`${pick.stat_type || ''} ${pick.direction?.toUpperCase() || ''} ${pick.line}`, 190, 150);

  ctx.font = '24px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#fbc02d';
  ctx.fillText(`Odds: ${formatOdds(pick.odds)}   Units: ${formatUnit(pick.unit_size)}`, 190, 190);

  ctx.font = '22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#8cf';
  ctx.fillText(`Edge Score: ${pick.edge_score ?? 'N/A'}   ${formatEV(pick.ev_percent)}`, 190, 230);

  ctx.font = '22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#90caf9';
  ctx.fillText(`Game: ${pick.matchup || pick.team || 'TBA'}`, 190, 270);

  ctx.font = '20px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#b0b0b0';
  ctx.fillText(`Game Time: ${formatDate(pick.game_time)}`, 190, 310);

  ctx.font = '22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = pick.tier === 'S' ? '#4fc3f7' : pick.tier === 'A' ? '#66bb6a' : '#fbc02d';
  ctx.fillText(getTierEmoji(pick.tier), 30, 370);

  return canvas.toBuffer('image/png');
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
