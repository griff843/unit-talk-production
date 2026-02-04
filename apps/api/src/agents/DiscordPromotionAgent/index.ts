/* eslint-disable max-lines */
import 'dotenv/config';
import axios from 'axios';
import FormData from 'form-data';

import { autopilotGuard } from '../../lib/AutopilotGuard';
import { logger } from '../../services/logging';
import { supabase } from '../../services/supabaseClient';
import { parsePromotionPolicyConfig } from '../GradingAgent/scoring/promotionPolicy';

// ---- CONFIG ----
const DISCORD_WEBHOOK_URL = process.env['DISCORD_WEBHOOK_URL'] || '';
const PROMOTION_SHADOW_MODE = process.env['PROMOTION_SHADOW_MODE'] !== 'false';

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : odds;
}
function formatUnit(size: any) {
  return size ? `${size}U` : '1U';
}
function formatEV(ev: any) {
  return ev !== undefined && ev !== null ? `${ev}% EV` : 'N/A';
}

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
async function generateEliteCard(_: any): Promise<Buffer> {
  return Buffer.from('');
}

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
  return {
    title: '🔥 LOCK OF THE DAY 🔥',
    color: pick.tier === 'S' ? 0x4fc3f7 : pick.tier === 'A' ? 0x66bb6a : 0xfbc02d,
    image: { url: 'attachment://pick.png' },
    description: `**${pick.player_name}**\n${pick.stat_type} ${pick.direction?.toUpperCase() || ''} ${pick.line}\n\n**Odds:** ${formatOdds(pick.odds)} • **Units:** ${formatUnit(pick.unit_size)}\n**Edge Score:** ${pick.edge_score ?? 'N/A'} • **EV:** ${formatEV(pick.ev_percent)}\n${pick.matchup ? `**Matchup:** ${pick.matchup}` : ''}`,
    footer: { text: '#sportsbetting #unitTalk | Not Financial Advice' },
  };
}

// ---- POSTER ----
async function postEliteCardToDiscord(pick: any) {
  if (!DISCORD_WEBHOOK_URL) {
    logger.error('No Discord webhook URL set!');
    return;
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
    return;
  }

  const form = new FormData();
  form.append('file', await generateEliteCard(pick), {
    filename: 'pick.png',
    contentType: 'image/png',
  });
  form.append(
    'payload_json',
    JSON.stringify({ username: 'Unit Talk Picks', embeds: [buildEliteEmbed(pick)] })
  );

  try {
    await axios.post(DISCORD_WEBHOOK_URL, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  } catch (err: any) {
    logger.error({ id: pick.id, error: err?.message || err }, 'Discord image-card post error');
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

async function persistDiscordReceipt(
  pickId: string,
  receipt: { channel_id?: string; poster: string }
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
async function processCapperPicks(): Promise<number> {
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('posted_to_discord', false)
    .eq('meta->>pick_origin', 'capper')
    .order('created_at', { ascending: true })
    .limit(20);
  if (error) {
    logger.error(error, 'Error fetching capper picks');
    return 0;
  }
  if (!picks?.length) return 0;

  logger.info({ count: picks.length }, 'POSTING-AUTHORITY: Processing capper picks (ALWAYS POST)');
  for (const pick of picks) {
    if (!(await claimPick(pick.id))) continue;
    const meta = (pick.meta as Record<string, any>) || {};
    const capper = meta.capper || pick.capper_username || pick.capper || 'unknown';
    if (PROMOTION_SHADOW_MODE) {
      logger.info({ id: pick.id, capper, origin: 'capper' }, 'Shadow mode — skipped capper post');
    } else {
      await postEliteCardToDiscord(pick);
      await persistDiscordReceipt(pick.id, {
        poster: 'DiscordPromotionAgent',
        channel_id: `capper-thread:${capper}`,
      });
    }
  }
  return picks.length;
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

// eslint-disable-next-line no-console
promoteToDiscord().then(() => {
  console.log('DiscordPromotionAgent complete');
});
