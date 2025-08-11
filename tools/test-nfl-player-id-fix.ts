import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits } from 'discord.js';
import { buildAlertEmbed } from './src/agents/AlertAgent/embedBuilder';
import 'dotenv/config';

/**
 * NFL PLAYER ID FIX TEST
 *
 * ISSUE: Josh Allen (Bills QB) showing Patrick Mahomes' headshot
 * Current ID: "3139477" - This appears to be wrong
 *
 * Need to find Josh Allen's correct ESPN player ID
 */

async function testNflPlayerIds() {
  console.log('🏈 NFL PLAYER ID FIX TEST');
  console.log('='.repeat(60));
  console.log('🚨 ISSUE: Josh Allen showing Patrick Mahomes headshot');
  console.log('📋 Current ID: 3139477 (INCORRECT)');
  console.log("🎯 Goal: Find Josh Allen's correct ESPN player ID");
  console.log('='.repeat(60));

  let discordClient: Client | null = null;

  try {
    // Known NFL player IDs for testing and comparison
    const knownNflIds = [
      // Josh Allen - Bills QB (multiple candidates to test)
      { name: 'Josh Allen', playerId: '3139477', note: 'CURRENT (shows Mahomes)' },
      { name: 'Josh Allen', playerId: '3916387', note: 'ESPN alternative 1' },
      { name: 'Josh Allen', playerId: '4038524', note: 'ESPN alternative 2' },
      { name: 'Josh Allen', playerId: '4362887', note: 'ESPN alternative 3' },

      // Known working IDs for reference
      { name: 'Patrick Mahomes', playerId: '3139477', note: 'Reference - working' },
      { name: 'Tom Brady', playerId: '2330', note: 'Reference - working' },
      { name: 'Aaron Rodgers', playerId: '8439', note: 'Reference - working' },
    ];

    console.log('\n🔍 TESTING PLAYER IDs:');
    knownNflIds.forEach(player => {
      const url = `https://a.espncdn.com/i/headshots/nfl/players/full/${player.playerId}.png`;
      console.log(`  📊 ${player.name} (${player.playerId}): ${player.note}`);
      console.log(`     URL: ${url}`);
    });

    // Create test picks for each ID
    const testPicks = knownNflIds.map((player, index) => ({
      id: `nfl-test-${index}-${Date.now()}`,
      player_name: player.name,
      player_id: player.playerId,
      capper: 'Griff843',
      sport: 'NFL',
      bet_type: 'player_props',
      ticket_type: 'single',
      tier: 'A',
      outcome: 'Over 2.5 Passing TDs',
      line: '2.5',
      odds: -115,
      unit_size: 4,
      confidence_score: 82,
      created_at: new Date().toISOString(),
      note: player.note,
    }));

    // Initialize Discord client
    console.log('\n🔌 Initializing Discord client...');
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    const discordToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
    if (!discordToken) {
      throw new Error('Discord token not found');
    }

    await discordClient.login(discordToken);
    await new Promise(resolve => {
      if (discordClient!.isReady()) {
        resolve(void 0);
      } else {
        discordClient!.once('ready', () => resolve(void 0));
      }
    });

    // Get target thread
    const griff843ThreadId = process.env.CAPPER_THREAD_GRIFF843;
    if (!griff843ThreadId) {
      throw new Error('Griff843 thread ID not configured');
    }

    const channel = await discordClient.channels.fetch(griff843ThreadId);
    if (!channel) {
      throw new Error(`Could not find channel/thread: ${griff843ThreadId}`);
    }

    // Post test picks to verify headshots
    console.log('\n📤 Posting NFL player ID tests...');

    for (let i = 0; i < testPicks.length; i++) {
      const pick = testPicks[i];
      const advice = `NFL ID TEST: ${pick.note} - Checking if headshot matches player name.`;

      const embed = buildAlertEmbed(pick, advice);

      const message = await (channel as any).send({
        content: `**🏈 NFL ID TEST ${i + 1}: ${pick.player_name} (${pick.player_id})**\n*${pick.note}*`,
        embeds: [embed],
      });

      console.log(
        `✅ Test ${i + 1} posted: ${pick.player_name} (${pick.player_id}) - ${pick.note}`
      );
      console.log(`   URL: ${message.url}`);

      // Wait between posts
      if (i < testPicks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Summary and next steps
    console.log('\n' + '='.repeat(60));
    console.log('🏈 NFL PLAYER ID TEST COMPLETE!');
    console.log('='.repeat(60));

    console.log('\n📋 WHAT TO CHECK:');
    console.log('  1. Which Josh Allen ID shows the correct Bills QB headshot');
    console.log('  2. Confirm 3139477 actually shows Mahomes (not Josh Allen)');
    console.log('  3. Identify the correct ESPN player ID for Josh Allen');

    console.log('\n🎯 NEXT STEPS:');
    console.log('  1. Visual verification of each headshot via Discord');
    console.log('  2. Update parlayEmbedBuilder.ts with correct Josh Allen ID');
    console.log('  3. Update test-final-parlay-no-images.ts with correct ID');
    console.log('  4. Re-test to confirm correct headshot displays');

    console.log('\n🔍 ESPN NFL PLAYER ID PATTERNS:');
    console.log('  • Older players: Lower IDs (Tom Brady: 2330)');
    console.log('  • Recent players: Higher IDs (4M+ range common)');
    console.log('  • Josh Allen drafted 2018 - likely 4M+ range');
  } catch (error) {
    console.error('💥 NFL player ID test failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the test
testNflPlayerIds();
