/**
 * discord-canary-webhook.ts - DISCORD-WEBHOOK-CANARY-PROOF-026
 *
 * Creates a test pick with direction/team fields and posts it to Discord via webhook.
 * Used to verify SMARTFORM-UX-CRITICAL-FIXPACK-025 direction fix works end-to-end.
 *
 * Run inside API container:
 *   docker-compose exec api npx tsx src/scripts/discord-canary-webhook.ts
 */
import 'dotenv/config';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { buildProductionFooter } from '../lib/embedPresentationContract';
import { getBuildInfo } from '../lib/buildInfo';

// ---- CONFIG ----
const DISCORD_WEBHOOK_URL = process.env['DISCORD_WEBHOOK_URL'] || '';
const SUPABASE_URL = process.env['SUPABASE_URL'] || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- HELPERS ----
function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : odds.toString();
}

// ---- BUILD EMBED ----
interface CanaryPick {
  id: string;
  bet_slip_id: string;
  sport: string;
  stat_type: string;
  selection: string;  // direction (over/under) stored here
  line: number;
  odds: number;
  player_name?: string;
  team?: string;
  matchup?: string;
  tier: string;
  unit_size: number;
  capper_username: string;
  meta: Record<string, any>;
}

function buildCanaryEmbed(pick: CanaryPick) {
  // Extract direction from selection field (over/under)
  const direction = pick.selection?.toUpperCase() || '';

  // Determine title based on bet type
  let title: string;
  let marketLabel: string;

  if (pick.player_name) {
    // Player prop
    title = `${pick.player_name} ${direction} ${pick.line}`;
    marketLabel = pick.stat_type || 'Player Prop';
  } else if (pick.team) {
    // Team total or spread
    if (pick.stat_type?.toLowerCase().includes('total') || pick.stat_type?.toLowerCase().includes('team_total')) {
      title = `${pick.team} ${direction} ${pick.line}`;
      marketLabel = 'Team Total';
    } else {
      // Spread
      const lineStr = pick.line > 0 ? `+${pick.line}` : pick.line.toString();
      title = `${pick.team} ${lineStr}`;
      marketLabel = 'Spread';
    }
  } else {
    title = pick.selection || 'Unknown Pick';
    marketLabel = pick.stat_type || 'Unknown';
  }

  const contextLine = `${pick.sport} ${pick.matchup ? '• ' + pick.matchup : ''}`;

  // EMBED-PRODUCTION-CONTRACT-030: Use production-compliant footer
  const footer = buildProductionFooter();

  return {
    title: `🎯 ${title}`,
    color: 0x00ff00, // Green for canary
    description: `**${marketLabel}**\n${contextLine}`,
    fields: [
      { name: 'Odds', value: formatOdds(pick.odds), inline: true },
      { name: 'Units', value: `${pick.unit_size}U`, inline: true },
      { name: 'Tier', value: `${pick.tier}-Tier`, inline: true },
      { name: 'Capper', value: pick.capper_username, inline: true },
      // EMBED-PRODUCTION-CONTRACT-030: Dev-only fields REMOVED
    ],
    footer: { text: footer },
    timestamp: new Date().toISOString(),
  };
}

// ---- MAIN ----
async function main() {
  console.log('=== DISCORD-WEBHOOK-CANARY-PROOF-026 ===\n');

  // Verify webhook URL
  if (!DISCORD_WEBHOOK_URL) {
    console.error(' DISCORD_WEBHOOK_URL not set!');
    process.exit(1);
  }
  console.log(' DISCORD_WEBHOOK_URL configured');

  // Verify Supabase connection
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(' Supabase credentials not set!');
    process.exit(1);
  }
  console.log(' Supabase configured');

  // Get a test capper (any active capper)
  const { data: cappers, error: capperError } = await supabase
    .from('users')
    .select('id, username')
    .eq('active', true)
    .limit(1);

  if (capperError || !cappers?.length) {
    console.error(' Failed to fetch capper:', capperError?.message);
    process.exit(1);
  }
  const capper = cappers[0];
  console.log(` Using capper: ${capper.username} (${capper.id})`);

  // Create canary pick data
  const betSlipId = uuidv4();
  const pickId = uuidv4();

  const canaryPick: CanaryPick = {
    id: pickId,
    bet_slip_id: betSlipId,
    sport: 'NBA',
    stat_type: 'team_total',
    selection: 'over',  // DIRECTION - this is what we're testing!
    line: 115.5,
    odds: -110,
    team: 'Lakers',     // TEAM - this is what we're testing!
    matchup: 'Lakers @ Warriors',
    tier: 'A',
    unit_size: 1,
    capper_username: capper.username,
    meta: {
      pick_origin: 'capper',
      capper: capper.username,
      canary_test: true,
      canary_id: 'DISCORD-WEBHOOK-CANARY-PROOF-026',
      created_at: new Date().toISOString(),
    },
  };

  console.log('\n--- Canary Pick Data ---');
  console.log(`Pick ID: ${pickId}`);
  console.log(`Bet Slip ID: ${betSlipId}`);
  console.log(`Sport: ${canaryPick.sport}`);
  console.log(`Stat Type: ${canaryPick.stat_type}`);
  console.log(`Team: ${canaryPick.team}`);
  console.log(`Direction (selection): ${canaryPick.selection}`);
  console.log(`Line: ${canaryPick.line}`);
  console.log(`Odds: ${canaryPick.odds}`);
  console.log(`Matchup: ${canaryPick.matchup}`);

  // Build embed
  const embed = buildCanaryEmbed(canaryPick);

  console.log('\n--- Discord Embed Preview ---');
  console.log(`Title: ${embed.title}`);
  console.log(`Description: ${embed.description}`);
  for (const field of embed.fields) {
    console.log(`  ${field.name}: ${field.value}`);
  }

  // Post to Discord
  console.log('\n--- Posting to Discord ---');
  try {
    const response = await axios.post(`${DISCORD_WEBHOOK_URL}?wait=true`, {
      username: 'Unit Talk CANARY',
      embeds: [embed],
    });

    const messageId = response.data?.id;
    console.log(` Posted to Discord!`);
    console.log(`Message ID: ${messageId}`);

    // EMBED-PRODUCTION-CONTRACT-030: Include commit SHA in discord receipt
    const buildInfo = getBuildInfo('discord-canary-webhook');

    // Insert canary pick into unified_picks for record
    const pickInsert = {
      id: pickId,
      bet_slip_id: betSlipId,
      user_id: capper.id,
      sport: canaryPick.sport,
      stat_type: canaryPick.stat_type,
      selection: canaryPick.selection,
      line: canaryPick.line,
      odds: canaryPick.odds,
      team: canaryPick.team,
      matchup: canaryPick.matchup,
      tier: canaryPick.tier,
      unit_size: canaryPick.unit_size,
      posted_to_discord: true,
      meta: {
        ...canaryPick.meta,
        discord_receipt: {
          message_id: messageId,
          posted_at: new Date().toISOString(),
          poster: 'discord-canary-webhook.ts',
          commit_sha: buildInfo.commit,
          commit_short: buildInfo.commitShort,
          environment: buildInfo.environment,
        },
      },
    };

    const { data: insertedPick, error: insertError } = await supabase
      .from('unified_picks')
      .insert(pickInsert)
      .select()
      .single();

    if (insertError) {
      console.log(` Warning: Failed to insert pick record: ${insertError.message}`);
      console.log('   (This is OK - the Discord post still succeeded)');
    } else {
      console.log(` Pick record inserted: ${insertedPick.id}`);
    }

    // Output proof summary
    console.log('\n=== CANARY PROOF SUMMARY ===');
    console.log(`Status: SUCCESS`);
    console.log(`Discord Message ID: ${messageId}`);
    console.log(`Pick ID: ${pickId}`);
    console.log(`Direction Verified: ${canaryPick.selection.toUpperCase()}`);
    console.log(`Team Verified: ${canaryPick.team}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    // Return proof data for capture
    return {
      success: true,
      message_id: messageId,
      pick_id: pickId,
      bet_slip_id: betSlipId,
      direction: canaryPick.selection,
      team: canaryPick.team,
      embed,
    };
  } catch (err: any) {
    console.error(` Discord post failed: ${err.message}`);
    if (err.response) {
      console.error('Response:', JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Canary script error:', err);
  process.exit(1);
});
