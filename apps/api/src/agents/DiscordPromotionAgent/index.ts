import 'dotenv/config';
import axios from 'axios';
import FormData from 'form-data';

// import { createCanvas, loadImage } from 'canvas'; // Commented out - canvas module not available
import { autopilotGuard } from '../../lib/AutopilotGuard';
import { logger } from '../../services/logging';
import { supabase } from '../../services/supabaseClient';

// ---- CONFIG ----
const DISCORD_WEBHOOK_URL = process.env['DISCORD_WEBHOOK_URL'] || '';
/** Promotion-specific shadow mode: blocks Discord publishing while keeping claims idempotent. Fail-closed. */
const PROMOTION_SHADOW_MODE = process.env['PROMOTION_SHADOW_MODE'] !== 'false'; // default: true (safe)

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
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
async function generateEliteCard(_: any): Promise<Buffer> {
  // Canvas module not available - returning empty buffer as fallback
  // TODO: Implement image generation when canvas module is available
  return Buffer.from('');
}

// ---- EMBED BUILDER ----
function buildEliteEmbed(pick: any) {
  if (Array.isArray(pick.legs) && pick.legs.length > 1) {
    return {
      title: `🔥 PARLAY/TEASER ALERT • ${pick.legs.length} Legs`,
      color: 0xff5252,
      image: { url: 'attachment://pick.png' },
      description: `**Tier:** ${pick.tier || 'N/A'} • **Odds:** ${formatOdds(pick.odds)} • **Units:** ${formatUnit(pick.unit_size)} • **Edge Score:** ${pick.edge_score ?? 'N/A'}\n**Payout:** TBD\n\n#parlay #unitTalk`,
      footer: { text: 'Best Bets by Unit Talk | Not Financial Advice' },
    };
  }
  // Single
  return {
    title: '🔥 LOCK OF THE DAY 🔥',
    color: pick.tier === 'S' ? 0x4fc3f7 : pick.tier === 'A' ? 0x66bb6a : 0xfbc02d,
    image: { url: 'attachment://pick.png' },
    description: `**${pick.player_name}**\n${pick.stat_type} ${pick.direction?.toUpperCase() || ''} ${pick.line}\n\n**Odds:** ${formatOdds(pick.odds)} • **Units:** ${formatUnit(pick.unit_size)}\n**Edge Score:** ${pick.edge_score ?? 'N/A'} • **EV:** ${formatEV(pick.ev_percent)}\n${pick.matchup ? `**Matchup:** ${pick.matchup}` : ''}`,
    footer: { text: '#sportsbetting #unitTalk | Not Financial Advice' },
  };
}

// ---- POSTER ----
// Phase 6.5: All Discord posts MUST go through AutopilotGuard
async function postEliteCardToDiscord(pick: any) {
  if (!DISCORD_WEBHOOK_URL) {
    logger.error('No Discord webhook URL set!');
    return;
  }

  // Phase 6.5: AutopilotGuard is the SOLE authority for side effects
  const guardResult = await autopilotGuard.assertMayPerformSideEffect({
    action: 'DISCORD_POST',
    agent_name: 'DiscordPromotionAgent',
    pick_id: pick.id,
    metadata: { tier: pick.tier, player: pick.player_name },
  });

  if (!guardResult.allowed) {
    logger.info(
      {
        pickId: pick.id,
        reason: guardResult.reason,
        mode: guardResult.mode,
      },
      'Discord post blocked by AutopilotGuard'
    );
    return;
  }

  const imageBuffer = await generateEliteCard(pick);
  const form = new FormData();
  form.append('file', imageBuffer, { filename: 'pick.png', contentType: 'image/png' });
  const embed = buildEliteEmbed(pick);

  form.append(
    'payload_json',
    JSON.stringify({
      username: 'Unit Talk Picks',
      embeds: [embed],
    })
  );

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
    .from('unified_picks')
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
    // P-03: Claim-first idempotency — mark as posted BEFORE posting
    const { data: claimed, error: claimErr } = await supabase
      .from('unified_picks')
      .update({ posted_to_discord: true })
      .eq('id', pick.id)
      .eq('posted_to_discord', false)
      .select('id');

    if (claimErr || !claimed || claimed.length === 0) {
      logger.info(
        { id: pick.id },
        'Pick already claimed for Discord or claim failed — skipping (idempotent)'
      );
      continue;
    }

    if (PROMOTION_SHADOW_MODE) {
      logger.info({ id: pick.id, tier: pick.tier }, 'Shadow mode — skipped Discord post (claim retained)');
    } else {
      await postEliteCardToDiscord(pick);
      logger.info({ id: pick.id }, 'Posted pick to Discord with image-card');
    }
  }
}

promoteToDiscord().then(() => {
  console.log('DiscordPromotionAgent complete');
});
