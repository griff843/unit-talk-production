/**
 * Post Picks to Discord - Real Discord Integration
 *
 * Posts the approved picks to the actual Discord channel
 * Uses Discord.js to send real messages to griff843's channel
 */

import { Client, GatewayIntentBits, EmbedBuilder, TextChannel } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: 'apps/discord-bot/.env' });

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
const GRIFF_CHANNEL_ID = '1289478274615087146'; // #🎯・cappers-space channel

if (!DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN not found in environment');
  console.error('   Check apps/discord-bot/.env file');
  process.exit(1);
}

async function getApprovedPicks() {
  console.log('🔍 Fetching approved picks from database...\n');

  const { data, error } = await supabase
    .from('unified_picks')
    .select('id, ticket_id, user_id, sport, market, selection, line, odds, stake, potential_payout, confidence, approved_at, published, discord_message_id')
    .not('approved_at', 'is', null)
    .eq('published', true)
    .order('approved_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching picks:', error.message);
    return [];
  }

  // Filter for picks with simulated Discord IDs (timestamp pattern) or null
  const picksToPost = data?.filter(pick =>
    !pick.discord_message_id || pick.discord_message_id.match(/^\d{13}-/)
  ) || [];

  console.log(`✅ Found ${picksToPost.length} picks ready for real Discord posting\n`);
  return picksToPost;
}

async function createPickEmbed(pick: any) {
  // Get user info
  const { data: user } = await supabase
    .from('users')
    .select('username')
    .eq('id', pick.user_id)
    .single();

  const username = user?.username || 'Unknown';

  // Create rich embed
  const embed = new EmbedBuilder()
    .setColor(pick.selection === 'over' ? 0x00FF00 : 0xFF0000)
    .setTitle(`🎯 ${pick.sport} Pick`)
    .setDescription(`**${pick.market}** ${pick.selection.toUpperCase()} ${pick.line}`)
    .addFields(
      { name: 'Odds', value: `${pick.odds > 0 ? '+' : ''}${pick.odds}`, inline: true },
      { name: 'Units', value: `${pick.stake}u`, inline: true },
      { name: 'Confidence', value: `${pick.confidence}%`, inline: true },
      { name: 'Potential Payout', value: `${pick.potential_payout.toFixed(2)}u`, inline: true },
    )
    .setFooter({ text: `Capper: ${username} | ${new Date().toLocaleString()}` })
    .setTimestamp();

  return embed;
}

async function postPickToDiscord(client: Client, pick: any): Promise<string | null> {
  try {
    console.log(`📢 Posting pick ${pick.id} to Discord...`);
    console.log(`   ${pick.sport} ${pick.market} ${pick.selection} ${pick.line} @ ${pick.odds}`);

    const channel = await client.channels.fetch(GRIFF_CHANNEL_ID) as TextChannel;

    if (!channel) {
      console.error(`❌ Channel not found: ${GRIFF_CHANNEL_ID}`);
      return null;
    }

    const embed = await createPickEmbed(pick);
    const message = await channel.send({ embeds: [embed] });

    console.log(`✅ Posted to Discord: ${message.id}\n`);

    // Update database with real Discord message ID
    await supabase
      .from('unified_picks')
      .update({
        discord_message_id: message.id,
        discord_thread_id: GRIFF_CHANNEL_ID,
        posted_at: new Date().toISOString(),
      })
      .eq('id', pick.id);

    return message.id;
  } catch (error) {
    console.error(`❌ Error posting to Discord:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 POSTING PICKS TO DISCORD');
  console.log('='.repeat(70));
  console.log('');

  // Initialize Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  console.log('🔐 Logging into Discord...');

  await client.login(DISCORD_TOKEN);

  console.log('✅ Discord client ready\n');

  // Wait for client to be ready
  await new Promise(resolve => {
    client.once('ready', resolve);
  });

  // Get picks to post
  const picks = await getApprovedPicks();

  if (picks.length === 0) {
    console.log('ℹ️  No picks to post (all picks already posted or none approved)\n');
    await client.destroy();
    process.exit(0);
  }

  // Post each pick
  let posted = 0;
  for (const pick of picks) {
    const messageId = await postPickToDiscord(client, pick);
    if (messageId) {
      posted++;
    }
    await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit: 2s between posts
  }

  console.log('='.repeat(70));
  console.log('📊 DISCORD POSTING RESULTS');
  console.log('='.repeat(70));
  console.log(`✅ Successfully Posted: ${posted}/${picks.length}`);
  console.log('='.repeat(70));

  if (posted === picks.length) {
    console.log('\n🎉 ALL PICKS POSTED TO DISCORD!\n');
  } else {
    console.log('\n⚠️  Some picks failed to post\n');
  }

  // Cleanup
  await client.destroy();
  process.exit(0);
}

main().catch(error => {
  console.error('\n💥 CRITICAL ERROR:', error);
  process.exit(1);
});
